// ============================================================
// ProductPlaceholderView — coming-soon page template
// ============================================================
// Used for every catalog entry with status !== "live". Renders
// a clean layout that's ready to receive real content as soon
// as Lusik supplies photos + pricing:
//
//   - Image goes here (frame with a "Image goes here" caption)
//   - Product name + tagline from the catalog
//   - Catalog description (TODO_LUSIK markers stripped client-side)
//   - "Coming soon" badge + "Notify me" CTA that opens the
//      existing WaitlistModal (owned by App)
//   - Text-goes-here placeholders for sections that will be
//      filled in later
//   - Breadcrumb trail back up the hierarchy
//
// All UI text is final-customer-facing — no developer markers
// leak through. The original `description` in the catalog still
// contains TODO_LUSIK hints for our internal use; we filter
// them out before rendering.
// ============================================================

import React from "react";
import { Breadcrumbs } from "./Breadcrumbs.jsx";
import { ArrowRight, Mail } from "../icons.jsx";
import { ProductImageSlideshow } from "../ProductImageSlideshow.jsx";

// Strip the "⚠️ TODO_LUSIK: ..." sentence (and any trailing whitespace)
// from a description before showing it to a customer. The marker is
// always at the END of the description per the catalog convention,
// so a simple split-and-take-first-half is enough.
function cleanDescription(text) {
  if (!text) return "";
  const cleaned = text.split(/\s*⚠️\s*TODO_LUSIK\s*:?/i)[0].trim();
  // Collapse double spaces left after the strip.
  return cleaned.replace(/\s{2,}/g, " ");
}

export function ProductPlaceholderView({ category, product, trail, onOpenWaitlist }) {
  const description = cleanDescription(product.description);
  const hasGallery = Array.isArray(product.images) && product.images.length > 0;

  return (
    <div className="fade-in max-w-5xl mx-auto px-6 lg:px-12 py-8 lg:py-12">
      <Breadcrumbs trail={trail} />

      <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
        {/* GALLERY — slideshow when the placeholder product has
            photos staged (e.g. cotton-yarn-blanket is "placeholder"
            for pricing reasons but already has 60+ photos). Falls
            back to the "Image goes here" frame for products with no
            photos yet. The Coming Soon / Not For Sale Yet copy on
            the right column stays either way — photos don't mean
            it's purchasable. */}
        {hasGallery ? (
          <ProductImageSlideshow
            images={product.images}
            alt={product.name}
            aspectClass="aspect-[4/5]"
            className="lg-panel"
          />
        ) : (
          <div className="aspect-[4/5] lg-panel flex items-center justify-center text-center px-6">
            <div>
              <p className="text-[0.6rem] tracking-[0.3em] uppercase mb-3" style={{ color: "#B08842", fontWeight: 600 }}>
                Coming soon
              </p>
              <p className="text-sm opacity-65 italic mb-2">Image goes here</p>
              <p className="text-[0.65rem] opacity-45 leading-relaxed max-w-[14em] mx-auto">
                Lusik is finishing the first piece of this item. Photographs will be posted here once it's ready.
              </p>
            </div>
          </div>
        )}

        {/* INFO PANEL */}
        <div>
          <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: "#B08842" }}>
            {category.label}
          </p>
          <h1 className="font-display text-3xl lg:text-5xl mb-3" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>
            {product.name}
          </h1>
          <p className="text-base lg:text-lg opacity-80 leading-relaxed mb-6">
            {product.tagline}
          </p>

          <div className="lg-panel lg-panel-gold p-4 mb-6">
            <p className="text-[0.6rem] tracking-[0.25em] uppercase mb-2" style={{ color: "#B08842", fontWeight: 600 }}>
              Not for sale yet
            </p>
            <p className="text-sm leading-relaxed">
              {hasGallery
                ? "Lusik has made this one many times — these photos are from her past work. We're working out final pricing before opening it for orders. Drop your email and we'll write you the moment it's listed — no spam, no other lists."
                : "Lusik is putting the first piece together. Drop your email and we'll write you the moment it's ready — no spam, no other lists."}
            </p>
          </div>

          <button
            onClick={() => onOpenWaitlist?.(product)}
            className="lg-button-ink lg-shine w-full sm:w-auto px-6 py-3 text-sm tracking-wide flex items-center justify-center gap-3"
            style={{ fontWeight: 500 }}
          >
            Notify me when it's ready <ArrowRight size={16} strokeWidth={1.5} />
          </button>

          {description && (
            <div className="mt-10">
              <p className="text-[0.6rem] tracking-[0.3em] uppercase mb-3 opacity-65">
                Details
              </p>
              <p className="text-sm leading-relaxed opacity-85">
                {description}
              </p>
            </div>
          )}

          <div className="mt-8 pt-6" style={{ borderTop: "1px solid rgba(26,22,18,0.10)" }}>
            <p className="text-[0.6rem] tracking-[0.3em] uppercase mb-2 opacity-65">
              Custom request
            </p>
            <p className="text-sm leading-relaxed opacity-80 mb-3">
              Want to order this directly or ask Lusik a question?
            </p>
            <a
              href={`mailto:hello@lusikandsons.com?subject=${encodeURIComponent("About the " + product.name)}`}
              className="inline-flex items-center gap-2 text-sm underline hover:opacity-70"
              style={{ color: "#1A1612" }}
            >
              <Mail size={14} strokeWidth={1.5} />
              hello@lusikandsons.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
