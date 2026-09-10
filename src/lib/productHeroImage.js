// ============================================================
// WHICH PHOTOGRAPH STANDS FOR A PRODUCT
// ============================================================
// Not every product has a `coverImage`. The Custom Name Bib has none at
// all: the old workshop shot was removed at the owner's request and the
// CMS entry has carried no photograph since, so anything reading
// `product.coverImage` for it gets null and draws an empty grey box.
//
// The category grid already worked this out — it shows four real
// past-customer bibs for that product — and the home page's row of
// pieces needs the same answer. Two places deciding separately is how
// one of them ends up blank, which is exactly what happened the first
// time the home row was built.
//
// Plain JavaScript so the Node unit suite can check it.
// ============================================================

/** The four past-customer bibs, in place of a cover photo for `bib-single`. */
export const NAME_BIB_EXAMPLES = Object.freeze([
  "/img/bib-examples/01.jpg",  // teddy bear + Armenian
  "/img/bib-examples/02.jpg",  // daffodils + "Armig"
  "/img/bib-examples/03.jpg",  // tulip + Armenian on pink
  "/img/bib-examples/04.jpg",  // giraffe + Armenian on blue
]);

/**
 * Every photograph that can stand for a product, best first.
 *
 * @param {{ key?: string, status?: string, coverImage?: string|null, images?: string[]|null }} product
 * @param {{ galleryFallback?: string|null }} [opts] first gallery photo for the live alphabet blanket
 * @returns {string[]} possibly empty — a caller with none must not draw an empty frame
 */
export function productHeroImages(product, opts = {}) {
  if (!product) return [];
  if (product.status === "live" && product.key === "bib-single") {
    return [...NAME_BIB_EXAMPLES];
  }
  if (product.coverImage) return [product.coverImage];
  if (Array.isArray(product.images) && product.images.length > 0) return [...product.images];
  if (product.status === "live" && product.key === "blanket-alphabet" && opts.galleryFallback) {
    return [opts.galleryFallback];
  }
  return [];
}

/**
 * One photograph, or null.
 *
 * @param {Parameters<typeof productHeroImages>[0]} product
 * @param {Parameters<typeof productHeroImages>[1]} [opts]
 * @returns {string | null}
 */
export function productHeroImage(product, opts = {}) {
  return productHeroImages(product, opts)[0] ?? null;
}
