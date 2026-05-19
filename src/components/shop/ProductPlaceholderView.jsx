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
import { ProductImageGallery } from "../ProductImageGallery.jsx";

// Strip the "⚠️ TODO_LUSIK: ..." sentence (and any trailing whitespace)
// from a value before showing it to a customer. The marker is always
// at the END of the value per the catalog convention.
function cleanText(text) {
  if (!text) return "";
  const cleaned = text.split(/\s*⚠️\s*TODO_LUSIK\s*:?/i)[0].trim();
  return cleaned.replace(/\s{2,}/g, " ");
}

export function ProductPlaceholderView({ category, product, trail, onOpenWaitlist }) {
  const description = cleanText(product.description);
  const hasGallery = Array.isArray(product.images) && product.images.length > 0;
  const details    = Array.isArray(product.details) ? product.details : [];

  return (
    <div className="fade-in max-w-6xl mx-auto px-6 lg:px-12 py-8 lg:py-12">
      <Breadcrumbs trail={trail} />

      <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
        {/* GALLERY — the showcase-style photo gallery when the
            placeholder product has photos staged (the cotton-yarn-
            blanket case). Falls back to the original "Image goes
            here" frame for products with no photos yet. */}
        {hasGallery ? (
          <ProductImageGallery
            images={product.images}
            colorways={product.colorways}
            alt={product.name}
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

        {/* INFO PANEL — mirrors the live ProductShowcase pattern
            (eyebrow → title → tagline → price-area → description →
            details → CTA) so the customer gets the same visual
            handle on every product page. The differences here are
            (a) price reads "Coming soon" rather than a dollar amount
            and (b) the primary CTA is a disabled "Currently
            unavailable" bar with a real "Notify me" button below it. */}
        <div>
          <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: "#B08842" }}>
            Coming soon · Cypress, CA
          </p>
          <h1 className="font-display text-4xl lg:text-5xl mb-3 leading-tight" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>
            {product.name}
          </h1>
          {product.tagline && (
            <p className="text-base opacity-70 mb-6">
              {product.tagline}
            </p>
          )}

          {/* PRICE AREA — same vertical rhythm as the live product
              page's price block, but with placeholder copy. Italic
              soft gold to read as "we're still figuring this part
              out" rather than a hard zero / N/A. */}
          <div className="flex items-baseline gap-3 mb-2">
            <p className="text-2xl lg:text-3xl italic" style={{ fontWeight: 400, color: "#B08842" }}>
              Price coming soon
            </p>
          </div>
          <p className="text-xs opacity-60 mb-8">
            Lusik is finalizing pricing for this colorway lineup. Drop your email below and we'll write you the moment it's listed.
          </p>

          {description && (
            <p className="text-base leading-relaxed mb-8 opacity-85">
              {description}
            </p>
          )}

          {/* DETAILS / SIZE / CARE — definition list, always expanded
              (this is the only structured info on a placeholder page,
              no value in hiding it behind a collapse). */}
          {details.length > 0 && (
            <div className="mb-8 pt-6" style={{ borderTop: "1px solid rgba(26,22,18,0.10)" }}>
              <p className="text-[0.6rem] tracking-[0.3em] uppercase mb-4" style={{ color: "#B08842", fontWeight: 600 }}>
                Details · size · care
              </p>
              <dl className="space-y-3">
                {details.map((row) => (
                  <div key={row.label} className="grid grid-cols-[7rem_1fr] gap-3 items-baseline">
                    <dt className="text-[0.65rem] tracking-[0.2em] uppercase opacity-60" style={{ fontWeight: 500 }}>
                      {row.label}
                    </dt>
                    <dd className="text-sm leading-relaxed opacity-90">
                      {cleanText(row.value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* DISABLED CTA — looks like an add-to-cart button but
              greyed-out and unclickable. Communicates the "you can't
              buy this yet" state. */}
          <div
            className="w-full px-6 py-4 mb-3 text-sm tracking-wide flex items-center justify-center gap-3 select-none"
            style={{
              background: "rgba(26, 22, 18, 0.08)",
              color: "rgba(26, 22, 18, 0.45)",
              border: "1px solid rgba(26, 22, 18, 0.08)",
              fontWeight: 500,
              cursor: "not-allowed",
              letterSpacing: "0.02em",
            }}
            role="button"
            aria-disabled="true"
            aria-label="Currently unavailable — see the Notify me option below"
            tabIndex={-1}
          >
            Currently unavailable
          </div>

          {/* NOTIFY ME — the real action. Subtler than the live
              product's primary CTA (since this isn't a purchase),
              but still visually prominent. Opens the waitlist modal
              owned by App. */}
          <button
            onClick={() => onOpenWaitlist?.(product)}
            className="lg-button-ink lg-shine w-full px-6 py-3 text-sm tracking-wide flex items-center justify-center gap-3"
            style={{ fontWeight: 500 }}
          >
            Notify me when it's available <ArrowRight size={16} strokeWidth={1.5} />
          </button>
          <p className="text-[0.65rem] opacity-55 text-center mt-3">
            One email when it lists — no other mail, ever.
          </p>

          {/* CUSTOM REQUEST — keeps the existing direct-email path
              available for customers who'd rather talk to Lusik
              directly than wait for the public listing. */}
          <div className="mt-10 pt-6" style={{ borderTop: "1px solid rgba(26,22,18,0.10)" }}>
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
