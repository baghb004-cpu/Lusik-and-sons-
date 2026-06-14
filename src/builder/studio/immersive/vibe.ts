// ============================================================
// Immersive Builder — offline "vibe" intent parser (pure)
// ============================================================
// Plain English → build or tweak a scroll story. Local matching, no
// cloud AI. Returns the project + transparent notes; when the kind is
// unclear it still starts something sensible and says so.
// ============================================================

import type { ScrollProject, Section } from "./schemas.ts";
import { makeScrollPreset } from "./presets.ts";

const KIND_WORDS: Array<[ScrollProject["kind"], string[]]> = [
  ["product-reveal", ["product reveal", "product launch", "product"]],
  ["restaurant", ["restaurant", "cafe", "menu", "food", "boutique"]],
  ["portfolio", ["portfolio", "my work", "designer", "freelance"]],
  ["app-landing", ["app landing", "app intro", "app", "download"]],
  ["showroom", ["showroom", "shop", "store", "collection", "gallery"]],
  ["brand-story", ["brand story", "story", "cinematic", "homepage", "about"]],
];

const norm = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9 -]/g, " ").replace(/\s+/g, " ")} `;
const has = (h: string, k: string) => h.includes(` ${k} `) || h.includes(`${k} `) || h.includes(` ${k}`);

export function detectScrollKind(text: string): ScrollProject["kind"] | null {
  const h = norm(text);
  for (const [kind, words] of KIND_WORDS) for (const w of words) if (has(h, w)) return kind;
  return null;
}

export interface ScrollVibe {
  project: ScrollProject;
  notes: string[];
}

let seq = 0;
const addSection = (p: ScrollProject, s: Omit<Section, "id">) => p.sections.push({ id: `v-${++seq}`, ...s });

export function vibeScroll(text: string, current?: ScrollProject): ScrollVibe {
  const h = norm(text);
  const kind = detectScrollKind(text);
  const wantsNew = /\bmake (a|an|me)\b/.test(h) || (!current && !!kind);
  const notes: string[] = [];
  let project: ScrollProject;

  if (wantsNew || !current) {
    const k = kind ?? "brand-story";
    project = makeScrollPreset(k, current?.id ?? `scroll-${Date.now()}`)!;
    notes.push(kind ? `Started a ${k.replace("-", " ")} scroll page.` : "Couldn't tell the type, so I started a brand-story page — change it anytime.");
  } else {
    project = { ...current, sections: current.sections.map((s) => ({ ...s })) };
  }

  if (has(h, "less heavy") || has(h, "lighter") || has(h, "faster")) { project.quality = "lightweight"; notes.push("Set quality to Lightweight (best for phones)."); }
  if (has(h, "iphone") || has(h, "mobile") || has(h, "fallback")) { project.reducedMotionFallback = true; notes.push("Enabled the mobile + reduced-motion fallback."); }
  if (has(h, "spin")) { for (const s of project.sections) if (s.type === "product-card" || s.type === "image-reveal") s.animation = "spin"; notes.push("Set product/image sections to a gentle spin."); }
  if (has(h, "scroll animation") || has(h, "scroll animations")) notes.push("Scroll reveals are already on for every section.");
  if (has(h, "product reveal section") || (has(h, "product") && !wantsNew)) { addSection(project, { type: "product-card", heading: "[Product]", body: "Short description and price.", imageUrl: "assets/product.jpg", ctaLabel: "Buy now", ctaHref: "#buy", animation: "scale", accent: "#1A1612" }); notes.push("Added a product reveal section."); }
  if (has(h, "phone mockup") || has(h, "app intro")) { addSection(project, { type: "showcase", heading: "See it in action", body: "A floating phone shows your app.", imageUrl: "assets/phone.png", ctaLabel: "", ctaHref: "", animation: "scale", accent: "#1A1612" }); notes.push("Added a phone-mockup showcase section."); }
  if (has(h, "call to action") || has(h, "cta") || has(h, "button")) { addSection(project, { type: "cta", heading: "Get in touch", body: "Tell visitors what to do next.", imageUrl: "", ctaLabel: "Contact us", ctaHref: "#contact", animation: "fade", accent: "#1A1612" }); notes.push("Added a call-to-action section."); }

  if (notes.length === 0) notes.push("I didn't catch a specific change — try a type (boutique, portfolio, app), or 'make it less heavy', 'add a product reveal section'.");
  return { project, notes };
}
