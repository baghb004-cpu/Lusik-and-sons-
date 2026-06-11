// ============================================================
// Bag — the bag tab (Chunk 4)
// ============================================================
// The JS sibling of ios/LusikSons/Views/BagView.swift: rows with
// photo + title that tap back to the product page (read-again, not
// re-add — qty lives HERE), a qty stepper (minus at 1 removes, like
// the website), swipe-to-delete, the bundle-savings line with its
// add-another nudge, the free-shipping progress bar, the empty
// state, and the checkout hand-off (Chunk 5 wires the real flow).

import React, { useEffect, useRef, useState } from "react";
import { useCart } from "../state/CartContext.jsx";
import { useHashRoute } from "../lib/useHashRoute.js";

export function Bag() {
  const cart = useCart();
  const { navigate } = useHashRoute();

  if (cart.items.length === 0) {
    return (
      <div className="placeholder-panel">
        <h2>Your bag is empty.</h2>
        <p>
          Everything is made to order by Lusik —<br />
          find something worth keeping in Products.
        </p>
        <button type="button" className="pill pill-outline" onClick={() => navigate("products")}>
          Browse the shop
        </button>
      </div>
    );
  }

  return (
    <div className="bag-page readable">
      <h1 className="page-title">Bag</h1>

      <div className="bag-rows">
        {cart.items.map((item) => (
          <BagRow
            key={item.id}
            item={item}
            onOpen={() => {
              const p = cart.productFor(item);
              if (p) navigate(`products/${p.categorySlug}/${p.productSlug}`);
            }}
            onQty={(q) => (q < 1 ? cart.remove(item.id) : cart.setQty(item.id, q))}
            onRemove={() => cart.remove(item.id)}
          />
        ))}
      </div>

      <div className="bag-summary">
        <div className="bag-line">
          <span className="bag-muted">Subtotal</span>
          <span className="bag-strong">${cart.subtotalDollars}.00</span>
        </div>

        {cart.bundleSavingsDollars > 0 ? (
          <div className="bag-line">
            <span className="bag-muted">Bundle savings ({cart.unitCount} pieces)</span>
            <span className="bag-savings">−${cart.bundleSavingsDollars.toFixed(2)}</span>
          </div>
        ) : (
          <p className="bag-nudge">
            Add another piece and save $1.00 — every additional piece takes another $1.00 off.
          </p>
        )}

        <div className="bag-shipping">
          <div className="bag-progress" role="progressbar" aria-valuemin={0} aria-valuemax={1} aria-valuenow={cart.freeShippingProgress}>
            <span style={{ width: `${cart.freeShippingProgress * 100}%` }} />
          </div>
          <p className="bag-progress-note">
            {cart.qualifiesForFreeShipping
              ? "You've earned free U.S. shipping."
              : `$${cart.dollarsAwayFromFreeShipping} away from free U.S. shipping.`}
          </p>
        </div>

        <button type="button" className="pill pill-ink bag-checkout" onClick={() => navigate("bag/checkout")}>
          Checkout
        </button>

        <p className="bag-footnote">
          Tax and shipping calculated at checkout. Shipping is priced by distance from Buena
          Park, CA — free over ${cart.freeShippingThresholdDollars}.
        </p>
      </div>
    </div>
  );
}

// ── one swipeable row ──
// touch-action: pan-y keeps vertical scrolling native; horizontal drags
// arrive as captured pointer events and slide the row open over the
// Delete button. Honors prefers-reduced-motion (no slide animation).
const REVEAL_PX = 88;
const OPEN_THRESHOLD = 56;

function BagRow({ item, onOpen, onQty, onRemove }) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef(null);
  const wasOpen = useRef(false);

  // A removed-and-re-added row starts closed.
  useEffect(() => () => { drag.current = null; }, []);

  const onDown = (e) => {
    drag.current = { startX: e.clientX, startY: e.clientY, startOffset: offset, horizontal: null };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (d.horizontal == null && Math.hypot(dx, dy) > 8) d.horizontal = Math.abs(dx) > Math.abs(dy);
    if (!d.horizontal) return;
    setDragging(true);
    setOffset(Math.max(-REVEAL_PX, Math.min(0, d.startOffset + dx)));
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d) return;
    if (d.horizontal) {
      const open = offset < -OPEN_THRESHOLD;
      wasOpen.current = open;
      setOffset(open ? -REVEAL_PX : 0);
    }
  };

  const rowTap = () => {
    // Tapping an open row closes it; tapping a closed row opens the product.
    if (wasOpen.current || offset !== 0) {
      wasOpen.current = false;
      setOffset(0);
      return;
    }
    onOpen();
  };

  return (
    <div className="bag-row-wrap">
      <button type="button" className="bag-delete" onClick={onRemove} aria-label={`Remove ${item.name} from bag`}>
        Delete
      </button>
      <div
        className={dragging ? "bag-row bag-row-dragging" : "bag-row"}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <button type="button" className="bag-row-main" onClick={rowTap} aria-label={`View ${item.name} product page`}>
          {item.photoURL ? <img src={item.photoURL} alt="" loading="lazy" draggable={false} /> : <span className="bag-thumb-empty" />}
          <span className="bag-row-text">
            <span className="bag-row-name brand-display">{item.name}</span>
            <span className="bag-row-sub">{item.subtitle}</span>
          </span>
        </button>
        <div className="bag-row-foot">
          <div className="bag-stepper" role="group" aria-label={`Quantity ${item.qty}`}>
            <button type="button" onClick={() => onQty(item.qty - 1)} aria-label={item.qty === 1 ? "Remove" : "Decrease quantity"}>−</button>
            <span>{item.qty}</span>
            <button type="button" onClick={() => onQty(item.qty + 1)} aria-label="Increase quantity">+</button>
          </div>
          <span className="bag-row-price">${item.priceDollars * item.qty}</span>
        </div>
      </div>
    </div>
  );
}
