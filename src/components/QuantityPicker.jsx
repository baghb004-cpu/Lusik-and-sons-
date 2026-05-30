"use client";

// ============================================================
// QuantityPicker — three-piece inline qty control + tap-to-open
//                  popover list (Amazon / Walmart / Apple Store
//                  mobile pattern, brought into the brand palette)
// ============================================================
// Renders an inline [ −  N  + ] strip where:
//   * Minus on N=1 routes to onRemove (same flow as the old
//     updateQty wrapper -- prevents stranding an item on a no-op).
//   * Plus is disabled at `max` (default 12) -- realistic cap for a
//     hand-stitched-by-Lusik order; bulk requests go through email.
//   * Tapping the number opens a popover above/below the strip
//     listing 1 through `max`, with the current value circled in
//     ink and a "Remove" affordance pinned at the top. Selecting
//     a number calls onChange(n) and closes; "Remove" calls
//     onRemove and closes.
//
// At the bottom of the popover, a quiet "Need more? Write Lusik"
// link drops the customer into an email draft for bulk orders --
// the same hand-off the homepage Contact section already uses for
// special requests.
//
// Styling is brand-palette: cream sheet, Fraunces numbers, ink
// circle on the selected value, soft gold accent strip at the
// bottom. No Walmart blue, no Walmart white -- the interaction is
// the borrowed pattern, the look is ours.
//
// Accessibility:
//   * Trigger is a real <button> with aria-haspopup="listbox" +
//     aria-expanded.
//   * Popover is role="listbox" with role="option" items.
//   * Click-outside, Escape, and Tab-out all close.
//   * Focus is captured into the popover on open and returned to
//     the trigger on close.
//   * Arrow Up / Down step the focused option; Enter selects.
// ============================================================

import React, { useEffect, useRef, useState } from "react";
import { Minus, Plus, X } from "./icons.jsx";
import { haptic } from "../lib/haptic.js";

const BULK_EMAIL = "hello@lusikandsons.com";
const BULK_SUBJECT = "Bulk order request";

