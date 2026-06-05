// ============================================================
// launchPromo — browser helpers for the "Founding Price" launch promo
// ============================================================
// DISPLAY ONLY. The server (netlify/functions/_lib/launch-promo.mjs) is
// what actually charges; this drives the struck-through price + gold
// "Founding price" badge in the shop. Reads CONFIG.LAUNCH_PROMO, which is
// kept in lockstep with the server file by launch-promo-drift.test.mjs.
//
// Everything here is a no-op when the promo is dormant (enabled:false) or
// outside its [startsAt, endsAt) window — callers get null and render the
// normal price.
// ============================================================

import { CONFIG } from "../data/config.js";

const PROMO = CONFIG.LAUNCH_PROMO || {};

// Catalog product `key` (src/data/catalog.js) -> the trusted productKey
// whose founding price represents that catalog card's "from" price (the
// base/cheapest variant). Only bibs that have a founding price are listed.
const CATALOG_KEY_TO_PROMO_KEY = {
  "bib-single":             "bib",
  "bib-hy-em":              "bib-hy-em",
  "bib-anushig-pair":       "bib-anushig-pair",
  "bib-bari-akhorzhak-set": "bib-bari-akhorzhak-set",
};

export function isLaunchPromoActive(now = Date.now()) {
  if (!PROMO.enabled) return false;
  const start = Date.parse(PROMO.startsAt);
  const end   = Date.parse(PROMO.endsAt);
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return now >= start && now < end;
}

export function promoLabel() {
  return PROMO.label || "Founding price";
}

function foundingCentsFor(productKey) {
  const c = PROMO.FOUNDING_CENTS?.[productKey];
  return Number.isInteger(c) ? c : null;
}

// For the BUY cards (CustomProductCard / BibSetCard), which know the exact
// variant productKey and its normal price in DOLLARS. Returns the founding
// price in DOLLARS when the promo is live and strictly lower, else null.
export function foundingPriceForKey(productKey, normalDollars, now = Date.now()) {
  if (!isLaunchPromoActive(now)) return null;
  const f = foundingCentsFor(productKey);
  if (f == null) return null;
  const normal = Number(normalDollars);
  if (!Number.isFinite(normal)) return null;
  const founding = f / 100;
  return founding < normal ? founding : null;
}

// For the catalog-driven "from $X" spots. Given a CATALOG product
// ({ key, priceFrom in DOLLARS }), returns { normalDollars, foundingDollars }
// when a founding price applies, else null.
export function promoForCatalogProduct(product, now = Date.now()) {
  if (!product || !isLaunchPromoActive(now)) return null;
  const promoKey = CATALOG_KEY_TO_PROMO_KEY[product.key];
  if (!promoKey) return null;
  const foundingCents = foundingCentsFor(promoKey);
  const normalDollars = Number(product.priceFrom);
  if (foundingCents == null || !Number.isFinite(normalDollars)) return null;
  const foundingDollars = foundingCents / 100;
  return foundingDollars < normalDollars ? { normalDollars, foundingDollars } : null;
}
