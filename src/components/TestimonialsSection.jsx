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
// MIRRORED FROM index.html (~line 3731). Co-located the
// testimonials data with the component because it's small,
// only used here, and feels less like "data" than the larger
// catalog / config structures.
// ============================================================

import React from "react";

const _LUSIK_TESTIMONIALS = [
  {
    // ⚠️ TODO_LUSIK: replace with a real quote from a real customer
    // who's said yes to being attributed.
    quote: "Lusik made one for my niece and one for my godson. The work is just beautiful — you can feel every stitch.",
    name:  "Anna",
    place: "Glendale, CA",
  },
  {
    // ⚠️ TODO_LUSIK: ditto.
    quote: "I asked her to do a name in Armenian and the year. She emailed me a photo before shipping. Worth every penny.",
    name:  "Sevan",
    place: "Pasadena, CA",
  },
  {
    // ⚠️ TODO_LUSIK: ditto.
    quote: "Three years, three blankets — one for each grandchild. These are going to be heirlooms.",
    name:  "Lily",
    place: "Burbank, CA",
  },
];

export function TestimonialsSection() {
  return (
    <section className="max-w-6xl mx-auto px-6 lg:px-12 py-16 lg:py-24">
      <div className="text-center mb-10 lg:mb-14 max-w-xl mx-auto">
        <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: "#B08842" }}>From customers</p>
        <h2 className="font-display text-3xl lg:text-4xl" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>
          Notes from <em style={{ fontWeight: 400 }}>past orders</em>.
        </h2>
      </div>
      <div className="grid md:grid-cols-3 gap-10 lg:gap-12">
        {_LUSIK_TESTIMONIALS.map((t, i) => (
          <figure key={i} className="text-center md:text-left">
            <blockquote className="font-display italic text-lg lg:text-xl leading-relaxed mb-5" style={{ fontWeight: 400, color: "#3D332A" }}>
              {"“"}{t.quote}{"”"}
            </blockquote>
            <figcaption className="text-[0.65rem] tracking-[0.2em] uppercase opacity-70">
              <span style={{ fontWeight: 500 }}>{t.name}</span>
              {t.place && <span className="opacity-70"> · {t.place}</span>}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