export function QuantityPicker({
  value,
  onChange,
  onRemove,
  max = 12,
  min = 1,
  // Optional product name -- if passed, it's prefilled in the
  // bulk-order email subject so Lusik can tell which piece the
  // customer wants more of.
  productName = "",
}) {
  const [open, setOpen] = useState(false);
  // Index of the currently keyboard-focused option in the popover.
  // Initialized to the index of `value` so arrow keys move from
  // the user's current pick, not from 1.
  const [focusIdx, setFocusIdx] = useState(value - min);

  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const optionRefs = useRef([]);

  const options = [];
  for (let n = min; n <= max; n += 1) options.push(n);

  // --- Open / close orchestration --------------------------------
  // Click-outside dismisses. Note the popover and trigger are both
  // checked so clicking either doesn't fire a close-then-reopen
  // race in the same tick.
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (popoverRef.current?.contains(e.target)) return;
      if (triggerRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  // Escape closes + returns focus to the trigger so keyboard users
  // don't get stranded.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // When the popover opens, focus the currently-selected option so
  // arrow keys feel anchored to where the user is.
  useEffect(() => {
    if (!open) return;
    const idx = Math.max(0, Math.min(options.length - 1, value - min));
    setFocusIdx(idx);
    // Defer one tick so the DOM nodes exist.
    const t = setTimeout(() => optionRefs.current[idx]?.focus(), 0);
    return () => clearTimeout(t);
    // value/min/max changes don't need to re-run; we only want this
    // on open transitions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Sync focus ring to focusIdx changes (arrow-key navigation).
  useEffect(() => {
    if (!open) return;
    optionRefs.current[focusIdx]?.focus();
  }, [focusIdx, open]);

  // --- Handlers --------------------------------------------------
  const handleMinus = () => {
    if (value <= min) {
      onRemove?.();
      return;
    }
    onChange?.(value - 1);
  };
  const handlePlus = () => {
    if (value >= max) return;          // capped; bulk route is the email below
    onChange?.(value + 1);
  };
  const handlePick = (n) => {
    haptic(8);
    onChange?.(n);
    setOpen(false);
    triggerRef.current?.focus();
  };
  const handleRemove = () => {
    haptic(12);
    onRemove?.();
    setOpen(false);
  };
  const handleListKey = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIdx((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setFocusIdx(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setFocusIdx(options.length - 1);
    }
  };

  const minusLabel = value === min ? "Remove from cart" : "Decrease quantity";
  const bulkHref = `mailto:${BULK_EMAIL}?subject=${encodeURIComponent(
    productName ? `${BULK_SUBJECT} — ${productName}` : BULK_SUBJECT,
  )}`;

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {/* INLINE STRIP -- minus / number / plus */}
      <div
        className="flex items-center gap-1"
        style={{ border: "1px solid rgba(26,22,18,0.15)" }}
      >
        <button
          type="button"
          onClick={handleMinus}
          className="p-2 hover:opacity-60 transition-opacity"
          aria-label={minusLabel}
        >
          <Minus size={12} strokeWidth={1.75} />
        </button>
        {/* Number is a real button so screen readers + keyboard nav
            land on it naturally. Fraunces serif at slightly larger
            size so the digits read as considered, not utilitarian. */}
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="px-1 hover:opacity-70 transition-opacity"
          style={{
            minWidth: "1.75rem",
            fontFamily: "Fraunces, Georgia, serif",
            fontSize: "0.95rem",
            fontWeight: 500,
            letterSpacing: "-0.01em",
            color: "#1A1612",
          }}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Quantity: ${value}. Tap to change.`}
        >
          {value}
        </button>
        <button
          type="button"
          onClick={handlePlus}
          disabled={value >= max}
          className="p-2 hover:opacity-60 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label={value >= max ? `Maximum quantity is ${max}` : "Increase quantity"}
        >
          <Plus size={12} strokeWidth={1.75} />
        </button>
      </div>

      {/* POPOVER LIST -- opens beneath the strip. Width matches the
          strip's natural width plus a little breathing room; max
          height caps the scroll for long lists or short cart drawers. */}
      {open && (
        <div
          ref={popoverRef}
          role="listbox"
          aria-label="Quantity"
          aria-activedescendant={`qty-opt-${options[focusIdx]}`}
          onKeyDown={handleListKey}
          tabIndex={-1}
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 30,
            minWidth: "7.5rem",
            maxHeight: "17rem",
            overflowY: "auto",
            background: "#F5EFE3",
            border: "1px solid rgba(26,22,18,0.18)",
            boxShadow: "0 12px 28px -8px rgba(26,22,18,0.28)",
            borderRadius: "2px",
            padding: "0.25rem 0",
          }}
        >
          {/* REMOVE -- pinned at the top, deliberately the only
              brand-red element in the picker so it reads as the
              destructive action without needing a confirm dialog. */}
          <button
            type="button"
            onClick={handleRemove}
            className="w-full text-left px-4 py-2.5 hover:bg-[rgba(139,44,44,0.06)] transition-colors flex items-center gap-2"
            style={{
              color: "#8B2C2C",
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontSize: "0.85rem",
              fontWeight: 500,
              borderBottom: "1px solid rgba(26,22,18,0.08)",
            }}
          >
            <X size={13} strokeWidth={1.75} />
            <span>Remove</span>
          </button>

          {/* NUMBER OPTIONS -- Fraunces serif, ink ring on the
              currently-selected value. Each is a real button so
              tab + Enter work without custom keyhandling. */}
          {options.map((n, i) => {
            const selected = n === value;
            const focused = i === focusIdx;
            return (
              <button
                key={n}
                id={`qty-opt-${n}`}
                ref={(el) => { optionRefs.current[i] = el; }}
                role="option"
                aria-selected={selected}
                tabIndex={focused ? 0 : -1}
                type="button"
                onClick={() => handlePick(n)}
                className="w-full flex items-center justify-center py-2 transition-colors hover:bg-[rgba(176,136,66,0.08)]"
                style={{
                  fontFamily: "Fraunces, Georgia, serif",
                  fontSize: "1.05rem",
                  fontWeight: 500,
                  color: "#1A1612",
                  background: selected ? "transparent" : "transparent",
                  outline: "none",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "2rem",
                    height: "2rem",
                    // Selected number gets the ink circle (ours --
                    // Walmart's was thin blue). Unselected sits in
                    // the cream with no ring, so the eye finds the
                    // current pick first.
                    border: selected ? "1.5px solid #1A1612" : "1.5px solid transparent",
                    borderRadius: "999px",
                  }}
                >
                  {n}
                </span>
              </button>
            );
          })}

          {/* BULK-ORDER ROUTE -- the alternative to scrolling past
              12. Quiet gold link, mailto: with a subject prefilled
              so the conversation starts already on-topic. Same
              "write Lusik" voice as the placeholder pages + waitlist
              modal. */}
          <div
            style={{
              borderTop: "1px solid rgba(26,22,18,0.08)",
              padding: "0.5rem 1rem 0.6rem",
              background: "rgba(176,136,66,0.04)",
            }}
          >
            <a
              href={bulkHref}
              className="block text-center transition-opacity hover:opacity-70"
              style={{
                fontFamily: "'DM Sans', system-ui, sans-serif",
                fontSize: "0.7rem",
                letterSpacing: "0.05em",
                color: "#B08842",
                fontWeight: 500,
                textDecoration: "none",
              }}
              onClick={() => setOpen(false)}
            >
              Need more than {max}? Write Lusik →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
