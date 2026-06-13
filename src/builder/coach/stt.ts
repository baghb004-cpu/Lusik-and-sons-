// ============================================================
// Communication Coach — offline speech-to-text helpers (pure)
// ============================================================
// The Microphone Assist "offline voice" path runs a local whisper.cpp
// sidecar (a standalone binary + a small GGML model) — no cloud, no
// API. These are the pure pieces the API route composes + tests pin:
// the argv for converting audio to 16 kHz mono WAV (via the existing
// FFmpeg sidecar) and for running whisper, plus a transcript cleaner.
// ============================================================

/** FFmpeg argv: any recorded audio → 16 kHz mono WAV (what whisper wants). */
export function toWavArgs(inputPath: string, wavPath: string): string[] {
  return ["-y", "-i", inputPath, "-ar", "16000", "-ac", "1", "-f", "wav", wavPath];
}

/** whisper.cpp argv: transcribe a WAV with a model, English, no timestamps. */
export function whisperArgs(modelPath: string, wavPath: string): string[] {
  return ["-m", modelPath, "-f", wavPath, "-l", "en", "-nt"];
}

// Markers whisper emits for non-speech — dropped from the clean transcript.
const NOISE = /^\s*[([](blank_audio|silence|music|inaudible|no speech)[)\]]\s*$/i;

/** Turn whisper-cli stdout into a clean one-line transcript. Strips any
 *  `[hh:mm:ss --> …]` timestamps, progress/log lines, and noise markers. */
export function parseWhisperText(raw: string): string {
  const out: string[] = [];
  for (const lineRaw of raw.split(/\r?\n/)) {
    let line = lineRaw.replace(/\[\d{2}:\d{2}:\d{2}(?:\.\d{3})?\s*-->\s*\d{2}:\d{2}:\d{2}(?:\.\d{3})?\]/g, "").trim();
    if (!line) continue;
    if (NOISE.test(line)) continue;
    // whisper-cli prints config/log lines like "whisper_init..." — skip those.
    if (/^(whisper_|main:|system_info|ggml_|load time|sample time|encode time|decode time|total time)/i.test(line)) continue;
    out.push(line);
  }
  return out.join(" ").replace(/\s+/g, " ").trim();
}
