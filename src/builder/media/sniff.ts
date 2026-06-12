// ============================================================
// Media library — image sniffing (magic bytes, pure)
// ============================================================
// The upload gate's first wall: a file is an image because its
// BYTES say so, never because its filename or Content-Type does.
// Same philosophy as the live site's avatar gate
// (netlify/functions/_lib/image-sniff.mjs), reimplemented here
// because the builder must run standalone on a thumb drive.
//
// Accepted: JPEG, PNG, GIF, WebP — the formats every browser
// renders and no browser executes. SVG is DELIBERATELY rejected:
// it's a script container (onload=, <script>) and a media library
// that round-trips visitor-facing markup must not accept it.
// ============================================================

export interface SniffedImage {
  mime: string;
  ext: "jpg" | "png" | "gif" | "webp";
}

/** Hard cap on a single upload (decoded bytes). */
export const MAX_MEDIA_BYTES = 8 * 1024 * 1024; // 8 MB

const ascii = (bytes: Uint8Array, start: number, text: string): boolean => {
  if (bytes.length < start + text.length) return false;
  for (let i = 0; i < text.length; i++) {
    if (bytes[start + i] !== text.charCodeAt(i)) return false;
  }
  return true;
};

/** Identify an image by magic bytes, or null if it isn't one we accept. */
export function sniffImage(bytes: Uint8Array): SniffedImage | null {
  if (bytes.length < 12) return null;
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return { mime: "image/png", ext: "png" };
  }
  // GIF: "GIF87a" or "GIF89a"
  if (ascii(bytes, 0, "GIF87a") || ascii(bytes, 0, "GIF89a")) {
    return { mime: "image/gif", ext: "gif" };
  }
  // WebP: "RIFF" .... "WEBP"
  if (ascii(bytes, 0, "RIFF") && ascii(bytes, 8, "WEBP")) {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}
