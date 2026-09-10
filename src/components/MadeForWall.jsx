"use client";

// ============================================================
// The "Made for" wall
// ============================================================
// Photographs customers sent of a finished piece in use, shown at the
// top of /gallery above the archive.
//
// Every one of these needed TWO separate yeses: the customer ticked
// "I'm happy for a photo of the piece to appear on the site", and Lusik
// approved the review it came with. Either one going away takes the
// picture down — review-photo-get re-checks both on every request, so a
// withdrawn consent stops serving the image without anybody editing
// this page or deleting a file.
//
// It renders nothing until there is something to show. An empty wall
// with a heading is a page saying "nobody has sent us anything", which
// is not a thing to put on a shop.
// ============================================================

import React, { useEffect, useState } from "react";
import { db } from "../lib/db.js";
import { CONFIG } from "../data/config.js";

const photoUrl = (key) => `${CONFIG.FN_BASE}/review-photo-get?key=${encodeURIComponent(key)}`;

export function MadeForWall({ className = "" }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let alive = true;
    db.getReviewWall().then((r) => { if (alive) setRows(r); });
    return () => { alive = false; };
  }, []);

  if (rows.length === 0) return null;

  return (
    <section className={className} aria-labelledby="made-for-heading" data-made-for-wall>
      <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: "var(--accent-text)" }}>
        Made for
      </p>
      <h2 id="made-for-heading" className="font-display text-2xl lg:text-3xl mb-2 leading-tight" style={{ fontWeight: 400 }}>
        Pieces in the houses they went to
      </h2>
      <p className="text-sm leading-relaxed mb-6 max-w-2xl" style={{ color: "var(--text-secondary)" }}>
        Sent in by the families who own them, and shown here with their permission.
      </p>

      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
        {rows.map((r, i) => (
          <li key={i} className="relative">
            <img
              src={photoUrl(r.photoKey)}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              className="w-full aspect-square object-cover"
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-soft)" }}
            />
            {r.name && (
              <p className="text-[0.6rem] tracking-[0.15em] uppercase mt-1.5" style={{ color: "var(--text-muted)" }}>
                {r.name}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
