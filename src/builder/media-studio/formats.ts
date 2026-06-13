// ============================================================
// Media Studio — the offline format & support data pack (§26)
// ============================================================
// "The app should not need the internet to explain what a file
// type is or how to export." This is that built-in knowledge:
// every format with an HONEST support level, plus the export
// presets (website/app/social/general). Pure data — the UI and
// the FFmpeg layer read from it; a test keeps it coherent.
// ============================================================

import type { ExportPreset } from "./schemas.ts";

// What the studio can actually do with a format, stated plainly.
export type SupportLevel =
  | "full" // import + edit + export
  | "import-only" // can bring in / use, can't export to it
  | "export-only"
  | "preview-only" // can show, not edit
  | "requires-component" // needs an optional codec/tool the user adds
  | "unsupported"; // recognized but not handled — say so

export interface FormatInfo {
  ext: string;
  kind: "photo" | "video" | "audio" | "subtitle";
  support: SupportLevel;
  note?: string;
}

// Honest defaults for an LGPL-FFmpeg + Sharp build (see plan §26 §5).
export const FORMATS: FormatInfo[] = [
  // photos — the everyday set is full; pro/RAW need an optional component
  { ext: "jpg", kind: "photo", support: "full" },
  { ext: "jpeg", kind: "photo", support: "full" },
  { ext: "png", kind: "photo", support: "full" },
  { ext: "webp", kind: "photo", support: "full" },
  { ext: "avif", kind: "photo", support: "full" },
  { ext: "gif", kind: "photo", support: "full" },
  { ext: "bmp", kind: "photo", support: "full" },
  { ext: "tif", kind: "photo", support: "full" },
  { ext: "tiff", kind: "photo", support: "full" },
  { ext: "heic", kind: "photo", support: "requires-component", note: "iPhone photos — needs the HEIF component; convert to JPG/WebP on import." },
  { ext: "heif", kind: "photo", support: "requires-component", note: "Same family as HEIC." },
  { ext: "dng", kind: "photo", support: "preview-only", note: "Camera RAW — preview now; full RAW development is a later phase." },
  { ext: "psd", kind: "photo", support: "import-only", note: "Flattened import only — layers aren't read." },
  { ext: "svg", kind: "photo", support: "preview-only", note: "Vector — preview/rasterize; editing vectors is out of scope." },
  // video — permissive containers/codecs full; H.264/HEVC depend on the build
  { ext: "mp4", kind: "video", support: "full", note: "Export uses an open codec by default; H.264 depends on your build (see help)." },
  { ext: "webm", kind: "video", support: "full", note: "VP9/AV1 + Opus — fully open, the safe default." },
  { ext: "mov", kind: "video", support: "full" },
  { ext: "mkv", kind: "video", support: "full" },
  { ext: "avi", kind: "video", support: "import-only" },
  { ext: "gif", kind: "video", support: "export-only", note: "Short silent clips → animated GIF." },
  { ext: "m4v", kind: "video", support: "import-only" },
  { ext: "mts", kind: "video", support: "import-only" },
  { ext: "wmv", kind: "video", support: "import-only" },
  { ext: "braw", kind: "video", support: "requires-component", note: "Blackmagic RAW — needs the vendor SDK; not bundled." },
  { ext: "r3d", kind: "video", support: "requires-component", note: "RED RAW — vendor SDK; not bundled." },
  // audio — the common set is full
  { ext: "wav", kind: "audio", support: "full" },
  { ext: "mp3", kind: "audio", support: "full" },
  { ext: "m4a", kind: "audio", support: "full", note: "iPhone Voice Memos are usually .m4a." },
  { ext: "aac", kind: "audio", support: "full" },
  { ext: "flac", kind: "audio", support: "full" },
  { ext: "ogg", kind: "audio", support: "full" },
  { ext: "opus", kind: "audio", support: "full" },
  { ext: "aiff", kind: "audio", support: "full" },
  { ext: "caf", kind: "audio", support: "import-only", note: "Some iPhone recordings — converted on import." },
  { ext: "amr", kind: "audio", support: "import-only", note: "Older phone recordings — converted on import." },
  { ext: "wma", kind: "audio", support: "import-only" },
  // subtitles
  { ext: "srt", kind: "subtitle", support: "full" },
  { ext: "vtt", kind: "subtitle", support: "full" },
  { ext: "ass", kind: "subtitle", support: "import-only" },
];

