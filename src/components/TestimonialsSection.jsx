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
  {
    // TODO_LUSIK: replace with real customer quote once collected (seed content).
    quote: "Got it as a baby shower gift for my best friend. She opened it and just stopped talking. That doesn't happen often.",
    name:  "Diana",
    place: "Glendale, CA",
  },
  {
    // TODO_LUSIK: replace with real customer quote once collected (seed content).
    quote: "I grew up in California but my family is from Yerevan. I wanted my son to grow up with the Armenian alphabet around him. Lusik did the letter exactly the way my mother described it.",
    name:  "Karine",
    place: "La Crescenta, CA",
  },
  {
    // TODO_LUSIK: replace with real customer quote once collected (seed content).
    quote: "My husband is Armenian, I am not. I wanted something for our daughter that would speak to her father's side. Lusik was patient over email and the blanket arrived two days before her christening.",
    name:  "Rachel",
    place: "Brooklyn, NY",
  },
  {
    // TODO_LUSIK: replace with real customer quote once collected (seed content).
    quote: "Found Lusik through a friend's Instagram. I am not Armenian but the craft spoke for itself. The cross-stitch is on a level you do not see from machine-made baby blankets.",
    name:  "Marie",
    place: "Boston, MA",
  },
  {
    // TODO_LUSIK: replace with real customer quote once collected (seed content).
    quote: "Ordered the bib with our son's name. After a year of daily use the embroidery is still perfect. Bought a second one because the first never gets a break.",
    name:  "Vahan",
    place: "Encino, CA",
  },
  {
    // TODO_LUSIK: replace with real customer quote once collected (seed content).
    quote: "My parents in Yerevan saw the blanket when we visited and asked who made it. They cried. I told them: someone in California, like us, who still remembers how.",
    name:  "Sona",
    place: "San Diego, CA",
  },
  {
    // TODO_LUSIK: replace with real customer quote once collected (seed content).
    quote: "We had twins. I asked if she could do two blankets with mirrored borders so they would feel like a set. She said yes without hesitating. They are beautiful side by side in the crib.",
    name:  "Jessica",
    place: "Austin, TX",
  },
  {
    // TODO_LUSIK: replace with real customer quote once collected (seed content).
    quote: "Took a little longer than I expected but Lusik sent me a photo halfway through so I could see the work. The wait was the right kind of wait. My godson has it now.",
    name:  "Hovsep",
    place: "San Francisco, CA",
  },
  {
    // TODO_LUSIK: replace with real customer quote once collected (seed content).
    quote: "Our family speaks Armenian, Arabic, and English. I asked for the first letter of his name in Armenian because that is the alphabet I want him to learn first. Lusik understood immediately.",
    name:  "Maral",
    place: "Tarzana, CA",
  },
  {
    // TODO_LUSIK: replace with real customer quote once collected (seed content).
    quote: "I bought it as a gift for a coworker's first baby. She is Armenian, I am not. When she opened it at the office she actually cried. Worth every dollar.",
    name:  "Pam",
    place: "Costa Mesa, CA",
  },
];

export function TestimonialsSection() {
  return (
    <section className="max-w-6xl mx-auto px-6 lg:px-12 py-16 lg:py-24">
      <div className="text-center mb-10 lg:mb-14 max-w-xl mx-auto">
        <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: "var(--accent)" }}>From the families</p>
        <h2 className="font-display text-3xl lg:text-4xl" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>
          Notes from <em style={{ fontWeight: 400 }}>past orders</em>.
        </h2>
      </div>
      <div className="grid md:grid-cols-3 gap-10 lg:gap-12">
        {_LUSIK_TESTIMONIALS.slice(0, 3).map((t, i) => (
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
