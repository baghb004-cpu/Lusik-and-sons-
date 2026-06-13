// ============================================================
// /api/builder/media-studio — the FFmpeg sidecar bridge (§26)
// ============================================================
// Admin-gated, fs-mode only. Locates the user-installed FFmpeg/
// FFprobe sidecar and runs the pure-composed commands to probe,
// thumbnail, and trim (Save-as-New-Clip). Originals are NEVER
// overwritten — trims/thumbnails write NEW files under
// portable/media. If the sidecar isn't installed it returns a
// friendly 409 with the one-command install hint (same honest
// pattern as the Retro Game Room emulators).
// ============================================================

import { join, resolve, sep, isAbsolute } from "node:path";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";

import { requireBuilderAdmin } from "../../../../src/builder/server/auth.ts";
import { getBuilderStorage } from "../../../../src/builder/storage/index.ts";
import { probeCmd, thumbnailCmd, trimCmd, parseProbeJson, type FfCommand } from "../../../../src/builder/media-studio/ffmpeg.ts";
import { newClipName } from "../../../../src/builder/media-studio/engine.ts";

export const dynamic = "force-dynamic";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" } });
}

const ROOT = () => join(process.cwd(), "portable");

/** Resolve a media-relative path and keep it inside portable/. */
function safePath(rel: string): string {
  if (typeof rel !== "string" || rel.includes("..") || isAbsolute(rel)) throw new Error("bad path");
  const abs = resolve(ROOT(), rel);
  if (abs !== ROOT() && !abs.startsWith(ROOT() + sep)) throw new Error("path escapes portable/");
  return abs;
}

/** Resolve a path and keep it inside portable/media/ specifically — the
 *  preview endpoint serves bytes to the browser, so it must NEVER reach the
 *  tax vault or anything else under portable/. */
function safeMediaPath(rel: string): string {
  const abs = safePath(rel); // contained under portable/
  const mediaRoot = join(ROOT(), "media");
  if (abs !== mediaRoot && !abs.startsWith(mediaRoot + sep)) throw new Error("only media/ files can be previewed");
  return abs;
}

// Content types for the preview stream, keyed by extension. Kept local (the
// format pack carries support levels, not MIME) and intentionally narrow.
const MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  avif: "image/avif", gif: "image/gif", bmp: "image/bmp", tif: "image/tiff",
  tiff: "image/tiff", svg: "image/svg+xml", heic: "image/heic", heif: "image/heif",
  mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", mkv: "video/x-matroska",
  m4v: "video/x-m4v", avi: "video/x-msvideo",
  wav: "audio/wav", mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac",
  flac: "audio/flac", ogg: "audio/ogg", opus: "audio/ogg", aiff: "audio/aiff",
};
function mimeFor(name: string): string {
  return MIME[name.toLowerCase().split(".").pop() ?? ""] ?? "application/octet-stream";
}

/** Re-present the request with the ?token= query param as an Authorization
 *  header so the shared verifier can check it. Media elements (<img>/<video>/
 *  <audio>) can't send headers, so the file branch falls back to the query
 *  param — the token is still required and verified the same way. */
function reqWithToken(req: Request, url: URL): Request {
  if (req.headers.get("authorization")) return req;
  const token = url.searchParams.get("token");
  if (!token) return req;
  const h = new Headers(req.headers);
  h.set("authorization", `Bearer ${token}`);
  return new Request(req.url, { headers: h });
}

/** Stream a local media file to the browser with HTTP Range support (so video
 *  scrubbing works). Originals are read-only here; this never writes. */
async function serveFile(rel: string, req: Request): Promise<Response> {
  let abs: string;
  try {
    abs = safeMediaPath(rel);
  } catch (e) {
    return json(400, { error: (e as Error).message });
  }
  if (!existsSync(abs)) return json(404, { error: "That media file isn't there.", path: rel });

  const { statSync, createReadStream } = await import("node:fs");
  const total = statSync(abs).size;

  // Wrap a Node read stream as a web ReadableStream by hand — Next's bundling
  // doesn't reliably expose stream.Readable.toWeb in the route runtime.
  const toWeb = (opts?: { start: number; end: number }): ReadableStream => {
    const node = createReadStream(abs, opts);
    return new ReadableStream({
      start(controller) {
        node.on("data", (chunk) => controller.enqueue(new Uint8Array(chunk as Buffer)));
        node.on("end", () => controller.close());
        node.on("error", (err) => controller.error(err));
      },
      cancel() { node.destroy(); },
    });
  };
  const headers: Record<string, string> = {
    "Content-Type": mimeFor(rel),
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };

  const range = req.headers.get("range");
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (m) {
      const start = m[1] ? parseInt(m[1], 10) : 0;
      let end = m[2] ? parseInt(m[2], 10) : total - 1;
      if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= total) {
        return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${total}` } });
      }
      end = Math.min(end, total - 1);
      return new Response(toWeb({ start, end }), {
        status: 206,
        headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${total}`, "Content-Length": String(end - start + 1) },
      });
    }
  }
  return new Response(toWeb(), {
    status: 200,
    headers: { ...headers, "Content-Length": String(total) },
  });
}

