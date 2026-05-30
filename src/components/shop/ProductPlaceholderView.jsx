"use client";

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
import { ArrowRight, Mail, Phone } from "../icons.jsx";
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

  // Placeholder products fall into two UX modes:
  //
  //   * PRICED (commission-only) -- product.priceFrom is set, so the
  //     page surfaces the real number alongside a write/call to
  //     commission flow. This is the heritage-maker pattern (Hermès
  //     made-to-order, Le Labo by-commission): the price is honest
  //     and the order path is human, not a checkout button. The
  //     Full Alphabet Crib Blanket lives here -- Lusik makes it,
  //     priced it, but online checkout isn't wired yet.
  //
  //   * UNPRICED (still developing) -- product.priceFrom is null,
  //     meaning Lusik is still settling on what to charge. Price
  //     reads "Price coming soon", primary action is waitlist
  //     ("write me when it's ready").
  //
  // Both modes share the same gallery, description, and details
  // panel. The only difference is the price block + the CTA stack
  // beneath it.
  const isPriced = typeof product.priceFrom === "number" && product.priceFrom > 0;
  const commissionSubject = `Commission a ${product.name}`;
  const mailtoHref = `mailto:hello@lusikandsons.com?subject=${encodeURIComponent(commissionSubject)}`;
  const telHref = "tel:+17608742333";

  return (
    <div className="fade-in max-w-6xl mx-auto px-6 lg:px-12 py-8 lg:py-12">
      <Breadcrumbs trail={trail} />

      {/* min-w-0 on grid children prevents the CSS-grid quirk where
          a column's intrinsic minimum is `auto` (= its widest
          descendant) instead of zero. Without min-w-0, a wide
          descendant (e.g. the 7-swatch color picker row, a long
          product name like "The Armenian Days-of-the-Week Bib Set")
          can push the column wider than the viewport. min-w-0 makes
          the column actually respect its fair share. */}
      <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
        <div className="min-w-0 w-full">
        {/* GALLERY — the showcase-style photo gallery when the
            placeholder product has photos staged (the full-alphabet-
            crib-blanket case). Falls back to the original "Image goes
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
              <p className="text-sm opacity-65 italic mb-2">Lusik's hands first</p>
              <p className="text-[0.65rem] opacity-45 leading-relaxed max-w-[14em] mx-auto">
                Lusik is finishing the first piece of this one on her kitchen table. Photographs will go here the moment it's ready for the world to see.
              </p>
            </div>
          </div>
        )}

        </div>

        {/* INFO PANEL — mirrors the live ProductShowcase pattern
            (eyebrow → title → tagline → price-area → description →
            details → CTA) so the customer gets the same visual
            handle on every product page. The differences here are
            (a) price reads "Coming soon" rather than a dollar amount
            and (b) the primary CTA is a disabled "Currently
            unavailable" bar with a real "Notify me" button below it. */}
        <div className="min-w-0 w-full">
          <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: "#B08842" }}>
            {isPriced
              ? "By direct order · From Lusik's home in Cypress, California"
              : "Almost ready · Cypress, California"}
          </p>
          {/* break-words lets long compound product names ("The
              Armenian Days-of-the-Week Bib Set") wrap at the hyphens
              instead of forcing the column wider than the viewport.
              text-3xl on mobile, stepping up on larger screens, so
              the title scales with available width. */}
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl mb-3 leading-tight break-words" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>
            {product.name}
          </h1>
          {product.tagline && (
            <p className="text-base opacity-70 mb-6">
              {product.tagline}
            </p>
          )}

          {/* PRICE AREA — two modes:
              * Priced placeholder: real number in the live-product
                style (ink, not italic gold), so the customer reads
                it as a real number. Subtext explains that online
                checkout isn't open yet but Lusik will commission one
                directly.
              * Unpriced placeholder: italic gold "Price coming soon"
                signals "we're still figuring this out," waitlist
                takes over the action below. */}
          {isPriced ? (
            <>
              <div className="flex items-baseline gap-3 mb-2">
                <p className="text-3xl" style={{ fontWeight: 500, color: "#1A1612" }}>
                  ${product.priceFrom}
                </p>
              </div>
              <p className="text-xs opacity-60 mb-8 leading-relaxed">
                Online checkout for this piece isn't open yet — but the price is set and Lusik takes commissions directly. Write or call to start one, and she'll write back herself within a day.
              </p>
            </>
          ) : (
            <>
              <div className="flex items-baseline gap-3 mb-2">
                <p className="text-2xl lg:text-3xl italic" style={{ fontWeight: 400, color: "#B08842" }}>
                  Price coming soon
                </p>
              </div>
              <p className="text-xs opacity-60 mb-8">
                Lusik is still settling on what to charge for this lineup — she likes to hold a piece in her hands before naming a price. Leave your email below and we'll write you the moment it's listed.
              </p>
            </>
          )}

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

          {/* CTA STACK -- two layouts depending on whether the
              product has a real price set:
              * Priced (commission-only): primary is a real email
                button that drafts a commission inquiry; secondary
                is a phone button; tertiary is the waitlist (in
                case the customer wants the eventual online listing).
              * Unpriced: primary is the disabled "Currently
                unavailable" bar that signals the state; the real
                action is the waitlist button below it. */}
          {isPriced ? (
            <>
              {/* PRIMARY -- write Lusik to commission. Pre-filled
                  mailto subject so the conversation starts with
                  product context already in the inbox. */}
              <a
                href={mailtoHref}
                className="lg-button-ink lg-shine w-full px-6 py-4 mb-3 text-sm tracking-wide flex items-center justify-center gap-3"
                style={{ fontWeight: 500, letterSpacing: "0.02em" }}
              >
                <Mail size={16} strokeWidth={1.5} />
                Write Lusik to commission this <ArrowRight size={16} strokeWidth={1.5} />
              </a>

              {/* SECONDARY -- phone, for customers who'd rather
                  talk than write. tel: opens the dialer on mobile
                  and the default calling app on desktop. */}
              <a
                href={telHref}
                className="w-full px-6 py-3 mb-3 text-sm tracking-wide flex items-center justify-center gap-3 transition-opacity hover:opacity-70"
                style={{
                  border: "1px solid #1A1612",
                  color: "#1A1612",
                  fontWeight: 500,
                  letterSpacing: "0.02em",
                  background: "transparent",
                }}
              >
                <Phone size={16} strokeWidth={1.5} />
                Or call (760) 874-2333
              </a>

              <p className="text-[0.65rem] opacity-60 text-center mt-3 mb-6 leading-relaxed">
                Lusik or one of her sons writes back, usually within a day. We'll talk through the colorway, the alphabet, the date you need it by, and confirm the price before stitching begins.
              </p>

              {/* TERTIARY -- waitlist. For customers who prefer
                  to wait for the eventual online listing rather
                  than commission directly. Subtler styling so it
                  doesn't compete with the commission path above. */}
              <div className="mt-8 pt-6" style={{ borderTop: "1px solid rgba(26,22,18,0.10)" }}>
                <p className="text-[0.6rem] tracking-[0.3em] uppercase mb-2 opacity-65">
                  Or wait for the listing
                </p>
                <p className="text-sm leading-relaxed opacity-80 mb-3">
                  We're working toward opening online checkout for this piece. If you'd rather wait, we'll write you the day it goes live.
                </p>
                <button
                  onClick={() => onOpenWaitlist?.(product)}
                  className="inline-flex items-center gap-2 text-sm underline hover:opacity-70"
                  style={{ color: "#1A1612" }}
                >
                  <ArrowRight size={14} strokeWidth={1.5} />
                  Add me to the list
                </button>
              </div>
            </>
          ) : (
            <>
              {/* DISABLED CTA -- looks like an add-to-cart button
                  but greyed-out. Communicates the "you can't buy
                  this yet, no price yet" state. */}
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

              {/* NOTIFY ME -- the real action when there's no
                  price yet. Opens the waitlist modal owned by App. */}
              <button
                onClick={() => onOpenWaitlist?.(product)}
                className="lg-button-ink lg-shine w-full px-6 py-3 text-sm tracking-wide flex items-center justify-center gap-3"
                style={{ fontWeight: 500 }}
              >
                Write me when it's ready <ArrowRight size={16} strokeWidth={1.5} />
              </button>
              <p className="text-[0.65rem] opacity-55 text-center mt-3">
                One note the day it lists — nothing else, ever.
              </p>

              {/* CUSTOM REQUEST -- keeps the existing direct-email
                  path available even before the price is set. */}
              <div className="mt-10 pt-6" style={{ borderTop: "1px solid rgba(26,22,18,0.10)" }}>
                <p className="text-[0.6rem] tracking-[0.3em] uppercase mb-2 opacity-65">
                  Or write to Lusik
                </p>
                <p className="text-sm leading-relaxed opacity-80 mb-3">
                  If you'd rather not wait for the public listing — or you have a question Lusik should answer herself — send her a note.
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
