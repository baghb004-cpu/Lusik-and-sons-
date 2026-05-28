// ============================================================
// CartContents — shared cart body for the drawer + the Bag page
// ============================================================
// One presentational component rendered in two places:
//
//   variant="drawer" — desktop slide-in drawer (and the legacy
//     mobile drawer, now superseded by the page on phones). Compact
//     header ("Your cart" + Edit/Done + X close).
//
//   variant="page"  — the mobile full-page "Bag" view (Apple Store
//     style). Large title, no X (the customer leaves via the fixed
//     bottom nav, which stays visible), generous bottom padding so
//     the checkout button clears the nav island.
//
// Everything between the header and the footer (free-shipping
// nudge, item list with SwipeableRow + QuantityPicker, footer with
// subtotal / ShippingEstimator / checkout / payments / Instagram)
// is identical across variants — that's the whole point of the
// extraction. The only per-variant differences are the header and
// the empty-state navigation behavior (the drawer closes itself,
// the page just navigates).
//
// This is a pure presentational refactor: all the real handlers
// (setQtyExact, removeFromCart, onCheckout, …) still live in App
// and are threaded down as props. No Stripe / cart-id / backend
// logic lives here.
// ============================================================

import React from "react";
import { SwipeableRow } from "./SwipeableRow.jsx";
import { QuantityPicker } from "./QuantityPicker.jsx";
import { FreeShippingProgress } from "./FreeShippingProgress.jsx";
import { ShippingEstimator } from "./ShippingEstimator.jsx";
import { PaymentMethodsRow } from "./PaymentMethodsRow.jsx";
import { PRODUCT } from "../data/product.js";
import { X, ShoppingBag, ArrowRight, Check } from "./icons.jsx";

