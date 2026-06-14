"use client";

// Browser client for the offline speech-to-text sidecar (/api/builder/stt).
// Uses the Workshop launcher's admin token (same #token scheme as the other
// tools). When the sidecar isn't present/reachable, callers fall back to the
// browser's built-in recognition or to typing.

const TOKEN_KEY = "lusik_builder_local_token";
const token = () => (typeof sessionStorage !== "undefined" && sessionStorage.getItem(TOKEN_KEY)) || "";

export interface SttStatus {
  ready: boolean;
  engineInstalled: boolean;
  ffmpegInstalled: boolean;
  models: string[];
}

/** Is the on-device engine + a model staged and runnable? null = not reachable. */
export async function sttStatus(): Promise<SttStatus | null> {
  try {
    const r = await fetch("/api/builder/stt", { headers: { Authorization: `Bearer ${token()}` } });
    if (!r.ok) return null;
    return (await r.json()) as SttStatus;
  } catch {
    return null;
  }
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(bin);
}

/** Transcribe a recorded audio blob on-device. Throws with a friendly message. */
export async function transcribeBlob(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const type = blob.type || "";
  const ext = type.includes("webm") ? "webm" : type.includes("ogg") ? "ogg" : type.includes("mp4") ? "mp4" : type.includes("wav") ? "wav" : "webm";
  const r = await fetch("/api/builder/stt", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
    body: JSON.stringify({ audioBase64: toBase64(bytes), ext }),
  });
  const body = await r.json().catch(() => null);
  if (!r.ok) throw new Error(body?.hint ? `${body.error} ${body.hint}` : body?.error || "Transcription failed.");
  return (body?.text as string) ?? "";
}
