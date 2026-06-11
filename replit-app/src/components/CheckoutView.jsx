// ============================================================
// CheckoutView — "Almost in Lusik's hands" (Chunk 5)
// ============================================================
// The JS sibling of ios/LusikSons/Views/CheckoutView.swift: order
// summary with bundle savings + gift wrap, the REQUIRED shipping ZIP
// that prices the zone rate (Pay stays disabled without it; free-
// over-$150 skips it), gift options + the one-year reminder opt-in +
// notes, then POST create-checkout-session with the same body shape
// the website sends (per-attempt idempotency key) and hand off to
// Stripe's hosted page via a same-tab redirect. The ?order=success
// return is handled in App.jsx (clear bag → thank-you).

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "../state/CartContext.jsx";
import { isValidZip, estimateShipping } from "../data/shippingZones.js";
import { createCheckoutSession } from "../lib/api.js";

const GIFT_WRAP_DOLLARS = 5; // web GIFT_WRAP_PRICE_CENTS parity
const GIFT_MESSAGE_MAX = 140;
const NOTES_MAX = 280;

export function CheckoutView({ onBack }) {
  const cart = useCart();

  const [shipZip, setShipZip] = useState("");
  const [giftIsGift, setGiftIsGift] = useState(false);
  const [giftMessage, setGiftMessage] = useState("");
  const [giftHidePrices, setGiftHidePrices] = useState(false);
  const [giftWrap, setGiftWrap] = useState(false);
  const [reminderOptIn, setReminderOptIn] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState(null);

  // One idempotency key per checkout attempt page — Stripe replays the
  // same session for an identical retried body.
  const idempotencyKey = useRef(
    crypto.randomUUID?.() ?? `ck_${Date.now()}_${Math.random().toString(36).slice(2)}`
  );

  const freeShipping = cart.qualifiesForFreeShipping;
  const zipValid = isValidZip(shipZip);
  const zipNeeded = !freeShipping && !zipValid;
  const estimate = useMemo(
    () => (freeShipping ? null : estimateShipping(shipZip)),
    [freeShipping, shipZip]
  );

  // An emptied bag has nothing to pay for — fall back to the bag view.
  useEffect(() => {
    if (cart.items.length === 0) onBack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.items.length]);

  const pay = async () => {
    if (busy || zipNeeded || cart.items.length === 0) return;
    setBusy(true);
    setErrorText(null);
    try {
      const url = await createCheckoutSession({
        cart: cart.items.map((i) => ({
          productKey: i.checkoutKey,
          id: i.id,
          qty: i.qty,
          subtitle: i.subtitle,
          isCustom: false,
        })),
        ship_zip: zipValid ? shipZip : null,
        gift: {
          is_gift: giftIsGift,
          message: giftIsGift ? giftMessage : "",
          hide_prices: giftIsGift && giftHidePrices,
          wrap: giftIsGift && giftWrap,
        },
        gift_reminder_opt_in: reminderOptIn,
        customer_notes: notes,
        customerEmail: null, // Stripe's page collects it
        idempotency_key: idempotencyKey.current,
      });
      window.location.assign(url); // Stripe's hosted page, same tab
    } catch (err) {
      setErrorText(err?.message || "Couldn't start checkout. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="checkout readable">
      <button type="button" className="back-link" onClick={onBack} aria-label="Back to bag">
        ‹ Bag
      </button>
      <h1 className="checkout-title brand-display">Almost in Lusik's hands</h1>

      {/* ── order summary ── */}
      <section className="ck-card">
        {cart.items.map((item) => (
          <div key={item.id} className="ck-item">
            <span className="ck-qty">{item.qty} ×</span>
            <span className="ck-name">{item.name}</span>
            <span>${item.priceDollars * item.qty}</span>
          </div>
        ))}
        <hr className="ck-rule" />
        <Row label="Subtotal" value={`$${cart.subtotalDollars}.00`} />
        {cart.bundleSavingsDollars > 0 && (
          <Row
            label={`Bundle savings (${cart.unitCount} pieces)`}
            value={`−$${cart.bundleSavingsDollars.toFixed(2)}`}
            accent
          />
        )}
        {giftIsGift && giftWrap && <Row label="Gift wrap" value={`+$${GIFT_WRAP_DOLLARS}.00`} />}
        {freeShipping ? (
          <Row label="Shipping" value="Free" accent />
        ) : estimate ? (
          <Row label="Shipping" value={`$${estimate.dollars.toFixed(2)}`} />
        ) : (
          <Row label="Shipping" value="Enter ZIP below" muted />
        )}
      </section>

      {/* ── shipping ZIP ── */}
      <section className="ck-card">
        <p className="ck-label">Shipping ZIP code</p>
        {freeShipping ? (
          <p className="ck-note">
            You've earned free U.S. shipping — your address is collected on the Stripe page.
          </p>
        ) : (
          <>
            <input
              className="ck-input ck-zip"
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="90620"
              value={shipZip}
              onChange={(e) => setShipZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
              aria-label="Shipping ZIP code"
            />
            {estimate ? (
              <p className="ck-note ck-note-strong">
                {estimate.label} — ${estimate.dollars.toFixed(2)} · {estimate.daysMin}–{estimate.daysMax} business
                days transit once it ships.
              </p>
            ) : (
              <p className="ck-note">
                Shipping is priced by distance from Lusik's workshop in Buena Park, CA —
                $9.99–$15.49 in the lower 48.
              </p>
            )}
          </>
        )}
      </section>

      {/* ── gift options ── */}
      <section className="ck-card">
        <Toggle label="This is a gift" checked={giftIsGift} onChange={setGiftIsGift} strong />
        {giftIsGift && (
          <>
            <textarea
              className="ck-input"
              rows={2}
              placeholder={`A short note for the card (${GIFT_MESSAGE_MAX} chars)`}
              value={giftMessage}
              onChange={(e) => setGiftMessage(e.target.value.slice(0, GIFT_MESSAGE_MAX))}
              aria-label="Gift card message"
            />
            <Toggle label="Hide prices in the box" checked={giftHidePrices} onChange={setGiftHidePrices} />
            <Toggle label={`Gift wrap (+$${GIFT_WRAP_DOLLARS})`} checked={giftWrap} onChange={setGiftWrap} />
          </>
        )}
        <Toggle label="Remind me about this occasion next year" checked={reminderOptIn} onChange={setReminderOptIn} />
      </section>

      {/* ── notes ── */}
      <section className="ck-card">
        <p className="ck-label">A note for Lusik (optional)</p>
        <textarea
          className="ck-input"
          rows={3}
          placeholder="Anything she should know while stitching?"
          value={notes}
          onChange={(e) => setNotes(e.target.value.slice(0, NOTES_MAX))}
          aria-label="Note for Lusik"
        />
      </section>

      {errorText && <p className="ck-error" role="alert">{errorText}</p>}

      <button
        type="button"
        className="pill pill-ink ck-pay"
        disabled={zipNeeded || busy || cart.items.length === 0}
        onClick={pay}
      >
        {busy ? "Connecting to Stripe…" : zipNeeded ? "Enter ZIP to continue" : "Pay with Stripe"}
      </button>

      <p className="ck-footnote">
        Payment is handled by Stripe on the next screen — Lusik never sees your card. Tax is
        calculated there.
      </p>
    </div>
  );
}

function Row({ label, value, accent = false, muted = false }) {
  return (
    <div className="ck-row">
      <span className="ck-row-label">{label}</span>
      <span className={accent ? "ck-row-accent" : muted ? "ck-row-muted" : "ck-row-value"}>{value}</span>
    </div>
  );
}

function Toggle({ label, checked, onChange, strong = false }) {
  return (
    <label className="ck-toggle">
      <span className={strong ? "ck-toggle-label ck-toggle-strong" : "ck-toggle-label"}>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span className="buy-cap-switch" aria-hidden="true" />
    </label>
  );
}
