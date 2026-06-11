// ============================================================
// Builder schema — Block, the atom of every page
// ============================================================
// A Block is { id, type, props, style?, children?, visibility?,
// locks? }. Each block TYPE registers a zod schema for its props
// in BLOCK_TYPES below — one registry drives schema validation,
// the editor's inspector forms, and (Phase 3) the renderer's
// prop contracts. Container types are the only ones allowed to
// carry children.
//
// v1 ships the ~10 types Phase 3's renderer implements first.
// Adding a type is additive: register it here, render it there.
// ============================================================

import { z } from "zod";
import { richTextDoc, imageSrc, safeHref } from "./richtext.ts";
import { styleProps } from "./style.ts";

// ── ids ─────────────────────────────────────────────────────
// Stable ids are load-bearing: mobile overrides, locks, revisions
// and (later) in-place editing all key off them.
export const BLOCK_ID_RE = /^[a-z]+_[A-Za-z0-9]{8,}$/;
export const blockId = z.string().regex(BLOCK_ID_RE);

export function newId(prefix = "b"): string {
  return `${prefix}_${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

// ── shared fragments ────────────────────────────────────────
const galleryImage = z.object({ src: imageSrc, alt: z.string() }).strict();

// Icon names the renderer ships SVGs for (renderer/blocks.tsx PILL_ICON_SVGS
// must cover every name here — locked together by a unit test).
export const PILL_ICONS = [
  "home",
  "shop",
  "journal",
  "bag",
  "search",
  "heart",
  "user",
  "phone",
  "star",
  "gift",
] as const;

// ── the type registry ───────────────────────────────────────
export const BLOCK_TYPES: Record<string, z.ZodType<unknown>> = {
  // Layout containers
  section: z
    .object({
      eyebrow: z.string().optional(),
      heading: z.string().optional(),
      anchor: z.string().regex(/^[a-z][a-z0-9-]*$/).optional(),
      container: z.boolean().optional(), // constrain to content width
    })
    .strict(),
  columns: z
    .object({
      count: z.number().int().min(1).max(4),
      stackOnMobile: z.boolean().optional(),
    })
    .strict(),
  drawer: z
    .object({
      side: z.enum(["bottom", "left", "right"]),
      triggerLabel: z.string().min(1),
    })
    .strict(),

  // Content leaves
  richText: z.object({ doc: richTextDoc }).strict(),
  image: z
    .object({
      src: imageSrc,
      alt: z.string(), // may be "" ONLY with decorative:true (validate.ts enforces)
      decorative: z.boolean().optional(),
      caption: z.string().optional(),
      rotate: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).optional(),
    })
    .strict(),
  card: z
    .object({
      title: z.string().min(1),
      body: richTextDoc.optional(),
      image: z.object({ src: imageSrc, alt: z.string() }).strict().optional(),
      href: safeHref.optional(),
      ctaLabel: z.string().optional(),
    })
    .strict(),
  accordion: z
    .object({
      items: z
        .array(z.object({ id: blockId, title: z.string().min(1), body: richTextDoc }).strict())
        .min(1),
      allowMultiple: z.boolean().optional(),
    })
    .strict(),
  gallery: z
    .object({
      images: z.array(galleryImage).min(1),
      layout: z.enum(["grid", "carousel"]),
      columns: z.number().int().min(1).max(4).optional(),
    })
    .strict(),
  spacer: z.object({ size: z.string().min(1) }).strict(),
  button: z
    .object({
      label: z.string().min(1),
      href: safeHref,
      variant: z.enum(["primary", "secondary", "ghost"]).optional(),
    })
    .strict(),
  breadcrumbs: z
    .object({
      items: z
        .array(z.object({ label: z.string().min(1), href: safeHref.optional() }).strict())
        .min(1), // last item = current page, no href needed
    })
    .strict(),
  // CSS-only tabs (radio + named-peer pattern — no JS, static-export
  // safe). Capped at 6 because the peer class names must be static
  // literals for the Tailwind scanner.
  tabs: z
    .object({
      items: z
        .array(z.object({ id: blockId, label: z.string().min(1), body: richTextDoc }).strict())
        .min(2)
        .max(6),
    })
    .strict(),

  // The Liquid Glass pill menu (plan §6 items 2–3). Items cap at 5 —
  // thumb reach and the 44px tap floor stop being satisfiable past
  // that on a 390px phone. Appearance comes from a THEME glass preset
  // by name (the §5 slider set), so restyling the pill never edits
  // the nav structure. Renders mobile-only by default (it's the
  // phone bottom nav); per-device visibility can override.
  pillNav: z
    .object({
      items: z
        .array(
          z
            .object({
              id: blockId,
              icon: z.enum(PILL_ICONS),
              label: z.string().min(1).max(14),
              href: safeHref,
            })
            .strict()
        )
        .min(2)
        .max(5),
      position: z.enum(["bottom", "top"]),
      preset: z.string().min(1).optional(), // theme glass preset name; falls back to first
      showLabels: z.boolean().optional(),
      heightPx: z.number().int().min(48).max(80).optional(),
      radiusPx: z.number().int().min(8).max(40).optional(),
    })
    .strict(),

  // Mobile search entry point (plan §6 item 5). Progressive v1: an
  // anchor styled as a search pill/bar pointing at a search page; the
  // drawer/overlay open-modes wire up with the pill-nav phase.
  searchLauncher: z
    .object({
      label: z.string().min(1),
      placeholder: z.string().optional(),
      href: safeHref,
      style: z.enum(["pill", "bar"]).optional(),
    })
    .strict(),

  // CMS-bound blocks: render existing gate-checked content surfaces.
  // `binding` points at a content collection; inline overrides allowed
  // where the surface supports it.
  announcementBar: z
    .object({ binding: z.literal("cms:announcement") })
    .strict(),
  faqSection: z
    .object({
      binding: z.literal("cms:faq").optional(),
      items: z
        .array(z.object({ id: blockId, q: z.string().min(1), a: richTextDoc }).strict())
        .optional(),
    })
    .strict(),
};

/** Only these types may carry children. */
export const CONTAINER_TYPES: ReadonlySet<string> = new Set(["section", "columns", "drawer"]);

// ── the Block itself ────────────────────────────────────────
export interface Block {
  id: string;
  type: string;
  props: Record<string, unknown>;
  style?: z.infer<typeof styleProps>;
  children?: Block[];
  visibility?: { desktop?: boolean; tablet?: boolean; mobile?: boolean };
  locks?: { move?: boolean; delete?: boolean; edit?: boolean; reason?: string };
}

const visibilitySchema = z
  .object({
    desktop: z.boolean().optional(),
    tablet: z.boolean().optional(),
    mobile: z.boolean().optional(),
  })
  .strict();

const locksSchema = z
  .object({
    move: z.boolean().optional(),
    delete: z.boolean().optional(),
    edit: z.boolean().optional(),
    reason: z.string().optional(),
  })
  .strict();

export const blockSchema: z.ZodType<Block> = z.lazy(() =>
  z
    .object({
      id: blockId,
      type: z.string().min(1),
      props: z.record(z.string(), z.unknown()),
      style: styleProps.optional(),
      children: z.array(blockSchema).optional(),
      visibility: visibilitySchema.optional(),
      locks: locksSchema.optional(),
    })
    .strict()
    .superRefine((block, ctx) => {
      const propsSchema = BLOCK_TYPES[block.type];
      if (!propsSchema) {
        ctx.addIssue({ code: "custom", message: `Unknown block type "${block.type}"`, path: ["type"] });
        return;
      }
      const result = propsSchema.safeParse(block.props);
      if (!result.success) {
        for (const issue of result.error.issues) {
          ctx.addIssue({
            code: "custom",
            message: `props for "${block.type}": ${issue.message}`,
            path: ["props", ...issue.path],
          });
        }
      }
      if (block.children?.length && !CONTAINER_TYPES.has(block.type)) {
        ctx.addIssue({
          code: "custom",
          message: `Block type "${block.type}" cannot have children`,
          path: ["children"],
        });
      }
    })
);
