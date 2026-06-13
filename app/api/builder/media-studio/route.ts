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
  const auth = await requireBuilderAdmin(req);
  if (!auth.ok) return auth.response!;
  if (getBuilderStorage().backend !== "fs") return json(501, { error: "The Media Studio runs in local (fs) mode." });
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
