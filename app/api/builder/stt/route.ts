// ============================================================
// /api/builder/stt — offline speech-to-text (whisper.cpp sidecar)
// ============================================================
// Powers Communication Coach's optional "offline voice": transcribe
// a short recorded clip ON-DEVICE, no cloud. Admin-gated, fs-mode
// only. Reuses the Media Studio FFmpeg sidecar to convert the
// recording to 16 kHz mono WAV, then runs whisper.cpp. Honest 409s
// when the binary / model / ffmpeg aren't installed. Audio is
// written to a temp file under portable/stt/tmp and deleted after;
// nothing is kept.
// ============================================================

import { join } from "node:path";
import { existsSync } from "node:fs";
import { mkdir, writeFile, rm, readdir } from "node:fs/promises";

import { requireBuilderAdmin } from "../../../../src/builder/server/auth.ts";
import { getBuilderStorage } from "../../../../src/builder/storage/index.ts";
import { toWavArgs, whisperArgs, parseWhisperText } from "../../../../src/builder/coach/stt.ts";

export const dynamic = "force-dynamic";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" } });
}

const ROOT = () => join(process.cwd(), "portable");
const exe = (name: string) => (process.platform === "win32" ? `${name}.exe` : name);

/** Resolve a command: a staged sidecar dir first, then PATH (Linux/Pi). */
function findBin(names: string[], dirs: string[]): string | null {
  for (const dir of dirs) for (const n of names) {
    const p = join(ROOT(), dir, exe(n));
    if (existsSync(p)) return p;
  }
  if (process.platform !== "win32") {
    for (const dir of (process.env.PATH ?? "").split(":")) {
      if (!dir) continue;
      for (const n of names) {
        const p = join(dir, n);
        if (existsSync(p)) return p;
      }
    }
  }
  return null;
}

const findWhisper = () => findBin(["whisper-cli", "whisper", "main"], ["stt/bin"]);
const findFfmpeg = () => findBin(["ffmpeg"], ["media-studio/bin", "tools/ffmpeg"]);

async function stagedModels(): Promise<string[]> {
  try {
    return (await readdir(join(ROOT(), "stt", "models"))).filter((f) => f.endsWith(".bin")).sort();
  } catch {
    return [];
  }
}

async function run(bin: string, args: string[]): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  const { spawn } = await import("node:child_process");
  return new Promise((res) => {
    let child;
    try {
      child = spawn(bin, args, { cwd: ROOT() });
    } catch {
      return res({ ok: false, stdout: "", stderr: "spawn failed" });
    }
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => (stdout += d));
    child.stderr?.on("data", (d) => (stderr += d));
    child.on("error", () => res({ ok: false, stdout, stderr }));
    child.on("close", (code) => res({ ok: code === 0, stdout, stderr }));
  });
}

const MAX_AUDIO_BYTES = 12 * 1024 * 1024; // a short clip, not a recording session

export async function GET(req: Request): Promise<Response> {
  const auth = await requireBuilderAdmin(req);
  if (!auth.ok) return auth.response!;
  if (getBuilderStorage().backend !== "fs") return json(501, { error: "Offline voice runs in local (fs) mode." });
  const models = await stagedModels();
  return json(200, {
    ok: true,
    engineInstalled: !!findWhisper(),
    ffmpegInstalled: !!findFfmpeg(),
    models,
    ready: !!findWhisper() && !!findFfmpeg() && models.length > 0,
  });
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireBuilderAdmin(req);
  if (!auth.ok) return auth.response!;
  if (getBuilderStorage().backend !== "fs") return json(501, { error: "Offline voice runs in local (fs) mode." });

  let body: { audioBase64?: string; ext?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Body must be JSON" });
  }
  if (typeof body.audioBase64 !== "string" || !body.audioBase64) return json(400, { error: "Expected { audioBase64 }" });
  if (body.audioBase64.length > Math.ceil((MAX_AUDIO_BYTES * 4) / 3) + 8) return json(413, { error: "Clip too long — keep Microphone Assist to short snippets." });

  const whisper = findWhisper();
  if (!whisper) return json(409, { error: "The offline voice engine isn't installed.", hint: "Put a whisper binary in portable/stt/bin/ (or on PATH). See scripts/install-stt-tools.mjs." });
  const ffmpeg = findFfmpeg();
  if (!ffmpeg) return json(409, { error: "FFmpeg isn't installed (needed to read the recording).", hint: "Run: node scripts/install-media-tools.mjs" });
  const models = await stagedModels();
  if (models.length === 0) return json(409, { error: "No speech model is installed.", hint: "Run: node scripts/install-stt-tools.mjs (after pinning a model)." });

  let bytes: Buffer;
  try {
    bytes = Buffer.from(body.audioBase64, "base64");
  } catch {
    return json(400, { error: "audioBase64 isn't valid base64" });
  }
  if (bytes.byteLength === 0) return json(400, { error: "Empty clip" });
  if (bytes.byteLength > MAX_AUDIO_BYTES) return json(413, { error: "Clip too large." });

  const safeExt = /^[a-z0-9]{1,5}$/i.test(body.ext ?? "") ? (body.ext as string).toLowerCase() : "webm";
  const tmpDir = join(ROOT(), "stt", "tmp");
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const inPath = join(tmpDir, `${id}.${safeExt}`);
  const wavPath = join(tmpDir, `${id}.wav`);
  try {
    await mkdir(tmpDir, { recursive: true });
    await writeFile(inPath, bytes);
    const conv = await run(ffmpeg, toWavArgs(inPath, wavPath));
    if (!conv.ok || !existsSync(wavPath)) return json(422, { error: "Could not read that recording.", detail: conv.stderr.slice(0, 200) });
    const tr = await run(whisper, whisperArgs(join(ROOT(), "stt", "models", models[0]), wavPath));
    if (!tr.ok) return json(422, { error: "Transcription failed.", detail: tr.stderr.slice(0, 200) });
    return json(200, { ok: true, text: parseWhisperText(tr.stdout), model: models[0] });
  } catch (e) {
    return json(500, { error: (e as Error).message });
  } finally {
    // Never keep audio: delete both temp files.
    await rm(inPath, { force: true }).catch(() => {});
    await rm(wavPath, { force: true }).catch(() => {});
  }
}
