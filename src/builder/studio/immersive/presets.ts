// ============================================================
// Immersive Builder — preset scroll stories (pure data)
// ============================================================
// One editable starter per kind. Placeholder content + image slots;
// the visitor sees real headings/text (works without JS), enhanced by
// scroll reveals when JS + motion are allowed.
// ============================================================

import { scrollProjectSchema, type ScrollProject, type Section } from "./schemas.ts";

let n = 0;
const S = (s: Omit<Section, "id" | "accent"> & Partial<Pick<Section, "accent">>): Section => ({ id: `s-${++n}`, accent: "#1A1612", ...s });

interface Spec { name: string; kind: ScrollProject["kind"]; sections: Section[] }

const SPECS: Spec[] = [
  {
    name: "3D Product Reveal", kind: "product-reveal",
    sections: [
      S({ type: "hero", heading: "Meet [Product]", body: "A clean, modern reveal as you scroll.", imageUrl: "", animation: "fade", ctaLabel: "", ctaHref: "" }),
      S({ type: "image-reveal", heading: "", body: "", imageUrl: "assets/product.jpg", animation: "scale", ctaLabel: "", ctaHref: "" }),
      S({ type: "text-reveal", heading: "Made with care", body: "Describe what makes it special — materials, story, details.", imageUrl: "", animation: "slide-up", ctaLabel: "", ctaHref: "" }),
      S({ type: "product-card", heading: "[Product]", body: "Short description and price.", imageUrl: "assets/product.jpg", animation: "slide-left", ctaLabel: "Buy now", ctaHref: "#buy" }),
      S({ type: "cta", heading: "Ready?", body: "Get yours today.", imageUrl: "", animation: "fade", ctaLabel: "Contact us", ctaHref: "#contact" }),
    ],
  },
  {
    name: "3D Brand Story", kind: "brand-story",
    sections: [
      S({ type: "hero", heading: "Our story", body: "It starts simple…", imageUrl: "", animation: "fade", ctaLabel: "", ctaHref: "" }),
      S({ type: "text-reveal", heading: "Where we began", body: "A sentence or two about the beginning.", imageUrl: "", animation: "slide-up", ctaLabel: "", ctaHref: "" }),
      S({ type: "image-reveal", heading: "", body: "", imageUrl: "assets/story-1.jpg", animation: "parallax", ctaLabel: "", ctaHref: "" }),
      S({ type: "text-reveal", heading: "What we believe", body: "Your values, in plain words.", imageUrl: "", animation: "slide-left", ctaLabel: "", ctaHref: "" }),
      S({ type: "cta", heading: "Join us", body: "Be part of the story.", imageUrl: "", animation: "fade", ctaLabel: "Get in touch", ctaHref: "#contact" }),
    ],
  },
  {
    name: "3D Portfolio", kind: "portfolio",
    sections: [
      S({ type: "hero", heading: "Hi, I'm [Name]", body: "I make things. Scroll to see a few.", imageUrl: "", animation: "fade", ctaLabel: "", ctaHref: "" }),
      S({ type: "showcase", heading: "Project one", body: "What it was and your role.", imageUrl: "assets/work-1.jpg", animation: "scale", ctaLabel: "", ctaHref: "" }),
      S({ type: "showcase", heading: "Project two", body: "What it was and your role.", imageUrl: "assets/work-2.jpg", animation: "slide-left", ctaLabel: "", ctaHref: "" }),
      S({ type: "cta", heading: "Let's work together", body: "I'm available for new projects.", imageUrl: "", animation: "fade", ctaLabel: "Email me", ctaHref: "#contact" }),
    ],
  },
  {
    name: "3D Restaurant Experience", kind: "restaurant",
    sections: [
      S({ type: "hero", heading: "[Restaurant]", body: "Fresh, local, made with love.", imageUrl: "assets/storefront.jpg", animation: "fade", ctaLabel: "", ctaHref: "" }),
      S({ type: "image-reveal", heading: "", body: "", imageUrl: "assets/dish-1.jpg", animation: "parallax", ctaLabel: "", ctaHref: "" }),
      S({ type: "text-reveal", heading: "Our menu", body: "A few highlights, then a link to the full menu.", imageUrl: "", animation: "slide-up", ctaLabel: "", ctaHref: "" }),
      S({ type: "cta", heading: "Come visit", body: "Reserve a table or order online.", imageUrl: "", animation: "fade", ctaLabel: "Reserve", ctaHref: "#reserve" }),
    ],
  },
  {
    name: "3D App Landing", kind: "app-landing",
    sections: [
      S({ type: "hero", heading: "[App]", body: "The app that does the thing.", imageUrl: "assets/phone.png", animation: "scale", ctaLabel: "", ctaHref: "" }),
      S({ type: "text-reveal", heading: "How it works", body: "Three short steps.", imageUrl: "", animation: "slide-up", ctaLabel: "", ctaHref: "" }),
      S({ type: "showcase", heading: "Loved by users", body: "A short testimonial.", imageUrl: "assets/screen-1.png", animation: "slide-left", ctaLabel: "", ctaHref: "" }),
      S({ type: "cta", heading: "Get the app", body: "Available now.", imageUrl: "", animation: "fade", ctaLabel: "Download", ctaHref: "#download" }),
    ],
  },
  {
    name: "Virtual Showroom", kind: "showroom",
    sections: [
      S({ type: "hero", heading: "Welcome to the showroom", body: "Scroll through our collection.", imageUrl: "", animation: "fade", ctaLabel: "", ctaHref: "" }),
      S({ type: "product-card", heading: "Item A", body: "Short description.", imageUrl: "assets/item-a.jpg", animation: "scale", ctaLabel: "Details", ctaHref: "#a" }),
      S({ type: "product-card", heading: "Item B", body: "Short description.", imageUrl: "assets/item-b.jpg", animation: "slide-left", ctaLabel: "Details", ctaHref: "#b" }),
      S({ type: "cta", heading: "Visit us", body: "See it all in person.", imageUrl: "", animation: "fade", ctaLabel: "Find us", ctaHref: "#contact" }),
    ],
  },
];

export function makeScrollPreset(kind: ScrollProject["kind"], id = `scroll-${Date.now()}`): ScrollProject | null {
  const spec = SPECS.find((s) => s.kind === kind);
  if (!spec) return null;
  return scrollProjectSchema.parse({ id, name: spec.name, kind: spec.kind, quality: "balanced", reducedMotionFallback: true, sections: spec.sections.map((s) => ({ ...s })) });
}

export const SCROLL_PRESET_LIST = SPECS.map((s) => ({ kind: s.kind, name: s.name }));
