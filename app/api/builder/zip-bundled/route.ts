// GET /api/builder/zip-bundled?states=CA,NV[&prefixes=906,907]
// Returns a ready-to-save zip-places DATASET DOCUMENT built from the
// repo's bundled BSD-licensed data (the same 42.5k-ZIP file the live
// checkout's zip-lookup Function serves), trimmed to the requested
// coverage. Trimming is REQUIRED — the full national set belongs behind
// a server route, not inside a git-tracked document (plan §14).
// Admin-gated; the manifest arrives prefilled with honest attribution.

import { requireBuilderAdmin } from "../../../../src/builder/server/auth.ts";
import { trimEntries } from "../../../../src/builder/data/index.ts";
import type { ZipPlace } from "../../../../src/builder/data/index.ts";
// Bundled, redistributable data (BSD `zipcodes` package — see
// scripts/gen-zip-places.mjs for the provenance chain).
import PLACES from "../../../../netlify/functions/_data/zip-places.json";

export const dynamic = "force-dynamic";

const MAX_ENTRIES = 8000; // a state or a few prefixes, not the nation

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
  const states = (url.searchParams.get("states") ?? "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  const prefixes = (url.searchParams.get("prefixes") ?? "").split(",").map((s) => s.trim()).filter((p) => /^\d{1,5}$/.test(p));
  if (states.length === 0 && prefixes.length === 0) {
    return json(400, { error: "Trim required: pass ?states=CA[,NV] and/or ?prefixes=906,907" });
  }

  const all: ZipPlace[] = Object.entries(PLACES as unknown as Record<string, [string, string]>).map(([zip, [city, state]]) => ({
    zip,
    city,
    state,
    alternates: [],
  }));
  const entries = trimEntries(all, { states, prefixes });
  if (entries.length === 0) return json(404, { error: "No ZIPs match that trim" });
  if (entries.length > MAX_ENTRIES) {
    return json(413, { error: `${entries.length} entries — trim tighter (cap ${MAX_ENTRIES}); the full set stays behind the server lookup` });
  }

  const coverage = [states.join("+") || null, prefixes.length ? `prefixes ${prefixes.join(",")}` : null].filter(Boolean).join(", ");
  const now = new Date().toISOString();
  const id = `us-zips-${(states.join("-") || prefixes.join("-")).toLowerCase()}`.slice(0, 40);
  return json(200, {
    path: `builder/data/datasets/${id}.json`,
    content: {
      schemaVersion: 1,
      manifest: {
        id,
        name: `US ZIP places — ${coverage}`,
        kind: "zip-places",
        source: "Bundled dataset generated from the `zipcodes` npm package (scripts/gen-zip-places.mjs)",
        licenseNotes: "BSD license (© 2007 Dav Glass) — redistribution permitted with attribution. ZIP→city/state lookup only; NOT USPS deliverable-address verification.",
        version: now.slice(0, 10),
        importedAt: now,
        updatedAt: now,
        coverage,
        limitations: "Primary city per ZIP only; dataset vintage follows the bundled file, not live USPS data.",
        rows: entries.length,
      },
      entries,
    },
  });
}
