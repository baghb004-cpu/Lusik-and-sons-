// ============================================================
// productPhotos — one source of truth for a product's photo set
// ============================================================
// The mobile <ImmersiveProductSheet> shows a product's photos as a
// full-screen swipeable backdrop. The catch: each buy surface keeps its
// photos in a DIFFERENT place —
//
//   * blanket-alphabet → PRODUCT.gallery   (src/data/product.js)
//   * bib-single       → no catalog photos at all (its on-page preview
//                        is a LIVE SVG); the real shots are past-customer
//                        example photos, which used to be inlined in
//                        ProductView. They live here now so the backdrop
//                        has a real source.
//   * the bib sets +   → catalog `images`  (src/data/catalog.js)
//     the crib blanket
//   * placeholders     → no `images` yet → fall back to `coverImage`
//
// getProductPhotos() hides all of that behind one call. It returns []
// when there's nothing to show, which the sheet treats as "not
// immersive — render the normal layout." That's also why wiring a
// pending product later is trivial: give its catalog entry an `images`
// array (or a `coverImage`) and it lights up automatically.
// ============================================================

import { PRODUCT } from "../data/product.js";

// Real past-customer bib photos (teddy bear + Armenian name, daffodils,
// tulip on pink, giraffe on blue). Moved here from ProductView so the
// custom name bib's immersive backdrop has a source — the configurator
// itself only renders a live SVG preview, not photographs.
export const BIB_CUSTOMER_EXAMPLES = [
  "/img/bib-examples/01.jpg", // teddy bear + Armenian name on white bib
  "/img/bib-examples/02.jpg", // "Armig" + daffodils on white bib
  "/img/bib-examples/03.jpg", // tulip + Armenian name on pink bib
  "/img/bib-examples/04.jpg", // giraffe + Armenian name on light blue bib
];

export function getProductPhotos(product) {
  if (!product) return [];

  // The live Armenian Alphabet Blanket renders through ProductShowcase,
  // whose photos live in PRODUCT.gallery, not in the catalog entry.
  if (product.key === "blanket-alphabet") {
    return Array.isArray(PRODUCT.gallery) ? PRODUCT.gallery.filter(Boolean) : [];
  }

  // The custom name bib has no photo gallery (live SVG preview); use the
  // real past-customer examples as the backdrop.
  if (product.key === "bib-single") {
    return BIB_CUSTOMER_EXAMPLES;
  }

  // Bib sets + the crib blanket carry their gallery in catalog `images`.
  if (Array.isArray(product.images) && product.images.length > 0) {
    return product.images;
  }

  // Fallback (incl. placeholders once they're given a coverImage): the
  // single cover photo. Empty array => caller falls back to normal layout.
  return product.coverImage ? [product.coverImage] : [];
}
