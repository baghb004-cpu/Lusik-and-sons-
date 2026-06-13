// ============================================================
// Creation Studio — Immersive Builder data model (§30, Phase 2)
// ============================================================
// A "scroll story": a page that reveals sections as the visitor
// scrolls. v1 uses scroll-triggered reveals + parallax + CSS-3D
// (the Lightweight/Balanced tiers); real WebGL/GLB is a later High
// tier. Content lives in real HTML so it works without JS (a11y).
// ============================================================

import { z } from "zod";

export const SCROLL_KINDS = ["product-reveal", "brand-story", "portfolio", "restaurant", "app-landing", "showroom"] as const;
export const scrollKindSchema = z.enum(SCROLL_KINDS);
export type ScrollKind = (typeof SCROLL_KINDS)[number];

export const SECTION_TYPES = ["hero", "text-reveal", "image-reveal", "product-card", "showcase", "cta", "spacer"] as const;
export const ANIMATIONS = ["fade", "slide-up", "slide-left", "scale", "spin", "parallax", "none"] as const;
export const QUALITIES = ["lightweight", "balanced", "high", "desktop"] as const;
export type Quality = (typeof QUALITIES)[number];

export const sectionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(SECTION_TYPES),
  heading: z.string().default(""),
  body: z.string().default(""),
  imageUrl: z.string().default(""), // a relative asset path or empty (placeholder)
  ctaLabel: z.string().default(""),
  ctaHref: z.string().default(""),
  animation: z.enum(ANIMATIONS).default("fade"),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#1A1612"),
});
export type Section = z.infer<typeof sectionSchema>;

export const scrollProjectSchema = z.object({
  schemaVersion: z.number().int().min(1).default(1),
  id: z.string().min(1),
  name: z.string().min(1).default("My 3D Scroll Page"),
  kind: scrollKindSchema,
  quality: z.enum(QUALITIES).default("balanced"),
  // Always honor reduced motion; this also drives a static fallback build.
  reducedMotionFallback: z.boolean().default(true),
  target: z.enum(["website", "mobile-screen"]).default("website"),
  sections: z.array(sectionSchema).default([]),
});
export type ScrollProject = z.infer<typeof scrollProjectSchema>;
