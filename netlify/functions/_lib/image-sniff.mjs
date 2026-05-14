// ============================================================
// image-sniff — detect actual image format from leading bytes
// ============================================================
// Upload endpoints accept `contentType` from the browser. A
// curl client can lie ("Content-Type: image/png" on a payload
// that's actually HTML), and downstream readers — including
// any future embed-context that doesn't honor X-Content-Type-
// Options: nosniff — will render the lie as truth. Sniffing
// the magic bytes is a one-line server-side defense.
//
// Returns the detected mime type, or `null` if no known
// signature matches. Callers should reject when the detected
// type doesn't match what the client claimed.
//
// Supports: PNG, JPEG, WEBP. Same set as the upload allow-lists
// in avatar.mjs and admin-order-photo.mjs.
// ============================================================

/**
 * @param {Buffer} bytes — raw decoded payload (NOT base64)
 * @returns {"image/png" | "image/jpeg" | "image/webp" | null}
 */
export function sniffImageType(bytes) {
  if (!bytes || bytes.length < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  // WEBP: RIFF (bytes 0-3) ... WEBP (bytes 8-11)
  if (
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    return "image/webp";
  }

  return null;
}
