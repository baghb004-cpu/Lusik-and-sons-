// ============================================================
// /api/builder/media — the media library (admin-gated)
// ============================================================
// GET                          → { backend, files: [{name, path, size}] }
// POST { name, dataBase64 }    → sniffs + stores → { ok, file }
// DELETE ?name=                → removes
//
// The same wall philosophy as /docs: the API, not the UI, is the
// gate. An upload is accepted only if its BYTES sniff as
// JPEG/PNG/GIF/WebP (SVG rejected — script container), it's under
// the size cap, and its stored name is generated server-side
// (sanitized base + nonce, extension from the sniff). fs mode
// serves the file immediately from public/img/uploads; github
// mode commits it (it serves after the gated deploy).
// ============================================================

import { requireBuilderAdmin } from "../../../../src/builder/server/auth.ts";
import {
  getMediaStore,
  sniffImage,
  newMediaFileName,
  assertMediaFileName,
  MediaPathError,
  MAX_MEDIA_BYTES,
} from "../../../../src/builder/media/index.ts";

export const dynamic = "force-dynamic";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" },
  });
}

function handleError(err: unknown): Response {
  if (err instanceof MediaPathError) return json(400, { error: err.message });
  return json(500, { error: err instanceof Error ? err.message : "Media operation failed" });
}

export async function GET(req: Request): Promise<Response> {
  const auth = await requireBuilderAdmin(req);
  if (!auth.ok) return auth.response!;
  try {
    const store = getMediaStore();
    return json(200, { backend: store.backend, files: await store.list() });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireBuilderAdmin(req);
  if (!auth.ok) return auth.response!;

  let body: { name?: string; dataBase64?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Body must be JSON" });
  }
  if (typeof body.name !== "string" || typeof body.dataBase64 !== "string") {
    return json(400, { error: "Expected { name, dataBase64 }" });
  }
  // Cap before decoding: base64 inflates bytes ×4/3.
  if (body.dataBase64.length > Math.ceil((MAX_MEDIA_BYTES * 4) / 3) + 4) {
    return json(413, { error: `Image too large — the cap is ${MAX_MEDIA_BYTES / 1024 / 1024} MB` });
  }

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(Buffer.from(body.dataBase64, "base64"));
  } catch {
    return json(400, { error: "dataBase64 is not valid base64" });
  }
  if (bytes.byteLength === 0) return json(400, { error: "Empty file" });
  if (bytes.byteLength > MAX_MEDIA_BYTES) {
    return json(413, { error: `Image too large — the cap is ${MAX_MEDIA_BYTES / 1024 / 1024} MB` });
  }

  const sniffed = sniffImage(bytes);
  if (!sniffed) {
    return json(422, {
      error: "Not a supported image — the bytes must be JPEG, PNG, GIF or WebP (SVG is not accepted)",
    });
  }

  try {
    const store = getMediaStore();
    const file = await store.save(newMediaFileName(body.name, sniffed.ext), bytes);
    return json(200, { ok: true, backend: store.backend, file });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: Request): Promise<Response> {
  const auth = await requireBuilderAdmin(req);
  if (!auth.ok) return auth.response!;
  const name = new URL(req.url).searchParams.get("name");
  if (!name) return json(400, { error: "Expected ?name=" });
  try {
    const store = getMediaStore();
    await store.remove(assertMediaFileName(name));
    return json(200, { ok: true, name });
  } catch (err) {
    return handleError(err);
  }
}
