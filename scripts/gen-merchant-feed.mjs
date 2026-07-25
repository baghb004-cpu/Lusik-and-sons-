// ============================================================
// gen-merchant-feed — Google Merchant Center product feed
// ============================================================
// Emits public/merchant-feed.xml (Google Shopping RSS 2.0, the same
// format WooCommerce Product Feed PRO produces) from content/products —
// LIVE products only: a shopping feed may never advertise a placeholder,
// and prices come from the CMS priceFrom, which the gen-products
// reconciliation gate already proves equal (to the cent) to the
// server-trusted Stripe price. Runs as part of `gen:data`, so every
// build/deploy refreshes the feed; Merchant Center fetches it from
//   https://lusikandsons.com/merchant-feed.xml
// on its own schedule and stays current automatically.
//
// Handmade goods carry no GTIN/MPN → identifier_exists false.
// Shipping is deliberately NOT in the feed — the zone-priced rates +
// free-over-$150 threshold live in Merchant Center's account-level
// shipping settings, one place instead of two.
// ============================================================

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://lusikandsons.com";

// Configurator-led products keep their photos in code (src/images), not
// in the CMS `images` array — give the feed a real hero for each.
const HERO_FALLBACK = {
  "blanket-alphabet": ["/img/abc-blanket/01.jpg", "/img/abc-blanket/02.jpg"],
  "bib-single": ["/img/hero-olen-bib.jpg", "/img/bib-romeo.jpg"],
};

const CATEGORY_META = {
  blankets: {
    google: "Home & Garden > Linens & Bedding > Bedding > Blankets",
    type: "Baby Blankets",
  },
  bibs: {
    google: "Baby & Toddler > Nursing & Feeding > Bibs & Burp Cloths",
    type: "Baby Bibs",
  },
  baby: {
    google: "Baby & Toddler",
    type: "Baby",
  },
  towels: {
    google: "Home & Garden > Linens & Bedding > Towels",
    type: "Towels",
  },
};

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/[\r\n\t]+/g, " ")
    .trim();

const productsDir = join(ROOT, "content", "products");
const live = readdirSync(productsDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(productsDir, f), "utf8").replace(/^﻿/, "")))
  .filter((p) => p.status === "live")
  .sort((a, b) => (a.category + a.slug).localeCompare(b.category + b.slug));

const items = live.map((p) => {
  const price = Number(p.priceFrom);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`merchant-feed: live product ${p.key} has no usable priceFrom`);
  }
  const cat = CATEGORY_META[p.category] ?? { google: "", type: p.category };
  const images = (p.images?.length ? p.images : HERO_FALLBACK[p.key]) ?? [];
  if (!images.length) {
    throw new Error(`merchant-feed: live product ${p.key} has no images (add a HERO_FALLBACK entry)`);
  }
  const [hero, ...rest] = images;
  const additional = rest.slice(0, 10)
    .map((u) => `    <g:additional_image_link>${esc(SITE + u)}</g:additional_image_link>`)
    .join("\n");
  const description = p.description || p.tagline || p.name;

  return `  <item>
    <g:id>${esc(p.key)}</g:id>
    <g:title>${esc(p.name)}</g:title>
    <g:description>${esc(description)}</g:description>
    <g:link>${esc(`${SITE}/shop/${p.category}/${p.slug}`)}</g:link>
    <g:image_link>${esc(SITE + hero)}</g:image_link>
${additional ? additional + "\n" : ""}    <g:price>${price.toFixed(2)} USD</g:price>
    <g:availability>in stock</g:availability>
    <g:condition>new</g:condition>
    <g:brand>Lusik &amp; Sons</g:brand>
    <g:identifier_exists>false</g:identifier_exists>
    <g:google_product_category>${esc(cat.google)}</g:google_product_category>
    <g:product_type>${esc(cat.type)}</g:product_type>
  </item>`;
});

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
  <title>Lusik &amp; Sons</title>
  <link>${SITE}</link>
  <description>Hand cross-stitched Armenian alphabet baby blankets, name bibs, and heritage pieces — made to order by Lusik in Buena Park, CA.</description>
${items.join("\n")}
</channel>
</rss>
`;

writeFileSync(join(ROOT, "public", "merchant-feed.xml"), xml);
console.log(`gen-merchant-feed: wrote ${live.length} live product(s) → public/merchant-feed.xml`);
