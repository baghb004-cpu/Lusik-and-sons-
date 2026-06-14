// ============================================================
// /api/builder/seo — in-builder SEO quick-check (admin, fs-mode)
// ============================================================
// The instant counterpart to scripts/seo-audit.mjs: renders the
// open page to its exact export HTML in memory and runs the same
// ruleset, so the editor can show live scores + a to-do list
// without exporting first. The CLI (run over a real export
// folder) stays the accurate one — it can size the actual CSS/JS/
// image files on disk; this quick-check sees only the HTML.
// ============================================================

import { requireBuilderAdmin } from "../../../../src/builder/server/auth.ts";
import { getBuilderStorage } from "../../../../src/builder/storage/index.ts";
import { renderSinglePageHtml } from "../../../../src/builder/export/exporter.ts";
import { extractFacts } from "../../../../src/builder/seo/facts.ts";
import { auditPage } from "../../../../src/builder/seo/rules.ts";
import { CATALOG } from "../../../../src/data/catalog.js";
import { CMS_PAGES } from "../../../../src/data/pagesData.generated.js";
import type { CatalogSnapshot } from "../../../../src/builder/engine/commerce.ts";

export const dynamic = "force-dynamic";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" } });
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireBuilderAdmin(req);
  if (!auth.ok) return auth.response!;
  if (getBuilderStorage().backend !== "fs") return json(501, { error: "The SEO quick-check runs in local mode" });

  let body: { slug?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Body must be JSON" });
  }
  if (!body.slug) return json(400, { error: "Expected { slug }" });

  const catalog = Object.fromEntries(
    Object.entries(CATALOG as Record<string, { products: CatalogSnapshot[string] }>).map(([cat, c]) => [cat, c.products])
  ) as CatalogSnapshot;
  const featured = (CMS_PAGES as { home?: { featured?: { category: string; slug: string } } }).home?.featured;

  const rendered = await renderSinglePageHtml(
    getBuilderStorage(),
    body.slug,
    catalog,
    featured ? { featured: `${featured.category}/${featured.slug}` } : undefined,
    "Lusik & Sons"
  );
  if ("error" in rendered) return json(404, rendered);

  const facts = extractFacts(`${body.slug}.html`, rendered.html);
  const report = auditPage(facts);
  return json(200, {
    ok: true,
    report,
    note: "Live quick-check from the page HTML. For the exact Performance score (with real image/CSS sizes), export the site and run: node scripts/seo-audit.mjs <export-folder> — then confirm Core Web Vitals at pagespeed.web.dev.",
  });
}
