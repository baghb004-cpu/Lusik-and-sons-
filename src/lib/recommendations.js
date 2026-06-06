// ============================================================
// recommendations — "You may also like" cross-sell selector
// ============================================================
// Given the productKey that was just added to the bag, returns up to
// `max` other LIVE catalog products to suggest in the post-add sheet.
// Complementary ordering: after a bib we lead with a blanket (and the
// other bibs); after a blanket we lead with bibs. The just-added product
// is always excluded. Pure data — no React.
// ============================================================

import { CATALOG } from "../data/catalog.js";

// Catalog products that don't set their own coverImage.
const IMG_FALLBACK = {
  "bib-single": "/img/bib-examples/01.jpg",
  "blanket-alphabet": "/img/abc-blanket/cover.jpg",
};

// Normalize a cart/trusted productKey (e.g. "bib-hy-em-with-cap",
// "blanket-double_diag_br") to the CATALOG product key it belongs to,
// so we can exclude it from the suggestions.
function catalogKeyForCartKey(cartKey = "") {
  if (!cartKey) return null;
  const k = String(cartKey).replace(/-with-cap$/, "");
  if (k === "bib") return "bib-single";
  if (k === "blanket-full-alphabet") return "blanket-full-alphabet";
  if (k.startsWith("blanket-")) return "blanket-alphabet"; // any alphabet-blanket layout
  return k; // bib-hy-em, bib-anushig-pair, bib-bari-akhorzhak-set, bib-days-of-week
}

function liveProducts() {
  const out = [];
  for (const category of Object.values(CATALOG)) {
    for (const p of category.products) {
      if (p.status !== "live") continue;
      const image = p.coverImage || IMG_FALLBACK[p.key] || null;
      if (!image) continue; // never suggest a card we can't show a photo for
      out.push({
        key: p.key,
        slug: p.slug,
        categorySlug: category.slug,
        name: p.name,
        name_hy: p.name_hy,
        priceFrom: p.priceFrom,
        image,
      });
    }
  }
  return out;
}

export function getRecommendations(addedCartKey, max = 4) {
  const excludeKey = catalogKeyForCartKey(addedCartKey);
  const addedIsBlanket = String(addedCartKey || "").startsWith("blanket-");
  const items = liveProducts().filter((p) => p.key !== excludeKey);

  // Lead with the COMPLEMENTARY category (bib → blanket, blanket → bib),
  // then fill with the rest. Stable within each group.
  const wantBlanketFirst = !addedIsBlanket;
  const ranked = items
    .map((p, i) => ({ p, i, isBlanket: p.categorySlug === "blankets" }))
    .sort((a, b) => {
      const aLead = a.isBlanket === wantBlanketFirst ? 0 : 1;
      const bLead = b.isBlanket === wantBlanketFirst ? 0 : 1;
      return aLead - bLead || a.i - b.i;
    })
    .map((x) => x.p);

  return ranked.slice(0, max);
}
