// ============================================================
// Builder storage — document path safety
// ============================================================
// Every storage operation goes through these asserts. Builder
// documents live ONLY under builder/**.json; anything else —
// traversal, absolute paths, non-JSON, weird characters — is
// rejected before an adapter ever touches a filesystem or the
// GitHub API. This is the server-side wall between "the editor
// can save documents" and "the editor can write files".
// ============================================================

export const DOC_ROOT = "builder";

const SEGMENT_RE = /^[a-z0-9][a-z0-9._-]*$/;

export class DocPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocPathError";
  }
}

function checkSegments(path: string, label: string): string[] {
  if (typeof path !== "string" || path.length === 0 || path.length > 300) {
    throw new DocPathError(`${label} must be a short repo-relative path`);
  }
  if (path.includes("\\") || path.startsWith("/") || path.includes("//")) {
    throw new DocPathError(`${label} must be repo-relative with forward slashes`);
  }
  const segments = path.split("/");
  for (const seg of segments) {
    if (seg === "." || seg === ".." || !SEGMENT_RE.test(seg)) {
      throw new DocPathError(`${label} contains an invalid segment: "${seg}"`);
    }
  }
  if (segments[0] !== DOC_ROOT) {
    throw new DocPathError(`${label} must live under ${DOC_ROOT}/`);
  }
  return segments;
}

/** A readable/writable document: builder/**.json */
export function assertDocPath(path: string): string {
  const segments = checkSegments(path, "Document path");
  if (segments.length < 2 || !segments[segments.length - 1].endsWith(".json")) {
    throw new DocPathError("Document path must point at a .json file under builder/");
  }
  return path;
}

/** A listable directory: builder or builder/sub/dir */
export function assertDocDir(dir: string): string {
  checkSegments(dir, "Directory");
  return dir;
}
