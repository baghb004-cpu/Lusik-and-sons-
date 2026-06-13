// ============================================================
// Media Studio — FFmpeg/FFprobe argv composers (pure, §26)
// ============================================================
// Builds the {bin, args[]} the API spawns — NEVER a shell string,
// so a filename like "my clip; rm -rf" is just an argument (same
// safety rule as the Retro launch composer). Pure + unit-tested;
// the actual binary runs on the user's machine (the sidecar). All
// paths are resolved/contained by the caller before spawning.
// ============================================================

export interface FfCommand {
  bin: "ffmpeg" | "ffprobe";
  args: string[];
}

/** Inspect a media file → JSON on stdout (format + streams). */
export function probeCmd(input: string): FfCommand {
  return {
    bin: "ffprobe",
    args: ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", "-i", input],
  };
}

/** A single thumbnail at `atSec` → an image file. */
export function thumbnailCmd(input: string, output: string, atSec = 1, width = 480): FfCommand {
  return {
    bin: "ffmpeg",
    args: ["-y", "-ss", String(atSec), "-i", input, "-frames:v", "1", "-vf", `scale=${width}:-1`, output],
  };
}

/** Extract the exact frame at `atSec` as a still image (full resolution). */
export function extractFrameCmd(input: string, output: string, atSec: number): FfCommand {
  return { bin: "ffmpeg", args: ["-y", "-ss", String(atSec), "-i", input, "-frames:v", "1", output] };
}

/** A mono PCM dump for drawing a waveform (small, fast to read). */
export function waveformCmd(input: string, output: string): FfCommand {
  return {
    bin: "ffmpeg",
    args: ["-y", "-i", input, "-ac", "1", "-filter:a", "aresample=8000", "-map", "0:a", "-c:a", "pcm_s16le", "-f", "data", output],
  };
}

/** Trim [inSec, outSec] into a NEW file, copying streams (fast, lossless)
 *  when `reencode` is false, or re-encoding for frame-accurate cuts. */
export function trimCmd(input: string, output: string, inSec: number, outSec: number, reencode = false): FfCommand {
  const dur = Math.max(0, outSec - inSec);
  const base = ["-y", "-ss", String(inSec), "-i", input, "-t", String(dur)];
  return {
    bin: "ffmpeg",
    args: reencode ? [...base, output] : [...base, "-c", "copy", output],
  };
}

/** Pull just the audio out of a video into a new audio file. */
export function detachAudioCmd(input: string, output: string): FfCommand {
  return { bin: "ffmpeg", args: ["-y", "-i", input, "-vn", output] };
}

/** Resize/convert an image to a preset box + format (web/app/social). */
export function imageExportCmd(input: string, output: string, width?: number, height?: number): FfCommand {
  const scale = width && height ? `scale=${width}:${height}:force_original_aspect_ratio=decrease` : width ? `scale=${width}:-1` : "scale=iw:ih";
  return { bin: "ffmpeg", args: ["-y", "-i", input, "-vf", scale, output] };
}

/** Transcode a video to a target box + container (the export presets). */
export function videoExportCmd(input: string, output: string, width?: number, height?: number): FfCommand {
  const args = ["-y", "-i", input];
  if (width && height) args.push("-vf", `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`);
  args.push(output);
  return { bin: "ffmpeg", args };
}

/** Parse the JSON ffprobe emits into the MediaItem facts we store. */
export function parseProbeJson(json: string): {
  container?: string; codec?: string; durationSec?: number;
  width?: number; height?: number; frameRate?: number; sampleRate?: number; channels?: number;
} {
  let data: { format?: { format_name?: string; duration?: string }; streams?: Array<Record<string, unknown>> };
  try {
    data = JSON.parse(json);
  } catch {
    return {};
  }
  const streams = data.streams ?? [];
  const v = streams.find((s) => s.codec_type === "video");
  const a = streams.find((s) => s.codec_type === "audio");
  const fps = (() => {
    const r = String(v?.r_frame_rate ?? "");
    const [n, d] = r.split("/").map(Number);
    return n && d ? Math.round((n / d) * 100) / 100 : undefined;
  })();
  return {
    container: data.format?.format_name?.split(",")[0],
    codec: String((v ?? a)?.codec_name ?? "") || undefined,
    durationSec: data.format?.duration ? Math.round(Number(data.format.duration) * 100) / 100 : undefined,
    width: v?.width ? Number(v.width) : undefined,
    height: v?.height ? Number(v.height) : undefined,
    frameRate: fps,
    sampleRate: a?.sample_rate ? Number(a.sample_rate) : undefined,
    channels: a?.channels ? Number(a.channels) : undefined,
  };
}
