// ============================================================
// CategoryView — /shop/<categorySlug> landing page
// ============================================================
// Renders one category's product list as a grid of cards. Each
// card is a real link to the product page (live or placeholder).
// Live products show price + "View product"; placeholders show
// a "Coming soon" badge + "Notify me" hint without revealing a
// price.
//
// We deliberately do NOT render the full product configurator
// here — that's the job of the per-product page. This page is
// for browsing.
//
// Photos for live products come from the PRODUCT / CUSTOM_PRODUCTS
// gallery first image. Placeholders show the "Image goes here"
// frame (consistent with the placeholder product page) so the
// grid still has visual structure when no photo exists.
// ============================================================

import React from "react";
import { Breadcrumbs } from "./Breadcrumbs.jsx";
import { ArrowRight } from "../icons.jsx";
import { PRODUCT } from "../../data/product.js";
import { CategoryCardImage } from "../CategoryCardImage.jsx";

// Thumbnail image(s) for the category-grid card. Returns either:
//   - a string (single image, no slideshow), OR
//   - an array of strings (brisk slideshow on hover, auto-cycle
//     on touch -- same behavior as the home-page Featured
//     Categories cards)
// Preference order:
//   1. bib-single  -> the 4 past-customer bib photos as a
//      brisk slideshow (real customer orders, not the old
//      Romeo+blanket workshop shot)
//   2. product.coverImage  -> explicit portrait crop if set
//      (alphabet blanket, cotton blanket placeholder)
//   3. PRODUCT.gallery[0]  -> first gallery photo for the
//      live alphabet blanket
//   4. null  -> placeholder card renders the empty
//      "Image goes here" frame
function productHeroImages(product) {
  if (product.status === "live" && product.key === "bib-single") {
    return [
      "/img/bib-examples/01.jpg",  // teddy bear + Armenian
      "/img/bib-examples/02.jpg",  // daffodils + "Armig"
      "/img/bib-examples/03.jpg",  // tulip + Armenian on pink
      "/img/bib-examples/04.jpg",  // giraffe + Armenian on blue
    ];
  }
  if (product.coverImage) return product.coverImage;
  if (product.status === "live" && product.key === "blanket-alphabet") {
    return PRODUCT.gallery?.[0] ?? null;
  }
  return null;
}

export function CategoryView({ category, onNavigateHome, onNavigateShop, onNavigateProduct }) {
  return (
    <div className="fade-in max-w-6xl mx-auto px-6 lg:px-12 py-12 lg:py-16">
      <Breadcrumbs trail={[
        { label: "Home", onClick: onNavigateHome },
        { label: "Shop", onClick: onNavigateShop },
        { label: category.label },
      ]} />

      <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: "#B08842" }}>{category.eyebrow}</p>
      <h1 className="font-display text-4xl lg:text-6xl mb-4" style={{ fontWeight: 400, letterSpacing: "-0.02em" }}>
        {category.label}.
      </h1>
      <p className="text-base lg:text-lg opacity-75 max-w-2xl leading-relaxed mb-10 lg:mb-12">
        {category.description}
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
        {category.products.map((p) => {
          const isLive = p.status === "live";
          const hero   = productHeroImages(p);
          return (
            <button
              key={p.slug}
              onClick={() => onNavigateProduct(category.slug, p.slug)}
              className="lg-button lg-shine text-left flex flex-col"
              aria-label={isLive ? `View ${p.name}` : `${p.name} — coming soon`}
            >
              {/* Product photo (live) or "Image goes here" placeholder.
                  CategoryCardImage handles both a single image (static)
                  and an array of images (brisk slideshow on hover /
                  auto-cycle on touch). Returns null for products
                  without a hero, in which case we render the empty
                  "Image goes here" frame below. */}
              <div className="aspect-[4/5] overflow-hidden" style={{ borderBottom: "1px solid rgba(26,22,18,0.10)" }}>
                {hero ? (
                  <CategoryCardImage images={hero} alt={p.name} />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-center px-4"
                    style={{ background: "rgba(176,136,66,0.06)" }}
                  >
                    <div>
                      <p className="text-[0.6rem] tracking-[0.3em] uppercase mb-1.5" style={{ color: "#B08842", fontWeight: 600 }}>
                        Almost ready
                      </p>
                      <p className="text-xs opacity-55 italic">Lusik's hands first</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-5">
                <h2 className="font-display text-xl lg:text-2xl mb-1" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>
                  {p.name}
                </h2>
                <p className="text-sm opacity-75 leading-relaxed mb-4 min-h-[2.5em]">
                  {p.tagline}
                </p>
                <div className="flex items-center justify-between gap-2 pt-3" style={{ borderTop: "1px solid rgba(26,22,18,0.08)" }}>
                  {/* Three-mode footer:
                      * Live -- price + "Step in" CTA
                      * Priced placeholder (commission-only) -- price
                        shown the same way, but CTA reads "By direct
                        order" so the customer knows clicking goes
                        to a product page with a commission path,
                        not to an Add-to-Cart button
                      * Unpriced placeholder -- "Almost ready" badge
                        + "Write me" CTA into the waitlist */}
                  {isLive ? (
                    <>
                      <p className="text-sm" style={{ fontWeight: 500 }}>
                        From <span style={{ color: "#B08842" }}>${p.priceFrom}</span>
                      </p>
                      <span className="text-[0.65rem] tracking-[0.2em] uppercase flex items-center gap-1.5" style={{ color: "#B08842", fontWeight: 500 }}>
                        Step in <ArrowRight size={12} strokeWidth={1.75} />
                      </span>
                    </>
                  ) : typeof p.priceFrom === "number" && p.priceFrom > 0 ? (
                    <>
                      <p className="text-sm" style={{ fontWeight: 500 }}>
                        From <span style={{ color: "#B08842" }}>${p.priceFrom}</span>
                      </p>
                      <span className="text-[0.65rem] tracking-[0.2em] uppercase flex items-center gap-1.5" style={{ color: "#B08842", fontWeight: 500 }}>
                        By direct order <ArrowRight size={12} strokeWidth={1.75} />
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-[0.6rem] tracking-[0.25em] uppercase px-2 py-1" style={{ background: "rgba(176,136,66,0.12)", color: "#B08842", fontWeight: 600 }}>
                        Almost ready
                      </span>
                      <span className="text-[0.65rem] tracking-[0.2em] uppercase flex items-center gap-1.5" style={{ color: "#B08842", fontWeight: 500 }}>
                        Write me <ArrowRight size={12} strokeWidth={1.75} />
                      </span>
                    </>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