const byExt = new Map(FORMATS.map((f) => [f.ext, f]));
export function formatFor(filename: string): FormatInfo | null {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  return byExt.get(ext) ?? null;
}
export function isImportable(filename: string): boolean {
  const f = formatFor(filename);
  return !!f && f.support !== "unsupported";
}

// Phone-recorder formats the import flow highlights (plan §16).
export const PHONE_AUDIO_EXTS = ["m4a", "aac", "mp3", "wav", "caf", "aiff", "aif", "flac", "ogg", "opus", "amr", "3gp", "3gpp"];

// ── export presets ──────────────────────────────────────────
export const EXPORT_PRESETS: ExportPreset[] = [
  // website
  { id: "web-hero", label: "Website hero image", category: "website", mediaType: "image", width: 1920, height: 1080, format: "webp", note: "Big banner image, web-optimized." },
  { id: "web-product", label: "Product photo (large)", category: "website", mediaType: "image", width: 1200, height: 1200, format: "webp" },
  { id: "web-thumb", label: "Product thumbnail", category: "website", mediaType: "image", width: 400, height: 400, format: "webp" },
  { id: "web-transparent", label: "Transparent cutout", category: "website", mediaType: "image", width: 1200, height: 1200, format: "png", note: "Keeps a see-through background." },
  { id: "web-video", label: "Website video", category: "website", mediaType: "video", width: 1280, height: 720, format: "webm" },
  // mobile app
  { id: "app-icon", label: "App icon", category: "mobile-app", mediaType: "image", width: 1024, height: 1024, format: "png" },
  { id: "app-splash", label: "Splash screen", category: "mobile-app", mediaType: "image", width: 1242, height: 2688, format: "png" },
  // social
  { id: "ig-post", label: "Square post", category: "social", mediaType: "image", width: 1080, height: 1080, format: "jpg" },
  { id: "ig-story", label: "Vertical story", category: "social", mediaType: "image", width: 1080, height: 1920, format: "jpg" },
  { id: "reel", label: "Vertical video", category: "social", mediaType: "video", width: 1080, height: 1920, format: "mp4" },
  { id: "yt-thumb", label: "Video thumbnail", category: "social", mediaType: "image", width: 1280, height: 720, format: "jpg" },
  { id: "yt-1080", label: "Landscape video 1080p", category: "social", mediaType: "video", width: 1920, height: 1080, format: "mp4" },
  // general
  { id: "jpg-hq", label: "JPG (high quality)", category: "general", mediaType: "image", format: "jpg" },
  { id: "webp-web", label: "WebP (web optimized)", category: "general", mediaType: "image", format: "webp" },
  { id: "avif-web", label: "AVIF (smallest)", category: "general", mediaType: "image", format: "avif" },
  { id: "png-transparent", label: "PNG (transparent)", category: "general", mediaType: "image", format: "png" },
  { id: "tiff-print", label: "TIFF (print/archive)", category: "general", mediaType: "image", format: "tiff" },
  { id: "audio-wav", label: "Audio only (WAV)", category: "general", mediaType: "audio", format: "wav" },
  { id: "audio-mp3", label: "Audio only (MP3)", category: "general", mediaType: "audio", format: "mp3" },
];

export const ASPECT_RATIOS = [
  { id: "1-1", label: "Square (1:1)", w: 1, h: 1 },
  { id: "4-5", label: "Portrait (4:5)", w: 4, h: 5 },
  { id: "9-16", label: "Vertical / Story (9:16)", w: 9, h: 16 },
  { id: "16-9", label: "Widescreen (16:9)", w: 16, h: 9 },
  { id: "3-2", label: "Photo (3:2)", w: 3, h: 2 },
  { id: "4-3", label: "Classic (4:3)", w: 4, h: 3 },
];
