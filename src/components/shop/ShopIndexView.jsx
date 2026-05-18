// ============================================================
// ShopIndexView — /shop landing page
// ============================================================
// The "everything Lusik makes" hub. Four large category cards
// linking to /shop/<categorySlug>. Each card shows the category
// label, an eyebrow, a short description, and the count of
// products in that category (live + placeholder combined). No
// product detail surfaces here — this is a navigation step, not
// a buying surface.
//
// Renders quickly and minimally; the heavy lifting (product
// galleries, configurators) lives one level deeper.
// ============================================================

import React from "react";
import { CATALOG } from "../../data/catalog.js";
import { Breadcrumbs } from "./Breadcrumbs.jsx";
import { ArrowRight } from "../icons.jsx";

export function ShopIndexView({ onNavigateHome, onNavigateCategory }) {
  return (
    <div className="fade-in max-w-6xl mx-auto px-6 lg:px-12 py-12 lg:py-16">
      <Breadcrumbs trail={[
        { label: "Home", onClick: onNavigateHome },
        { label: "Shop" },
      ]} />

      <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: "#B08842" }}>The shop</p>
      <h1 className="font-display text-4xl lg:text-6xl mb-4" style={{ fontWeight: 400, letterSpacing: "-0.02em" }}>
        Everything Lusik <em style={{ fontWeight: 400 }}>makes</em>.
      </h1>
      <p className="text-base lg:text-lg opacity-75 max-w-2xl leading-relaxed mb-12 lg:mb-16">
        Cross-stitched blankets, embroidered bibs, ceremonial towels, and small things for the very first days. Pick a category to see what's available.
      </p>

      <div className="grid sm:grid-cols-2 gap-5 lg:gap-6">
        {Object.entries(CATALOG).map(([_, category]) => {
          const total       = category.products.length;
          const liveCount   = category.products.filter((p) => p.status === "live").length;
          const subtitleParts = [];
          if (liveCount > 0)   subtitleParts.push(`${liveCount} available now`);
          if (total - liveCount > 0) subtitleParts.push(`${total - liveCount} coming soon`);

          return (
            <button
              key={category.slug}
              onClick={() => onNavigateCategory(category.slug)}
              className="lg-button lg-shine text-left p-6 lg:p-8 transition"
              aria-label={`Browse ${category.label}`}
            >
              <p className="text-[0.6rem] tracking-[0.3em] uppercase mb-3" style={{ color: "#B08842" }}>
                {category.eyebrow}
              </p>
              <h2 className="font-display text-2xl lg:text-3xl mb-2" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>
                {category.label}
              </h2>
              <p className="text-sm opacity-75 leading-relaxed mb-5">
                {category.description}
              </p>
              <div className="flex items-center justify-between gap-3 pt-3" style={{ borderTop: "1px solid rgba(26,22,18,0.10)" }}>
                <p className="text-[0.65rem] tracking-[0.2em] uppercase opacity-65">
                  {subtitleParts.join(" · ")}
                </p>
                <span className="text-[0.65rem] tracking-[0.2em] uppercase flex items-center gap-1.5" style={{ color: "#B08842", fontWeight: 500 }}>
                  Browse <ArrowRight size={12} strokeWidth={1.75} />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
