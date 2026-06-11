// ============================================================
// TestimonialsSection — three quotes, no ratings, no stars
// ============================================================
// Quiet trust signal — three quotes from customers. NOT a
// ratings widget; no stars, no Trustpilot scrape. The point
// is to land that real people have ordered this and felt
// something about it.
//
// ⚠️ TODO_LUSIK: the quotes below are placeholder content
// using realistic Armenian-American customer names. Before
// launch, swap them with actual quotes from customers who
// said yes to being quoted. Email Lusik to ask which of her
// past customers she'd be comfortable attributing this way;
// first name + city is the lightest-touch attribution that
// still feels credible.
//
// testimonials data with the component because it's small,
// only used here, and feels less like "data" than the larger
// catalog / config structures.
// ============================================================

import React from "react";

// Quotes are CMS-managed (Content Studio /studio → Site Content →
// Testimonials; content/pages/testimonials.json). The section shows the
// FIRST THREE — reordering the list in the Studio chooses which three.
// The seed quotes are placeholders; swapping in real attributed customer
// quotes is now a Studio edit, no deploy ritual needed (TODO_LUSIK lives
// in the Studio hint).
import { CMS_PAGES } from "../data/pagesData.generated.js";
import { StitchDivider } from "./Theater.jsx";

export function TestimonialsSection() {
  return (
    <section className="max-w-6xl mx-auto px-6 lg:px-12 py-16 lg:py-24">
      <div className="text-center mb-10 lg:mb-14 max-w-xl mx-auto">
        {/* A cross-stitch rule that sews itself in as it scrolls into view. */}
        <StitchDivider className="mb-6" />
        <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: "var(--accent-text)" }}>{CMS_PAGES.testimonials.eyebrow}</p>
        <h2 className="font-display text-3xl lg:text-4xl" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>
          {CMS_PAGES.testimonials.titlePre}<em style={{ fontWeight: 400 }}>{CMS_PAGES.testimonials.titleEm}</em>.
        </h2>
      </div>
      <div className="grid md:grid-cols-3 gap-10 lg:gap-12">
        {CMS_PAGES.testimonials.quotes.slice(0, 3).map((t, i) => (
          <figure key={i} className="vt-rise text-center md:text-left">
            <blockquote className="font-display italic text-lg lg:text-xl leading-relaxed mb-5" style={{ fontWeight: 400, color: "#3D332A" }}>
              {"“"}{t.quote}{"”"}
            </blockquote>
            <figcaption className="text-[0.65rem] tracking-[0.2em] uppercase opacity-70">
              <span style={{ fontWeight: 500 }}>{t.name}</span>
              {t.place && <span> · {t.place}</span>}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
