// POST /api/builder/export { target: "static" | "next" }
// Admin-gated. fs-mode/local-first (plan §11): exports run where the
// files live; on a github-backed hosted deployment this returns 501
// until Phase 12's download flow.

import { join } from "node:path";
import { requireBuilderAdmin } from "../../../../src/builder/server/auth.ts";
import { getBuilderStorage } from "../../../../src/builder/storage/index.ts";
import { runExport } from "../../../../src/builder/export/exporter.ts";
import { CATALOG } from "../../../../src/data/catalog.js";
import { CMS_PAGES } from "../../../../src/data/pagesData.generated.js";
import type { CatalogSnapshot } from "../../../../src/builder/engine/commerce.ts";

export const dynamic = "force-dynamic";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" },
  });
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireBuilderAdmin(req);
  if (!auth.ok) return auth.response!;

  let body: { target?: string; download?: boolean };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Body must be JSON" });
  }
  if (!["static", "next", "pwa", "swiftui"].includes(body.target ?? "")) {
    return json(400, { error: 'Expected { target: "static" | "next" | "pwa" | "swiftui", download?: boolean }' });
  }

  const storage = getBuilderStorage();
  if (storage.backend !== "fs") {
    return json(501, { error: "Exports run in local mode (fs storage) for now — hosted download lands with Phase 12" });
  }

  const catalog = Object.fromEntries(
    Object.entries(CATALOG as Record<string, { products: CatalogSnapshot[string] }>).map(([cat, c]) => [cat, c.products])
  ) as CatalogSnapshot;
  const featured = (CMS_PAGES as { home?: { featured?: { category: string; slug: string } } }).home?.featured;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir = join(process.cwd(), "exports", `${stamp}-${body.target}`);

  try {
    const result = await runExport({
      storage,
      target: body.target as "static" | "next" | "pwa" | "swiftui",
      outDir,
      catalog,
      cms: { featured: featured ? `${featured.category}/${featured.slug}` : undefined },
      siteName: "Lusik & Sons",
      webBaseURL: process.env.URL || "https://lusikandsons.com",
    });
    // ZIP download (static/pwa — their file lists are fully materialized).
    if (body.download && body.target !== "next") {
      const { readFile } = await import("node:fs/promises");
      const { zipFiles } = await import("../../../../src/builder/server/zip.ts");
      const entries = [];
      for (const rel of [...result.files, "manifest.json"]) {
        if (rel.includes("**")) continue;
        entries.push({ path: rel, content: await readFile(join(outDir, rel), "utf8") });
      }
      const zip = await zipFiles([...new Map(entries.map((e) => [e.path, e])).values()]);
      return new Response(new Uint8Array(zip), {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="site-export-${stamp}.zip"`,
        },
      });
    }
    return json(200, result);
  } catch (err) {
    console.error("[builder/export]", err);
    return json(500, { error: err instanceof Error ? err.message : "Export failed" });
  }
}
