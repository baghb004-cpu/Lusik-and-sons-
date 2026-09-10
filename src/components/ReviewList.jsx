"use client";

// ============================================================
// Approved reviews, under the testimonials
// ============================================================
// The CMS testimonials above these are chosen by Lusik. These are not:
// they are what customers wrote, in their own words, after a fortnight
// with the piece — approved, but not selected for being flattering.
// Keeping them in a separate block, below, is the honest arrangement.
//
// It renders nothing at all until there are reviews. A product page that
// says "no reviews yet" is a page advertising that nobody has bought
// this, which is not information a customer needs and not true of a shop
// where most orders are gifts that nobody reviews.
//
// The fetch never throws upward: reviews are decoration on a page whose
// job is to sell a blanket.
// ============================================================

import React, { useEffect, useState } from "react";
import { db } from "../lib/db.js";
import { CONFIG } from "../data/config.js";

function Stars({ n }) {
  const rounded = Math.max(1, Math.min(5, Math.round(Number(n) || 0)));
  return (
    <span aria-label={`${rounded} out of 5`} style={{ color: "var(--accent-text)", letterSpacing: "0.1em" }}>
      {"★".repeat(rounded)}
      <span style={{ color: "var(--border-strong)" }}>{"★".repeat(5 - rounded)}</span>
    </span>
  );
}

const photoUrl = (key) => `${CONFIG.FN_BASE}/review-photo-get?key=${encodeURIComponent(key)}`;

/**
 * @param {object} props
 * @param {string} props.productKey the TRUSTED key, which is what a
 *   review is stored against — order_items carries the checkout key, not
 *   the catalog slug.
 */
export function ReviewList({ productKey, className = "" }) {
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    let alive = true;
    if (!productKey) return undefined;
    db.getReviews(productKey).then((rows) => { if (alive) setReviews(rows); });
    return () => { alive = false; };
  }, [productKey]);

  if (reviews.length === 0) return null;

  return (
    <section className={className} aria-labelledby="reviews-heading" data-reviews>
      <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: "var(--accent-text)" }}>
        From the families
      </p>
      <h2 id="reviews-heading" className="font-display text-2xl lg:text-3xl mb-6 leading-tight" style={{ fontWeight: 400 }}>
        {reviews.length === 1 ? "One note about this piece" : `${reviews.length} notes about this piece`}
      </h2>

      <ul className="grid sm:grid-cols-2 gap-5">
        {reviews.map((r, i) => (
          <li
            key={i}
            className="p-5"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
          >
            <Stars n={r.rating} />
            {r.body && (
              <p className="text-sm leading-relaxed mt-3" style={{ color: "var(--text-secondary)" }}>
                {r.body}
              </p>
            )}
            {r.photoKey && (
              /* Served by review-photo-get, which re-checks approval and
                 consent on every request — so withdrawing either takes
                 the picture down without touching this page. */
              <img
                src={photoUrl(r.photoKey)}
                alt=""
                aria-hidden="true"
                loading="lazy"
                decoding="async"
                className="mt-3 w-full h-auto"
                style={{ border: "1px solid var(--border-soft)" }}
              />
            )}
            <p className="text-[0.65rem] tracking-[0.15em] uppercase mt-3" style={{ color: "var(--text-muted)" }}>
              {r.name ? r.name : "A customer"} &middot; verified order
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
