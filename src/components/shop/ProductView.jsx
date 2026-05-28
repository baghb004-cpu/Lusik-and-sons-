// ============================================================
// ProductView — /shop/<categorySlug>/<productSlug>
// ============================================================
// Thin wrapper that picks the right product surface to render
// based on the catalog entry:
//
//   * blanket-alphabet  → <ProductShowcase> (the existing full
//                          configurator + buy)
//   * bib-single        → <CustomProductCard> (the bib name
//                          embroidery picker + buy)
//   * any placeholder   → <ProductPlaceholderView> (image-goes-
//                          here template + Notify me)
//
// The two live components are the SAME instances that used to
// be inlined in HomeView. They're now mounted here. No prop
// changes, no behavior changes — they still call the same
// onAdd / onCartFeedback callbacks owned by App. Cart-id shape
// is preserved end-to-end, so Stripe checkout keeps working
// unchanged.
//
// The placeholder path lives here too so the routing surface
// stays uniform — every product URL works whether the item is
// buyable yet or not.
// ============================================================

import React, { useEffect } from "react";
import { Breadcrumbs } from "./Breadcrumbs.jsx";
import { ProductShowcase } from "../ProductShowcase.jsx";
import { CustomProductCard } from "../CustomProductCard.jsx";
import { ProductPlaceholderView } from "./ProductPlaceholderView.jsx";
import { ProductImageGallery } from "../ProductImageGallery.jsx";
import { recordProductView } from "../../lib/recentActivity.js";

export function ProductView({
  category,
  product,
  // Live-product callbacks from App (unchanged shape)
  productData,        // PRODUCT for blanket
  customProductData,  // CUSTOM_PRODUCTS.bib for bib
  onAdd,
  onAddCustom,
  onCartFeedback,
  user,
  onRequireSignIn,
  onStickyCtaShown,
  // Placeholder hook
  onOpenWaitlist,
  // Routing callbacks
  onNavigateHome,
  onNavigateShop,
  onNavigateCategory,
}) {
  const trail = [
    { label: "Home", onClick: onNavigateHome },
    { label: "Shop", onClick: onNavigateShop },
    { label: category.label, onClick: () => onNavigateCategory(category.slug) },
    { label: product.name },
  ];

  // Record this product into the device-local "recently viewed" memory
  // (localStorage, never sent to a server). Keyed on the slug so it only
  // re-fires when the customer navigates to a *different* product, not on
  // every re-render. Image resolution mirrors what each surface shows as
  // a cover: the live blanket + bib have richer galleries than the
  // catalog coverImage, so prefer those when available.
  useEffect(() => {
    let image;
    if (product.key === "blanket-alphabet") image = productData?.gallery?.[0];
    else if (product.key === "bib-single") image = "/img/bib-examples/01.jpg";
    else if (product.coverImage) image = product.coverImage;
    recordProductView({
      slug: product.slug,
      categorySlug: category.slug,
      name: product.name,
      image,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.slug]);

  // Placeholder products: render the "coming soon" template
  // with the catalog description and a Notify-me button. No buy
  // flow — there's nothing to add to cart yet.
  if (product.status !== "live") {
    return (
      <ProductPlaceholderView
        category={category}
        product={product}
        trail={trail}
        onOpenWaitlist={onOpenWaitlist}
      />
    );
  }

  // The two live products. Each render below uses the SAME
  // component that was previously inlined on the home page,
  // wrapped only in the breadcrumb trail.
  if (product.key === "blanket-alphabet") {
    return (
      <div className="fade-in">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 pt-8 lg:pt-10">
          <Breadcrumbs trail={trail} />
        </div>
        <ProductShowcase
          product={productData}
          onAdd={onAdd}
          onCartFeedback={onCartFeedback}
          user={user}
          onRequireSignIn={onRequireSignIn}
          onStickyCtaShown={onStickyCtaShown}
        />
      </div>
    );
  }

  if (product.key === "bib-single") {
    // Real past-customer bib photos. Lives next to the live SVG
    // preview in the configurator above -- the configurator shows
    // the customer's chosen design, this gallery shows what other
    // customers actually received. Trust + inspiration cues.
    const customerExamples = [
      "/img/bib-examples/01.jpg",  // teddy bear + Armenian name on white bib
      "/img/bib-examples/02.jpg",  // "Armig" + daffodils on white bib
      "/img/bib-examples/03.jpg",  // tulip + Armenian name on pink bib
      "/img/bib-examples/04.jpg",  // giraffe + Armenian name on light blue bib
    ];
    return (
      <div className="fade-in max-w-5xl mx-auto px-6 lg:px-12 py-8 lg:py-12">
        <Breadcrumbs trail={trail} />
        <CustomProductCard
          config={customProductData}
          onAddCustom={onAddCustom}
          onCartFeedback={onCartFeedback}
        />

        {/* Past customer orders gallery -- same shape as the cotton
            blanket / days-bib placeholder galleries (tap-to-zoom,
            chevron arrows, single-row thumb strip) but without the
            color swatches since thread color is already chosen in
            the configurator above. */}
        <section className="mt-16 lg:mt-24 pt-12 lg:pt-16" style={{ borderTop: "1px solid rgba(26,22,18,0.10)" }}>
          <div className="max-w-3xl mb-8 lg:mb-10">
            <p className="text-[0.6rem] tracking-[0.3em] uppercase mb-3" style={{ color: "#B08842" }}>
              From other families' kitchens
            </p>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl mb-3 leading-tight break-words" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>
              Real bibs Lusik has <em style={{ fontWeight: 400 }}>stitched</em> for other families.
            </h2>
            <p className="text-sm lg:text-base opacity-75 leading-relaxed">
              Armenian names, English names, a small motif beside each one for the milestone it marked — tulips, teddy bears, giraffes, daffodils, the things a baby will one day point at and ask the word for. Tap any photo to step closer.
            </p>
          </div>
          <div className="min-w-0 w-full">
            <ProductImageGallery
              images={customerExamples}
              alt="Past customer bibs"
            />
          </div>
        </section>
      </div>
    );
  }

  // A catalog entry marked `live` without a wired-up renderer —
  // shouldn't happen if the data + this switch stay in sync, but
  // fall back to the placeholder rather than crash if it does.
  return (
    <ProductPlaceholderView
      category={category}
      product={product}
      trail={trail}
      onOpenWaitlist={onOpenWaitlist}
    />
  );
}
