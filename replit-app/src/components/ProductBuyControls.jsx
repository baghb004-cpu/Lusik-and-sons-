// ============================================================
// ProductBuyControls — the ONE buy surface (Chunk 1)
// ============================================================
// The JS sibling of ios/LusikSons/Views/ProductBuyControls.swift.
// The classic detail page renders it now; Chunk 2's immersive pill
// sheet renders THIS SAME component, so pricing, variant keys, and
// add-to-bag behavior can never drift between presentations.
// The add haptic fires inside the cart store (iOS Chunk-8 rule).

import React, { useEffect, useRef, useState } from "react";
import { useCart } from "../state/CartContext.jsx";

export function ProductBuyControls({ product }) {
  const cart = useCart();
  const [withCap, setWithCap] = useState(false);
  const [added, setAdded] = useState(false);
  const addedTimer = useRef(null);
  useEffect(() => () => clearTimeout(addedTimer.current), []);

  const displayPrice = withCap ? (product.capPriceDollars ?? product.priceDollars) : product.priceDollars;

  const addToBag = () => {
    cart.add({
      id: `${product.id}${withCap ? "-with-cap" : ""}`,
      checkoutKey: withCap ? (product.capVariantKey ?? product.checkoutKey) : product.checkoutKey,
      name: product.name,
      subtitle: withCap ? "With matching cap" : product.tagline,
      priceDollars: displayPrice,
      qty: 1,
      photoURL: product.photoURLs[0] ?? null,
    });
    setAdded(true);
    clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setAdded(false), 1600);
  };

  return (
    <div className="buy-controls">
      <p className="buy-eyebrow">Made to order · From Lusik's home in Southern California</p>
      <h1 className="buy-name brand-display">{product.name}</h1>
      <p className="buy-tagline">{product.tagline}</p>

      {product.capPriceDollars != null && (
        <label className="buy-cap-toggle">
          <span>
            <span className="buy-cap-title">Add the matching baby cap</span>
            <span className="buy-cap-prices">
              ${product.priceDollars} without · ${product.capPriceDollars} with
            </span>
          </span>
          <input
            type="checkbox"
            checked={withCap}
            onChange={(e) => setWithCap(e.target.checked)}
            aria-label="Add the matching baby cap"
          />
          <span className="buy-cap-switch" aria-hidden="true" />
        </label>
      )}

      <p className="buy-price brand-display">${displayPrice}</p>

      <button type="button" className="buy-add pill pill-ink" onClick={addToBag} aria-label={`Add to Bag, $${displayPrice}`}>
        {added ? "Added ✓" : `Add to Bag — $${displayPrice}`}
      </button>

      <p className="buy-shipnote">
        Made to order — hand-stitched in about two weeks, then shipped to your door. Shipping is
        priced by distance from Lusik's workshop in Buena Park, CA; free over $150.
      </p>
    </div>
  );
}
