// ============================================================
// Media library — file-name safety (pure)
// ============================================================
// The naming wall, mirroring storage/paths.ts for documents:
// every media operation goes through these asserts before an
// adapter touches a filesystem or the GitHub API. Media lives in
// EXACTLY ONE directory (public/img/uploads — served by Next in
// fs mode, by the host after a github-mode commit, and copied
// into static/PWA exports), as a single flat segment: no
// subdirectories, no traversal surface at all.
//
// The stored name is always GENERATED here — the visitor-typed
// filename only contributes a sanitized human-readable base; the
// extension comes from the SNIFFED type, never from the name
// (a .png that's really a JPEG is stored as .jpg).
// ============================================================

export const MEDIA_DIR = "public/img/uploads";
export const MEDIA_WEB_PREFIX = "/img/uploads/";

// One flat segment, generated shape, accepted-image extensions only.
const MEDIA_FILE_RE = /^[a-z0-9][a-z0-9-]{0,80}\.(jpg|png|gif|webp)$/;

export class MediaPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaPathError";
  }
}

/** Human-readable base from an original filename: "Mom's Photo (1).JPG" → "moms-photo-1". */
export function sanitizeMediaBase(original: string): string {
  const base = original
    .replace(/\.[A-Za-z0-9]+$/, "") // drop the (untrusted) extension
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics (post-NFKD combining marks)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/, "");
  return base || "image";
}

/** A fresh, collision-proof stored name: <base>-<stamp><nonce>.<sniffed ext>. */
export function newMediaFileName(original: string, ext: string): string {
  const stamp = Date.now().toString(36);
  const nonce = Array.from(globalThis.crypto.getRandomValues(new Uint8Array(3)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${sanitizeMediaBase(original)}-${stamp}${nonce}.${ext}`;
}

/** Gate any client-supplied media name (delete, lookups). */
export function assertMediaFileName(name: string): string {
  if (typeof name !== "string" || !MEDIA_FILE_RE.test(name)) {
    throw new MediaPathError(`Not a valid media file name: "${String(name).slice(0, 60)}"`);
  }
  return name;
}

/** The path a document references (and the browser loads). */
export function mediaWebPath(name: string): string {
  return MEDIA_WEB_PREFIX + assertMediaFileName(name);
}
