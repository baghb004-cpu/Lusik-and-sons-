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

import React from "react";
import { Breadcrumbs } from "./Breadcrumbs.jsx";
import { ProductShowcase } from "../ProductShowcase.jsx";
import { CustomProductCard } from "../CustomProductCard.jsx";
import { ProductPlaceholderView } from "./ProductPlaceholderView.jsx";

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
    return (
      <div className="fade-in max-w-5xl mx-auto px-6 lg:px-12 py-8 lg:py-12">
        <Breadcrumbs trail={trail} />
        <CustomProductCard
          config={customProductData}
          onAddCustom={onAddCustom}
          onCartFeedback={onCartFeedback}
        />
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
