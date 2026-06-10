// ============================================================
// gen-zip-places — builds netlify/functions/_data/zip-places.json
// ============================================================
// Source: the `zipcodes` npm package (BSD-licensed, © 2007 Dav Glass),
// whose US dataset derives from public-domain ZIP data. We keep only
// what the zip-lookup Function serves — { "90630": ["Cypress","CA"] } —
// dropping lat/lng/country to keep the bundle small.
//
// Regenerate (rarely needed — ZIP→city mappings barely change):
//   curl -sL -o /tmp/zipcodes.tgz https://registry.npmjs.org/zipcodes/-/zipcodes-8.0.0.tgz
//   tar xzf /tmp/zipcodes.tgz -C /tmp
//   node scripts/gen-zip-places.mjs /tmp/package/lib/codes.js
//
// The output JSON is COMMITTED (unlike the journal/CMS generated files):
// it derives from external data, not repo content, so builds must not
// depend on fetching it.
// ============================================================

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const src = process.argv[2];
if (!src) {
  console.error("usage: node scripts/gen-zip-places.mjs <path-to-zipcodes-lib/codes.js>");
  process.exit(1);
}

const require = createRequire(import.meta.url);
const { codes } = require(src);

const out = {};
let kept = 0;
for (const [zip, rec] of Object.entries(codes)) {
  if (!/^\d{5}$/.test(zip)) continue;          // US 5-digit only (skip Canada-style keys)
  if (rec.country && rec.country !== "US") continue;
  if (!rec.city || !rec.state) continue;
  out[zip] = [rec.city, rec.state];
  kept++;
}

mkdirSync("netlify/functions/_data", { recursive: true });
writeFileSync(
  "netlify/functions/_data/zip-places.json",
  JSON.stringify(out),
);
console.log(`gen-zip-places: wrote ${kept} ZIPs → netlify/functions/_data/zip-places.json`);
