// ============================================================
// MoreFromWorkshop — coming-soon product cards
// ============================================================
// Surfaces Lusik's wider range of work that isn't yet wired
// to checkout: alphabet crib blankets, throw blankets, days-
// of-the-week bib sets, bathrobe sets, hand-knit giraffe
// rattles, beaded crosses, framed home blessings, and bib +
// burp/hat/parent combinations.
//
// Each card is a mailto link with a pre-filled subject so
// inquiries route to Lusik with context. No Stripe wiring,
// no price published — every commission is custom-quoted.
// ============================================================

import React from "react";
import { ArrowRight } from "./icons.jsx";

const PRODUCTS = [
  {
    slug: "crib-blanket",
    title: "Alphabet crib blanket",
    sub: "Full 36-letter Armenian alphabet, hand-stitched",
    img: "/img/products/crib-blankets--card.jpg",
    subject: "Crib blanket inquiry",
  },
  {
    slug: "throw-blanket",
    title: "Throw blanket, 52×52 in",
    sub: "Larger alphabet throw for toddlers and decor",
    img: "/img/products/throw-blankets--card.jpg",
    subject: "Throw blanket inquiry (52x52)",
  },
  {
    slug: "days-of-week",
    title: "Days-of-the-week bib set",
    sub: "Seven bibs, one Armenian weekday on each",
    img: "/img/products/days-of-week--card.jpg",
    subject: "Days-of-the-week bib set inquiry",
  },
  {
    slug: "bib-burp-sets",
    title: "Bib + burp cloth set",
    sub: "Matching pair — «Պարի ախորժակ, անուշ ըլլա»",
    img: "/img/products/bib-burp-sets--card.jpg",
    subject: "Bib + burp cloth set inquiry",
  },
  {
    slug: "bib-hat-sets",
    title: "Bib + ABC hat set",
    sub: "Bib paired with a soft alphabet-trim baby hat",
    img: "/img/products/bib-hat-sets--card.jpg",
    subject: "Bib + ABC hat set inquiry",
  },
  {
    slug: "bib-sets",
    title: "Bib set — Mom & Dad",
    sub: "«Մամային» / «Բաբային» — two-piece bib pair",
    img: "/img/products/bib-sets--card.jpg",
    subject: "Mom & Dad bib set inquiry",
  },
  {
    slug: "bathrobe-set",
    title: "Hooded bathrobe set",
    sub: "Cross-stitched bear (or duck) on a soft hooded robe",
    img: "/img/products/bathrobe-sets--card.jpg",
    subject: "Bathrobe set inquiry",
  },
  {
    slug: "giraffe-rattles",
    title: "Giraffe ABC rattles",
    sub: "Hand-knit baby rattle — five colors available",
    img: "/img/products/giraffe-rattles--card.jpg",
    subject: "Giraffe rattle inquiry",
  },
  {
    slug: "beaded-cross",
    title: "Beaded cross",
    sub: "Armenian flag colors — red, blue, orange",
    img: "/img/products/beaded-crosses--card.jpg",
    subject: "Beaded cross inquiry",
  },
  {
    slug: "wall-art",
    title: "Framed home blessing",
    sub: "«Ասҏուած օրհնէ մեր տունը» — framed cross-stitch",
    img: "/img/products/wall-art--card.jpg",
    subject: "Framed home blessing inquiry",
  },
];

export function MoreFromWorkshop() {
  return (
    <section
      id="more-from-workshop"
      className="max-w-7xl mx-auto px-6 lg:px-12 py-20 lg:py-28"
    >
      <div className="text-center mb-12 lg:mb-16 max-w-2xl mx-auto">
        <p
          className="text-xs tracking-[0.3em] uppercase mb-4"
          style={{ color: "#B08842" }}
        >
          More from Lusik's workshop
        </p>
        <h2
          className="font-display text-3xl lg:text-5xl mb-5"
          style={{ fontWeight: 400, letterSpacing: "-0.01em" }}
        >
          Pieces by <em style={{ fontWeight: 400 }}>commission</em>.
        </h2>
        <p className="text-sm lg:text-base opacity-75 leading-relaxed">
          Beyond the blanket and bib, Lusik makes crib blankets, throw blankets, days-of-the-week bib sets,
          bathrobe sets, hand-knit giraffe rattles, beaded crosses, and framed Armenian home blessings.
          Each piece is one-of-a-kind. Email her for pricing and timing.
        </p>
        <div className="gold-line mt-10 max-w-xs mx-auto" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-6">
        {PRODUCTS.map((p) => (
          <a
            key={p.slug}
            href={`mailto:hello@lusikandsons.com?subject=${encodeURIComponent(p.subject)}`}
            className="group block"
          >
            <div className="aspect-square overflow-hidden bg-[rgba(176,136,66,0.04)]">
              <img
                src={p.img}
                alt={p.title}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            </div>
            <div className="pt-3">
              <p
                className="font-display text-base lg:text-lg leading-snug"
                style={{ fontWeight: 400 }}
              >
                {p.title}
              </p>
              <p className="text-xs opacity-60 mt-1 leading-snug">{p.sub}</p>
              <p
                className="text-xs mt-2 inline-flex items-center gap-1 group-hover:gap-2 transition-all"
                style={{ color: "#B08842" }}
              >
                Contact for pricing <ArrowRight size={12} strokeWidth={1.5} />
              </p>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
