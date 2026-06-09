"use client";

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
import { BibSetCard } from "./BibSetCard.jsx";
import { CribBlanketCard } from "./CribBlanketCard.jsx";
import { ProductPlaceholderView } from "./ProductPlaceholderView.jsx";
import { ProductImageGallery } from "../ProductImageGallery.jsx";
import { ImmersiveProductSheet } from "./ImmersiveProductSheet.jsx";
import { getProductPhotos, BIB_CUSTOMER_EXAMPLES } from "../../lib/productPhotos.js";
import { CONFIG } from "../../data/config.js";
import { StillHaveQuestionsCard } from "./HelpDecidingSection.jsx";
import { recordProductView } from "../../lib/recentActivity.js";
import { useSite } from "../../state/SiteProvider.jsx";
import { inventoryKeyForCatalog } from "../../lib/inventory";
import { useT, useLang } from "../../i18n/LangContext.jsx";
import { loc } from "../../i18n/localize.js";

export function ProductView({
  category,
  product,
  // Live-product callbacks from App (unchanged shape)
  productData,        // PRODUCT for blanket
  customProductData,  // CUSTOM_PRODUCTS.bib for bib
  customProducts,     // full CUSTOM_PRODUCTS map (heritage bib sets + crib blanket)
  onAdd,
  onAddCustom,
  onBuyNow,        // express buy-it-now for the blanket
  onBuyNowCustom,  // express buy-it-now for the bib
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
  const t = useT();
  const { lang } = useLang();
  const { isSoldOut } = useSite();
  const inventoryKey = inventoryKeyForCatalog(product.key);
  const soldOut = isSoldOut(inventoryKey);
  const trail = [
    { label: t("shop.breadcrumbHome"), onClick: onNavigateHome },
    { label: t("footer.shop"), onClick: onNavigateShop },
    { label: loc(category, "label", lang), onClick: () => onNavigateCategory(category.slug) },
    { label: loc(product, "name", lang) },
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

  // Each product surface is built by renderSurface(immersive). On mobile,
  // live products are wrapped in <ImmersiveProductSheet> (full-screen photo
  // backdrop + draggable buy sheet); `immersive` tells the surface to drop its
  // own photo gallery + outer chrome + MobilePurchaseBar and surface its buy
  // controls (the un-hidden PurchaseCard) inside the sheet. Desktop renders the
  // same surface with immersive=false (unchanged layout).
  const renderSurface = (immersive = false) => {
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
        {!immersive && (
          <div className="max-w-7xl mx-auto px-6 lg:px-12 pt-8 lg:pt-10">
            <Breadcrumbs trail={trail} />
          </div>
        )}
        <ProductShowcase
          product={productData}
          onAdd={onAdd}
          onBuyNow={onBuyNow}
          onCartFeedback={onCartFeedback}
          user={user}
          onRequireSignIn={onRequireSignIn}
          onStickyCtaShown={onStickyCtaShown}
          soldOut={soldOut}
          notifyKey={inventoryKey}
          immersive={immersive}
        />
      </div>
    );
  }

  if (product.key === "bib-single") {
    // Real past-customer bib photos (shared constant — also the immersive
    // backdrop source, see lib/productPhotos.js). The configurator shows the
    // customer's chosen design (live SVG); this gallery shows what other
    // customers actually received. Trust + inspiration cues.
    const customerExamples = BIB_CUSTOMER_EXAMPLES;

    // Immersive (mobile sheet): the example photos ARE the backdrop, so the
    // sheet body is just the customizer (its live SVG preview stays).
    if (immersive) {
      return (
        <CustomProductCard
          config={customProductData}
          onAddCustom={onAddCustom}
          onBuyNow={onBuyNowCustom}
          onCartFeedback={onCartFeedback}
          soldOut={soldOut}
          notifyKey={inventoryKey}
          immersive
        />
      );
    }

    return (
      <div className="fade-in max-w-5xl mx-auto px-6 lg:px-12 py-8 lg:py-12">
        <Breadcrumbs trail={trail} />
        <CustomProductCard
          config={customProductData}
          onAddCustom={onAddCustom}
          onBuyNow={onBuyNowCustom}
          onCartFeedback={onCartFeedback}
          soldOut={soldOut}
          notifyKey={inventoryKey}
        />

        {/* Past customer orders gallery -- same shape as the full-
            alphabet blanket / days-bib placeholder galleries (tap-to-zoom,
            chevron arrows, single-row thumb strip) but without the
            color swatches since thread color is already chosen in
            the configurator above. */}
        <section className="mt-16 lg:mt-24 pt-12 lg:pt-16" style={{ borderTop: "1px solid var(--border-default)" }}>
          <div className="max-w-3xl mb-8 lg:mb-10">
            <p className="text-[0.6rem] tracking-[0.3em] uppercase mb-3" style={{ color: "var(--accent)" }}>
              {t("bib.othersEyebrow")}
            </p>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl mb-3 leading-tight break-words" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>
              {t("bib.othersTitlePre")}<em style={{ fontWeight: 400 }}>{t("bib.othersTitleEm")}</em>{t("bib.othersTitlePost")}
            </h2>
            <p className="text-sm lg:text-base opacity-75 leading-relaxed">
              {t("bib.othersBody")}
            </p>
          </div>
          <div className="min-w-0 w-full">
            <ProductImageGallery
              images={customerExamples}
              alt={t("bib.othersAlt")}
            />
          </div>
        </section>
      </div>
    );
  }

  // The hand cross-stitched heritage bib sets + the hand-knit crib
  // blanket. Their buy spec (price, options, cap variant) lives in
  // CUSTOM_PRODUCTS, keyed by the same catalog key; the configurator
  // adds through the shared addCustomToCart path.
  const spec = customProducts?.[product.key];
  if (spec?.buy?.kind === "cribBlanket") {
    return (
      <CribBlanketCard
        product={product}
        spec={spec}
        trail={trail}
        onAddCustom={onAddCustom}
        onBuyNow={onBuyNowCustom}
        onCartFeedback={onCartFeedback}
        soldOut={soldOut}
        notifyKey={inventoryKey}
        immersive={immersive}
      />
    );
  }
  if (spec?.buy?.kind === "bibSet") {
    return (
      <BibSetCard
        product={product}
        spec={spec}
        trail={trail}
        onAddCustom={onAddCustom}
        onBuyNow={onBuyNowCustom}
        onCartFeedback={onCartFeedback}
        soldOut={soldOut}
        notifyKey={inventoryKey}
        immersive={immersive}
      />
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
  };

  // ── Mobile photo-immersive sheet (Apple-Store style) ──
  // Live products with at least one photo get the full-screen swipeable
  // backdrop + draggable buy sheet on phones, REPLACING the MobilePurchaseBar.
  // Disabled when sold out (no buy controls to sheet — the SoldOutPanel shows
  // in the normal layout) or when there are no photos, and killable site-wide
  // via CONFIG.SHEET.IMMERSIVE_ENABLED. Pending/placeholder products stay on
  // the normal layout (the template is ready: give them catalog images/
  // coverImage and they light up automatically).
  const photos = getProductPhotos(product);
  const immersiveActive =
    CONFIG.SHEET.IMMERSIVE_ENABLED &&
    product.status === "live" &&
    !soldOut &&
    photos.length > 0;

  // A single "from" price for the collapsed pill. Per-variant pricing still
  // lives in the buy controls; this is just a glanceable label.
  const specForPrice = customProducts?.[product.key];
  const priceNum =
    product.key === "blanket-alphabet" ? productData?.price
    : product.key === "bib-single" ? customProductData?.price
    : specForPrice?.price ?? product.priceFrom ?? null;
  const priceLabel = priceNum != null ? `$${priceNum}` : "";

  if (immersiveActive) {
    return (
      <>
        {/* Desktop: the normal product surface + sheet padding, unchanged. */}
        <div className="hidden lg:block pb-0">
          {renderSurface(false)}
          <StillHaveQuestionsCard className="mt-8 mb-12" />
        </div>
        {/* Mobile: full-screen photo backdrop + draggable buy sheet. The
            "Still have questions?" card rides at the bottom of the sheet body. */}
        <ImmersiveProductSheet
          photos={photos}
          productName={loc(product, "name", lang)}
          priceLabel={priceLabel}
          storageKey={product.key}
          onBack={() => onNavigateCategory(category.slug)}
        >
          {renderSurface(true)}
          <StillHaveQuestionsCard className="mt-10 mb-4" />
        </ImmersiveProductSheet>
      </>
    );
  }

  return (
    // Mobile gets generous bottom padding so the last element ("Still have
    // questions?") sits comfortably ABOVE the fixed MobilePurchaseBar sheet
    // (delivery details + Add-to-Bag) and never gets cut off. Desktop has no
    // sheet, so no extra padding there.
    <div className="pb-[340px] lg:pb-0">
      {renderSurface(false)}
      {/* The "delivery and pickup details" disclosure lives INSIDE each
          product's PurchaseCard / MobilePurchaseBar (Apple-style). This is
          the last thing on the page — it should rest just above the sheet. */}
      <StillHaveQuestionsCard className="mt-10 lg:mt-8 mb-0 lg:mb-12" />
    </div>
  );
}
