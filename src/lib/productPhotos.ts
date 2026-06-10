// ============================================================
// productPhotos — one source of truth for a product's photo set
// ============================================================
// The mobile <ImmersiveBuySheet> shows a product's photos as a
// full-screen backdrop. Each buy surface keeps its photos in a
// DIFFERENT place, so this hides that behind one call:
//
//   * blanket-alphabet → PRODUCT.gallery   (src/data/product.js)
//   * bib-single       → no catalog photos (its on-page preview is a
//                        live SVG); the real shots are the past-customer
//                        example photos, kept here.
//   * the bib sets +   → catalog `images`  (src/data/catalog.js)
//     the crib blanket
//   * placeholders     → no `images` yet → fall back to `coverImage`
//
// Returns [] when there's nothing to show; the caller treats that as
// "not immersive — render the normal layout." Wiring a pending product
// later is then trivial: give its catalog entry `images`/`coverImage`.
// ============================================================

import { PRODUCT } from "../data/product.js";

// Real past-customer bib photos (also the custom-name-bib backdrop, since
// that configurator only renders a live SVG preview, not photographs).
export const BIB_CUSTOMER_EXAMPLES: string[] = [
  "/img/bib-examples/01.jpg", // teddy bear + Armenian name on white bib
  "/img/bib-examples/02.jpg", // "Armig" + daffodils on white bib
  "/img/bib-examples/03.jpg", // tulip + Armenian name on pink bib
  "/img/bib-examples/04.jpg", // giraffe + Armenian name on light blue bib
];

interface ProductLike {
  key?: string;
  images?: string[];
  coverImage?: string;
}

export function getProductPhotos(product: ProductLike | null | undefined): string[] {
  if (!product) return [];

  // The live Armenian Alphabet Blanket renders through ProductShowcase,
  // whose photos live in PRODUCT.gallery, not the catalog entry.
  if (product.key === "blanket-alphabet") {
    const g = (PRODUCT as { gallery?: string[] }).gallery;
    return Array.isArray(g) ? g.filter(Boolean) : [];
  }

  // The custom name bib has no photo gallery (live SVG preview).
  if (product.key === "bib-single") return BIB_CUSTOMER_EXAMPLES;

  // Bib sets + the crib blanket carry their gallery in catalog `images`.
  if (Array.isArray(product.images) && product.images.length > 0) return product.images;

  // Fallback (incl. placeholders once given a coverImage).
  return product.coverImage ? [product.coverImage] : [];
}
