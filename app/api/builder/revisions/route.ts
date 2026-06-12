// GET /api/builder/revisions?path=…        → commit history for a document
// GET /api/builder/revisions?path=…&sha=…  → that document at that revision
// Admin-gated. Restores happen by loading old content into the editor and
// saving through the normal gate — never a direct write here.

import { requireBuilderAdmin } from "../../../../src/builder/server/auth.ts";
import { getRevisionSource } from "../../../../src/builder/storage/revisions.ts";
import { DocPathError } from "../../../../src/builder/storage/paths.ts";

export const dynamic = "force-dynamic";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" },
  });
}

export async function GET(req: Request): Promise<Response> {
  const auth = await requireBuilderAdmin(req);
  if (!auth.ok) return auth.response!;
  const url = new URL(req.url);
  const path = url.searchParams.get("path");
  const sha = url.searchParams.get("sha");
  if (!path) return json(400, { error: "Expected ?path=" });
  try {
    const source = getRevisionSource();
    if (sha) {
      const content = await source.read(path, sha);
      if (content === null) return json(404, { error: "Revision not found" });
      return json(200, { path, sha, content: JSON.parse(content) });
    }
    return json(200, { path, revisions: await source.list(path) });
  } catch (err) {
    if (err instanceof DocPathError) return json(400, { error: err.message });
    console.error("[builder/revisions]", err);
    return json(500, { error: "History lookup failed" });
  }
}
