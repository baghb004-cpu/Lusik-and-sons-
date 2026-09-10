// ============================================================
// LOOM RIG REGISTRY vs CONFIG.LOOM.PRODUCTS
// ============================================================
// A product key listed in CONFIG.LOOM.PRODUCTS with no matching rig is
// silent: the stage mounts, never arms, and shows its fallback forever.
// Everything looks fine. That is exactly what happened when the bib was
// listed as "bib-single" (its CMS key) while CustomProductCard passes
// CUSTOM_PRODUCTS.bib.key, which is "bib".
//
// The registry itself needs three.js, so this reads the source rather
// than importing it — enough to compare the two lists.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(resolve(here, "../../../../", p), "utf8");

/** Keys the registry knows how to build. */
function rigKeys() {
  const src = read("src/loom/rigs/index.ts");
  return [...src.matchAll(/productKey === "([^"]+)"/g)].map((m) => m[1]);
}

/** Keys the config enables. */
function enabledKeys() {
  const src = read("src/data/config.js");
  const block = src.slice(src.indexOf("LOOM: {"));
  const m = block.match(/PRODUCTS:\s*\[([^\]]*)\]/);
  assert.ok(m, "CONFIG.LOOM.PRODUCTS not found");
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

test("every enabled product has a rig", () => {
  const rigs = rigKeys();
  const missing = enabledKeys().filter((k) => !rigs.includes(k));
  assert.deepEqual(missing, [],
    `CONFIG.LOOM.PRODUCTS lists ${missing.join(", ")} but rigs/index.ts builds ${rigs.join(", ")}. ` +
    "The stage would mount and never arm.");
});

test("the registry is not empty and every rig key is a non-empty string", () => {
  const rigs = rigKeys();
  assert.ok(rigs.length > 0, "no rigs found — did createRigFor change shape?");
  for (const k of rigs) assert.ok(k.trim().length > 0);
});

test("the keys the components actually pass are the ones enabled", () => {
  // ProductShowcase hardcodes the blanket key; CustomProductCard passes
  // config.key from CUSTOM_PRODUCTS. Both must appear in the config list.
  const showcase = read("src/components/ProductShowcase.jsx");
  const m = showcase.match(/<LoomStage[\s\S]{0,200}?productKey="([^"]+)"/);
  assert.ok(m, "ProductShowcase no longer passes a literal productKey to LoomStage");
  const enabled = enabledKeys();
  assert.ok(enabled.includes(m[1]),
    `ProductShowcase passes "${m[1]}" but CONFIG.LOOM.PRODUCTS is ${enabled.join(", ")}`);

  const custom = read("src/data/customProducts.js");
  const bibKey = custom.match(/bib:\s*\{\s*key:\s*"([^"]+)"/);
  assert.ok(bibKey, "CUSTOM_PRODUCTS.bib.key not found");
  assert.ok(enabled.includes(bibKey[1]),
    `CustomProductCard passes "${bibKey[1]}" but CONFIG.LOOM.PRODUCTS is ${enabled.join(", ")}`);
});