export function CartContents({
  variant = "drawer",
  cart,
  subtotal,
  cartEditMode,
  onToggleEdit,
  setQtyExact,
  removeFromCart,
  onCheckout,
  onShopBlankets,
  onOpenSavedDesigns,
  user,
  onClose,
}) {
  const isPage = variant === "page";

  // Edit/Done ink-checkmark toggle — identical in both variants.
  const editToggle = cart.length > 0 && (
    cartEditMode ? (
      // Done — ink circle with a white checkmark (Apple's
      // edit-confirm affordance, in the brand's ink rather than
      // Apple blue so it sits in the warm palette).
      <button
        onClick={() => onToggleEdit(false)}
        aria-label="Done editing cart"
        className="flex items-center justify-center transition-transform active:scale-95"
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: "var(--ink)",
          color: "var(--text-on-ink)",
        }}
      >
        <Check size={17} strokeWidth={2.5} />
      </button>
    ) : (
      <button
        onClick={() => onToggleEdit(true)}
        className="text-sm transition-opacity hover:opacity-70"
        style={{ color: "#B08842", fontWeight: 500 }}
      >
        Edit
      </button>
    )
  );

  return (
    <>
      {isPage ? (
        // Apple Bag-style header: large title left, Edit/Done right,
        // no X (the customer navigates away via the bottom nav).
        // Padding mirrors MobilePageHeader (pt-14 / px-6).
        <div className="px-6 pt-14 pb-4 flex items-center justify-between">
          <h1
            className="font-display leading-tight"
            style={{
              fontSize: "2.1rem",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--text-primary)",
            }}
          >
            Your Cart
          </h1>
          <div className="flex items-center gap-4 flex-shrink-0">{editToggle}</div>
        </div>
      ) : (
        // Compact drawer header: "Your cart" + Edit/Done + X close.
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: "rgba(26,22,18,0.1)" }}>
          <h3 className="font-display text-2xl" style={{ fontWeight: 400 }}>Your cart</h3>
          <div className="flex items-center gap-4">
            {editToggle}
            <button onClick={onClose} aria-label="Close cart" data-tooltip="Close" data-tooltip-pos="left"><X size={20} /></button>
          </div>
        </div>
      )}

      {/* Free-shipping progress nudge — renders nothing unless
          CONFIG.FREE_SHIPPING_ENABLED is flipped on. Lives above
          the item list so it's the first thing the customer sees
          when there are items in the cart. */}
      {cart.length > 0 && <FreeShippingProgress subtotalCents={Math.round(subtotal * 100)} />}

      {cart.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
          <ShoppingBag size={32} strokeWidth={1} className="opacity-30 mb-4" />
          <p className="opacity-75 mb-2" style={{ fontWeight: 500 }}>Your cart is empty.</p>
          <p className="text-xs opacity-55 mb-6 max-w-xs leading-relaxed">
            Lusik stitches each blanket to order. Start with the alphabet picker below.
          </p>
          <button
            onClick={onShopBlankets}
            className="px-6 py-3 text-xs tracking-[0.2em] uppercase mb-4"
            style={{ background: "var(--ink)", color: "var(--text-on-ink)", fontWeight: 500 }}
          >
            Shop the blanket
          </button>
          {user && (
            <button
              onClick={onOpenSavedDesigns}
              className="text-[0.65rem] tracking-[0.18em] uppercase opacity-60 hover:opacity-100 underline underline-offset-4 transition"
            >
              Or open a saved design →
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto">
            {cart.map((item) => (
              <SwipeableRow key={item.id} onSwipeDelete={() => removeFromCart(item.id)}>
                <div className="flex gap-4 p-6 border-b" style={{ borderColor: "rgba(26,22,18,0.08)" }}>
                  <div className="relative">
                    <img src={item.image || PRODUCT.gallery[0]} alt={item.name} className="w-20 h-24 object-cover" style={{ background: "var(--bg-subtle)", border: item.isCustom ? "1px solid rgba(176,136,66,0.3)" : "none" }} />
                    {item.isCustom && (
                      <span className="absolute -top-1.5 -right-1.5 text-[0.55rem] tracking-[0.15em] uppercase px-1.5 py-0.5" style={{ background: "#B08842", color: "#F5EFE3", fontWeight: 500 }}>Custom</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-display text-lg leading-tight" style={{ fontWeight: 400 }}>{item.name}</p>
                    <div className="flex items-center gap-2 mb-3">
                      {item.colorHex && <span className="w-3 h-3 rounded-full inline-block" style={{ background: item.colorHex, border: "1px solid rgba(26,22,18,0.15)" }} />}
                      <p className="text-xs opacity-60">{item.subtitle}</p>
                    </div>
                    {cartEditMode ? (
                      <div className="flex items-center justify-between">
                        <QuantityPicker
                          value={item.qty}
                          onChange={(q) => setQtyExact(item.id, q)}
                          onRemove={() => removeFromCart(item.id)}
                          productName={item.name}
                        />
                        <p className="text-sm" style={{ fontWeight: 500 }}>${item.price * item.qty}</p>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-xs opacity-60" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>Qty: {item.qty}</p>
                        <p className="text-sm" style={{ fontWeight: 500 }}>${item.price * item.qty}</p>
                      </div>
                    )}
                  </div>
                  {cartEditMode && (
                    <button onClick={() => removeFromCart(item.id)} className="opacity-40 hover:opacity-100" aria-label="Remove from cart"><X size={14} /></button>
                  )}
                </div>
              </SwipeableRow>
            ))}
          </div>
          <div
            className="border-t p-6"
            style={{
              borderColor: "rgba(26,22,18,0.1)",
              // On the page variant, clear the fixed bottom-nav island
              // so the Checkout button + payments row aren't covered.
              paddingBottom: isPage ? 120 : undefined,
            }}
          >
            {cart.some((i) => i.isCustom) && (
              <div className="mb-4 p-3 text-xs leading-relaxed" style={{ background: "rgba(176,136,66,0.1)", border: "1px solid rgba(176,136,66,0.3)" }}>
                <span style={{ color: "#B08842", fontWeight: 500 }}>Custom orders:</span> Your uploaded designs are saved with your order. We'll email you a proof of your stitched design before running it through the embroidery machine.
              </div>
            )}
            <div className="flex justify-between mb-3 text-sm">
              <span className="opacity-70">Subtotal</span>
              <span style={{ fontWeight: 500 }}>${subtotal.toFixed(2)}</span>
            </div>
            <ShippingEstimator subtotalCents={Math.round(subtotal * 100)} />
            <p className="text-[0.65rem] opacity-55 italic leading-relaxed mb-4">Made to order — every blanket starts after Lusik receives your order.</p>
            <button onClick={onCheckout} className="w-full py-4 text-sm tracking-wide flex items-center justify-center gap-2" style={{ background: "var(--ink)", color: "var(--text-on-ink)" }}>
              Checkout <ArrowRight size={16} />
            </button>
            {/* Trust signal: which payment methods Stripe will accept on
                the next page. Sized smaller than the CTA so it informs
                without competing. */}
            <PaymentMethodsRow className="mt-4" />
            <p className="text-xs text-center opacity-60 mt-3">
              Or <button onClick={() => window.open("https://instagram.com", "_blank", "noopener,noreferrer")} className="underline">DM us on Instagram</button> to order
            </p>
          </div>
        </>
      )}
    </>
  );
}
