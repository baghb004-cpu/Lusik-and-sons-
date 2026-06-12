// GET  /api/builder/backup           → zip of every document (both modes)
// POST /api/builder/backup (zip body) → ALL-OR-NOTHING restore through the
//                                       same validation gates as manual saves
// Admin-gated.

import { requireBuilderAdmin } from "../../../../src/builder/server/auth.ts";
import { getBuilderStorage } from "../../../../src/builder/storage/index.ts";
import { collectAllDocs, restoreDocs } from "../../../../src/builder/server/backup.ts";
import { zipFiles, unzipFiles } from "../../../../src/builder/server/zip.ts";

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
  try {
    const storage = getBuilderStorage();
    const docs = await collectAllDocs(storage);
    const manifest = {
      format: "lusik-builder-backup",
      createdAt: new Date().toISOString(),
      backend: storage.backend,
      documents: docs.length,
    };
    const zip = await zipFiles([...docs, { path: "backup-manifest.json", content: JSON.stringify(manifest, null, 2) }]);
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(new Uint8Array(zip), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="builder-backup-${stamp}.zip"`,
      },
    });
  } catch (err) {
    console.error("[builder/backup]", err);
    return json(500, { error: "Backup failed" });
  }
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireBuilderAdmin(req);
  if (!auth.ok) return auth.response!;
  try {
    const body = await req.arrayBuffer();
    if (body.byteLength === 0) return json(400, { error: "Expected a zip file body" });
    if (body.byteLength > 50 * 1024 * 1024) return json(413, { error: "Backup too large (50 MB cap)" });
    const entries = await unzipFiles(body);
    const report = await restoreDocs(getBuilderStorage(), entries);
    return json(report.ok ? 200 : 422, report);
  } catch (err) {
    console.error("[builder/restore]", err);
    return json(400, { error: "Could not read that zip" });
  }
}