/** Find ffmpeg/ffprobe: the sidecar folder first, then PATH. */
function findBin(name: "ffmpeg" | "ffprobe"): string {
  const win = process.platform === "win32" ? ".exe" : "";
  for (const dir of ["media-studio/bin", "tools/ffmpeg", "retro/emulators"]) {
    const p = join(ROOT(), dir, name + win);
    if (existsSync(p)) return p;
  }
  return name + win; // fall back to PATH; spawn fails cleanly if absent
}

async function run(cmd: FfCommand): Promise<{ ok: boolean; code: number | null; stdout: string; stderr: string; missing: boolean }> {
  const bin = findBin(cmd.bin);
  const { spawn } = await import("node:child_process");
  return new Promise((res) => {
    let child;
    try {
      child = spawn(bin, cmd.args, { cwd: ROOT() });
    } catch {
      return res({ ok: false, code: null, stdout: "", stderr: "", missing: true });
    }
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => (stdout += d));
    child.stderr?.on("data", (d) => (stderr += d));
    child.on("error", () => res({ ok: false, code: null, stdout, stderr, missing: true }));
    child.on("close", (code) => res({ ok: code === 0, code, stdout, stderr, missing: false }));
  });
}

const NOT_INSTALLED = {
  error: "FFmpeg isn't installed yet.",
  hint: "Run: node scripts/install-media-tools.mjs (stages the official FFmpeg into portable/media-studio/bin), or drop ffmpeg/ffprobe there yourself.",
};

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const fileRel = url.searchParams.get("file");

  // The file (preview) branch also accepts ?token= because media elements
  // can't send an Authorization header; the token is still required + verified.
  const auth = await requireBuilderAdmin(fileRel ? reqWithToken(req, url) : req);
  if (!auth.ok) return auth.response!;
  if (getBuilderStorage().backend !== "fs") return json(501, { error: "The Media Studio runs in local (fs) mode." });

  if (fileRel) return serveFile(fileRel, req);

  // List media under portable/media (NEVER the tax vault). Returns
  // relative paths + the format support level from the data pack.
  const { readdirSync, statSync } = await import("node:fs");
  const { formatFor } = await import("../../../../src/builder/media-studio/formats.ts");
  const mediaRoot = join(ROOT(), "media");
  const files: Array<{ path: string; bytes: number; support: string; kind: string }> = [];
  const walk = (dir: string, rel: string, depth = 0) => {
    if (depth > 4) return;
    let entries: import("node:fs").Dirent[];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const abs = join(dir, e.name);
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) { walk(abs, r, depth + 1); continue; }
      const fmt = formatFor(e.name);
      if (!fmt) continue; // only recognized media
      files.push({ path: `media/${r}`, bytes: statSync(abs).size, support: fmt.support, kind: fmt.kind });
    }
  };
  walk(mediaRoot, "");
  return json(200, { ok: true, files });
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireBuilderAdmin(req);
  if (!auth.ok) return auth.response!;
  if (getBuilderStorage().backend !== "fs") return json(501, { error: "The Media Studio runs in local (fs) mode." });

  let body: { action?: string; path?: string; inSec?: number; outSec?: number; atSec?: number };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Body must be JSON" });
  }
  if (!body.path) return json(400, { error: "Expected { path }" });

  let input: string;
  try {
    input = safePath(body.path);
  } catch (e) {
    return json(400, { error: (e as Error).message });
  }
  if (!existsSync(input)) return json(404, { error: "That media file isn't there.", path: body.path });

  try {
    if (body.action === "probe") {
      const r = await run(probeCmd(input));
      if (r.missing) return json(409, NOT_INSTALLED);
      if (!r.ok) return json(422, { error: "Could not read that file.", detail: r.stderr.slice(0, 300) });
      return json(200, { ok: true, facts: parseProbeJson(r.stdout) });
    }

    if (body.action === "thumbnail") {
      const outRel = `media/thumbnails/${newClipName(body.path, "frame", [], "jpg")}`;
      const out = safePath(outRel);
      await mkdir(join(out, ".."), { recursive: true });
      const r = await run(thumbnailCmd(input, out, body.atSec ?? 1));
      if (r.missing) return json(409, NOT_INSTALLED);
      if (!r.ok) return json(422, { error: "Could not make a thumbnail.", detail: r.stderr.slice(0, 300) });
      return json(200, { ok: true, path: outRel });
    }

    if (body.action === "trim") {
      // Save-as-New-Clip: cut [inSec, outSec] into a NEW file. Original kept.
      if (typeof body.inSec !== "number" || typeof body.outSec !== "number" || body.outSec <= body.inSec) {
        return json(400, { error: "Expected { inSec, outSec } with end after start." });
      }
      const outRel = `media/new-clips/${newClipName(body.path, "trimmed")}`;
      const out = safePath(outRel);
      await mkdir(join(out, ".."), { recursive: true });
      const r = await run(trimCmd(input, out, body.inSec, body.outSec, true));
      if (r.missing) return json(409, NOT_INSTALLED);
      if (!r.ok) return json(422, { error: "Could not save the clip.", detail: r.stderr.slice(0, 300) });
      return json(200, { ok: true, path: outRel, preserved: body.path });
    }

    return json(400, { error: 'Expected action "probe" | "thumbnail" | "trim"' });
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
}
