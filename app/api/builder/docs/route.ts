// ============================================================
// /api/builder/docs — the document API behind the builder shell
// ============================================================
// GET    ?dir=builder/pages      → { files: [...] }
// GET    ?path=builder/pages/x.json → { path, content }
// POST   { path, content, message? } → validates, then writes
// DELETE ?path=...               → removes
//
// Admin-gated (Identity admin or BUILDER_LOCAL_TOKEN — see
// src/builder/server/auth.ts). Every write is schema-validated
// for its document family first: malformed or unsafe documents
// get a 422 with the issue list and never reach storage. This is
// the same publish-gate philosophy as the trusted-products check:
// the API, not the UI, is the wall.
// ============================================================

import { requireBuilderAdmin } from "../../../../src/builder/server/auth.ts";
import { getBuilderStorage, DocPathError } from "../../../../src/builder/storage/index.ts";
import { validateDocument } from "../../../../src/builder/server/validateDoc.ts";

export const dynamic = "force-dynamic";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" },
  });
}

async function guard(req: Request): Promise<Response | null> {
  const auth = await requireBuilderAdmin(req);
  return auth.ok ? null : auth.response!;
}

export async function GET(req: Request): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  const url = new URL(req.url);
  const path = url.searchParams.get("path");
  const dir = url.searchParams.get("dir");
  try {
    const storage = getBuilderStorage();
    if (path) {
      const content = await storage.read(path);
      if (content === null) return json(404, { error: "Not found", path });
      return json(200, { path, content: JSON.parse(content) });
    }
    const files = await storage.list(dir || "builder");
    return json(200, { backend: storage.backend, files });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  let body: { path?: string; content?: unknown; message?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Body must be JSON" });
  }
  if (!body.path || body.content === undefined) {
    return json(400, { error: "Expected { path, content, message? }" });
  }
  try {
    const issues = await validateDocument(body.path, body.content);
    if (issues.length > 0) {
      return json(422, { error: "Document failed validation", issues });
    }
    const storage = getBuilderStorage();
    const message = body.message || `builder: update ${body.path}`;
    await storage.write(body.path, JSON.stringify(body.content, null, 2) + "\n", message);
    return json(200, { ok: true, path: body.path, backend: storage.backend });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: Request): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  const path = new URL(req.url).searchParams.get("path");
  if (!path) return json(400, { error: "Expected ?path=" });
  try {
    const storage = getBuilderStorage();
    await storage.remove(path, `builder: delete ${path}`);
    return json(200, { ok: true, path });
  } catch (err) {
    return handleError(err);
  }
}

function handleError(err: unknown): Response {
  if (err instanceof DocPathError) return json(400, { error: err.message });
  console.error("[builder/docs]", err);
  return json(500, { error: "Storage operation failed" });
}
