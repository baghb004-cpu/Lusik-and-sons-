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
import { translatableSchema, translatableRequired, translatableDoc } from "../i18n/translatable.ts";
import { LOCALE_CODES } from "../i18n/locales.ts";

// Translatable rich-text doc (a doc, or a per-locale doc map).
const tDoc = translatableDoc(richTextDoc);

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

// Catalog reference: "category/slug" into the generated, gate-checked
// catalog. Commerce blocks carry NO price/name fields at all — display
// data always resolves from the catalog at render, so a builder page
// physically cannot show a price Stripe won't charge (plan §7).
export const PRODUCT_REF_RE = /^[a-z0-9-]+\/[a-z0-9-]+$/;
export const productRef = z.string().regex(PRODUCT_REF_RE);

// Icon names the renderer ships SVGs for (renderer/blocks.tsx PILL_ICON_SVGS
// must cover every name here — locked together by a unit test).
// Social platforms the socialRow block can link to (renderer ships an
// SVG per name — locked together by a unit test, like PILL_ICONS).
export const SOCIAL_PLATFORMS = [
  "instagram",
  "facebook",
  "tiktok",
  "youtube",
  "pinterest",
  "x",
  "etsy",
  "email",
  "phone",
] as const;

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
      eyebrow: translatableSchema.optional(),
      heading: translatableSchema.optional(),
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
      triggerLabel: translatableRequired,
    })
    .strict(),

  // Content leaves
  richText: z.object({ doc: tDoc }).strict(),
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
      title: translatableRequired,
      body: tDoc.optional(),
      image: z.object({ src: imageSrc, alt: translatableSchema }).strict().optional(),
      href: safeHref.optional(),
      ctaLabel: translatableSchema.optional(),
    })
    .strict(),
  accordion: z
    .object({
      items: z
        .array(z.object({ id: blockId, title: translatableRequired, body: tDoc }).strict())
        .min(1),
      allowMultiple: z.boolean().optional(),
    })
    .strict(),
  gallery: z
    .object({
      images: z.array(galleryImage).min(1).optional(),
      product: productRef.optional(), // bind to a product's photo set instead
      layout: z.enum(["grid", "carousel"]),
      columns: z.number().int().min(1).max(4).optional(),
    })
    .strict()
    .refine((g) => g.images || g.product, { message: "gallery needs images or a product binding" }),
  spacer: z.object({ size: z.string().min(1) }).strict(),
  button: z
    .object({
      label: translatableRequired,
      href: safeHref,
      variant: z.enum(["primary", "secondary", "ghost"]).optional(),
    })
    .strict(),
  breadcrumbs: z
    .object({
      items: z
        .array(z.object({ label: translatableRequired, href: safeHref.optional() }).strict())
        .min(1), // last item = current page, no href needed
    })
    .strict(),
  // CSS-only tabs (radio + named-peer pattern — no JS, static-export
  // safe). Capped at 6 because the peer class names must be static
  // literals for the Tailwind scanner.
  tabs: z
    .object({
      items: z
        .array(z.object({ id: blockId, label: translatableRequired, body: tDoc }).strict())
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
              label: translatableRequired,
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

  // ── Commerce blocks (plan §7): bind, never own ────────────
  productCard: z
    .object({
      product: productRef,
      showPrice: z.boolean().optional(),
      showTagline: z.boolean().optional(),
    })
    .strict(),
  productGrid: z
    .object({
      category: z.string().regex(/^[a-z0-9-]+$/),
      columns: z.number().int().min(1).max(4).optional(),
      limit: z.number().int().min(1).max(24).optional(),
      includeComingSoon: z.boolean().optional(),
    })
    .strict(),
  featuredProduct: z
    .object({
      // "cms:featured" follows the home featured pick (build-validated to
      // be live); an explicit ref pins one product.
      binding: z.union([z.literal("cms:featured"), productRef]),
      headline: translatableSchema.optional(),
    })
    .strict(),
  relatedProducts: z
    .object({
      product: productRef, // shows OTHER products from the same category
      limit: z.number().int().min(1).max(8).optional(),
    })
    .strict(),
  // The color swatch builder (§17 req. 14). Standalone swatches, or bind
  // a product to render its colorways.
  swatchRow: z
    .object({
      product: productRef.optional(),
      swatches: z
        .array(
          z
            .object({
              id: blockId,
              color: z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/),
              name: z.string().min(1).max(30),
              description: z.string().max(120).optional(),
            })
            .strict()
        )
        .max(12)
        .optional(),
      layout: z.enum(["horizontal", "vertical"]),
      size: z.enum(["sm", "md", "lg"]).optional(),
      showNames: z.boolean().optional(),
    })
    .strict()
    .refine((s) => s.product || (s.swatches && s.swatches.length > 0), {
      message: "swatchRow needs swatches or a product binding",
    }),
  inventoryBadge: z
    .object({ product: productRef })
    .strict(),
  // OPAQUE buy box: name/price from the catalog + a CTA to the product's
  // real page, where the battle-tested cart/checkout code lives. The
  // visual editor can place the door to checkout — never redecorate
  // what's behind it (plan §5 tier 3).
  buyBox: z
    .object({
      product: productRef,
      ctaLabel: z.string().min(1).max(30).optional(),
    })
    .strict(),

  // Floating section-by-section scroll navigator (the ▲/▼ "jump
  // buttons" pattern, plan §18). Two circular buttons pinned to a
  // screen edge hop the visitor between top-level sections with a
  // smooth scroll; the useful direction gets the accent highlight.
  // Ships as a progressive enhancement: the renderer inlines ~30
  // lines of vanilla JS with the block, and the buttons stay hidden
  // for no-JS visitors (the page just scrolls normally). Honors
  // prefers-reduced-motion. Sizes respect the 44px tap floor.
  sectionJumper: z
    .object({
      edge: z.enum(["right", "left"]).optional(), // default right (thumb side)
      align: z.enum(["center", "lower"]).optional(), // vertical anchor; default center
      size: z.enum(["sm", "md", "lg"]).optional(), // 44 / 52 / 60 px buttons
      stops: z.enum(["sections", "headings"]).optional(), // what ▼/▲ hop between
      preset: z.string().min(1).optional(), // theme glass preset for the idle button
      accent: z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(), // highlight; default theme accent
      upLabel: translatableSchema.optional(), // a11y label, default "Previous section"
      downLabel: translatableSchema.optional(), // a11y label, default "Next section"
    })
    .strict(),

  // Day / Night / Candlelight switcher (plan §19). Visitor-facing
  // appearance control: Day/Night/Auto pills plus the candle — a warm
  // Night-Shift-style wash with a Less↔More Warm slider. Dark "auto"
  // works with zero JS (prefers-color-scheme); the explicit buttons,
  // persistence and the candle ship as the same inline progressive
  // enhancement pattern as sectionJumper (hidden until JS runs).
  appearanceSwitcher: z
    .object({
      style: z.enum(["pills", "icons"]).optional(), // icons = compact, label-less
      showAuto: z.boolean().optional(), // default true
      showCandle: z.boolean().optional(), // default true
      showWarmth: z.boolean().optional(), // the warmth slider; default true
      preset: z.string().min(1).optional(), // theme glass preset for the pill container
      lightLabel: translatableSchema.optional(), // default "Day"
      darkLabel: translatableSchema.optional(), // default "Night"
      autoLabel: translatableSchema.optional(), // default "Auto"
      candleLabel: translatableSchema.optional(), // default "Candlelight"
    })
    .strict(),

  // Mobile search entry point (plan §6 item 5). Progressive v1: an
  // anchor styled as a search pill/bar pointing at a search page; the
  // drawer/overlay open-modes wire up with the pill-nav phase.
  searchLauncher: z
    .object({
      label: translatableRequired,
      placeholder: translatableSchema.optional(),
      href: safeHref,
      style: z.enum(["pill", "bar"]).optional(),
    })
    .strict(),

  // ── Languages (offline i18n) ──────────────────────────────
  // A visitor-facing language switcher, placeable anywhere. Lists
  // the project's enabled locales (or an explicit subset) by their
  // own names (endonyms). Pure links/buttons — no network.
  languageSwitcher: z
    .object({
      label: translatableSchema.optional(),
      style: z.enum(["pills", "dropdown", "inline"]).optional(),
      /** Restrict to these locales; omit = all enabled project locales. */
      locales: z.array(z.enum(LOCALE_CODES as [string, ...string[]])).optional(),
      showFlags: z.boolean().optional(),
    })
    .strict(),
  // The pre-entry language prompt (a gate before the site shows).
  // Honors the project i18n gate settings; this block lets a page
  // override the copy.
  languageGate: z
    .object({
      heading: translatableSchema.optional(),
      subtext: translatableSchema.optional(),
      continueLabel: translatableSchema.optional(),
      mode: z.enum(["blocking", "dismissible"]).optional(),
    })
    .strict(),

  // ── Small-business blocks (plan §22) ──────────────────────
  // Contact form. Provider-preset based (no lock-in, same philosophy
  // as the service presets): Netlify Forms works on Netlify hosting
  // with zero config; Formspree/Web3Forms work on ANY host with the
  // user's own endpoint/key; mailto is the no-backend fallback. The
  // endpoint is https-only — a form action is an injection surface.
  contactForm: z
    .object({
      provider: z.enum(["netlify", "formspree", "web3forms", "mailto"]),
      /** formspree: the form URL · web3forms: the access key · mailto: the address. */
      endpoint: z.string().min(1).max(200).optional(),
      heading: translatableSchema.optional(),
      nameLabel: translatableSchema.optional(),
      emailLabel: translatableSchema.optional(),
      messageLabel: translatableSchema.optional(),
      submitLabel: translatableSchema.optional(),
    })
    .strict()
    .superRefine((f, ctx) => {
      if (f.provider === "formspree" && !/^https:\/\/formspree\.io\//.test(f.endpoint ?? "")) {
        ctx.addIssue({ code: "custom", message: "formspree needs your form URL (https://formspree.io/f/…)", path: ["endpoint"] });
      }
      if (f.provider === "web3forms" && !/^[a-zA-Z0-9-]{16,}$/.test(f.endpoint ?? "")) {
        ctx.addIssue({ code: "custom", message: "web3forms needs your access key", path: ["endpoint"] });
      }
      if (f.provider === "mailto" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.endpoint ?? "")) {
        ctx.addIssue({ code: "custom", message: "mailto needs an email address", path: ["endpoint"] });
      }
    }),

  // Video. Local files play natively; YouTube/Vimeo render as a
  // privacy facade — a plain LINK to the video (works with zero JS,
  // loads nothing third-party) that a small inline script upgrades to
  // an inline embed on click (youtube-nocookie / player.vimeo).
  video: z
    .object({
      kind: z.enum(["file", "youtube", "vimeo"]),
      /** file: a local path (/video/… or /img/uploads/…) · youtube/vimeo: the video id. */
      src: z.string().min(1).max(200),
      poster: imageSrc.optional(),
      caption: translatableSchema.optional(),
    })
    .strict()
    .superRefine((v, ctx) => {
      if (v.kind === "file" && !/^\/(?!\/)[\w./-]+\.(mp4|webm|mov)$/.test(v.src)) {
        ctx.addIssue({ code: "custom", message: "local video needs a site-relative .mp4/.webm/.mov path", path: ["src"] });
      }
      if (v.kind === "youtube" && !/^[A-Za-z0-9_-]{6,15}$/.test(v.src)) {
        ctx.addIssue({ code: "custom", message: "youtube needs the video id (the part after v=)", path: ["src"] });
      }
      if (v.kind === "vimeo" && !/^\d{6,12}$/.test(v.src)) {
        ctx.addIssue({ code: "custom", message: "vimeo needs the numeric video id", path: ["src"] });
      }
    }),

  // Social links row — icon links to the platforms a shop actually has.
  socialRow: z
    .object({
      label: translatableSchema.optional(),
      links: z
        .array(
          z
            .object({
              platform: z.enum(SOCIAL_PLATFORMS),
              href: safeHref,
            })
            .strict()
        )
        .min(1)
        .max(9),
      size: z.enum(["sm", "md", "lg"]).optional(),
    })
    .strict(),

  // Spec / price table — the office-suite-inspired "structured rows"
  // block (plan: INSPIRATION_ROADMAP §1): specs, price lists, menus,
  // size charts. Label/value pairs, optionally with a third detail
  // column — deliberately NOT a spreadsheet engine.
  specTable: z
    .object({
      heading: translatableSchema.optional(),
      rows: z
        .array(
          z
            .object({
              label: translatableRequired,
              value: translatableRequired,
              detail: translatableSchema.optional(),
            })
            .strict()
        )
        .min(1)
        .max(20),
      striped: z.boolean().optional(),
      note: z.string().max(300).optional(),
    })
    .strict(),

  // Call / Text / Email — the beginner "reach me" block. Each button
  // is tap-to-action: on a phone Call opens the dialer (tel:), Text
  // opens Messages (sms:), Email opens the mail app (mailto:). At least
  // one must be set. Zero JS, works in every export, brand-neutral.
  contactButtons: z
    .object({
      phone: z.string().regex(/^[+()\d][\d\s().-]{4,20}$/).optional(), // for the Call button
      sms: z.string().regex(/^[+()\d][\d\s().-]{4,20}$/).optional(), // for the Text button
      email: z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/).optional(),
      callLabel: translatableSchema.optional(), // default "Call us"
      textLabel: translatableSchema.optional(), // default "Text us"
      emailLabel: translatableSchema.optional(), // default "Email us"
      style: z.enum(["buttons", "icons"]).optional(),
      note: translatableSchema.optional(), // small line under the buttons
    })
    .strict()
    .refine((c) => c.phone || c.sms || c.email, { message: "add at least a phone, text number, or email" }),

  // CSV table (dataset-inspired): paste rows, get a real table.
  // First line = headers. Deliberately a static render — sorting/
  // filtering is a Phase-3 enhancement, not a spreadsheet engine.
  csvTable: z
    .object({
      caption: translatableSchema.optional(),
      csv: z.string().min(1).max(8000),
      headerRow: z.boolean().optional(), // default true
    })
    .strict(),

  // Event with add-to-calendar (every format that matters): renders an
  // event card whose buttons open the visitor's NATIVE calendar — a
  // universal .ics file (Apple/Outlook/Android, zero JS, works in
  // static exports) plus Google Calendar and Outlook.com prefill links.
  event: z
    .object({
      title: translatableRequired,
      start: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "use the date-time picker format YYYY-MM-DDTHH:MM"),
      end: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).optional(),
      allDay: z.boolean().optional(),
      location: z.string().max(160).optional(),
      details: translatableSchema.optional(),
      showIcs: z.boolean().optional(), // Apple/universal — default on
      showGoogle: z.boolean().optional(),
      showOutlook: z.boolean().optional(),
      buttonLabel: translatableSchema.optional(),
    })
    .strict(),

  // Booking button — presets for free(-tier) scheduling services
  // (Calendly, the open-source Cal.com) or any custom booking URL.
  // The button links out; no third-party script ever loads.
  bookingButton: z
    .object({
      provider: z.enum(["calendly", "cal-com", "custom"]),
      url: z.string().regex(/^https:\/\//, "booking links must be https"),
      label: translatableSchema.optional(),
      note: translatableSchema.optional(), // small text under the button
    })
    .strict(),

  // Opening hours.
  hoursTable: z
    .object({
      heading: translatableSchema.optional(),
      rows: z
        .array(z.object({ days: translatableRequired, hours: translatableRequired }).strict())
        .min(1)
        .max(10),
      note: translatableSchema.optional(),
    })
    .strict(),

  // "Find us" — links out to the visitor's own maps app (no embedded
  // third-party map: offline-friendly, consent-clean), with an optional
  // storefront photo.
  mapLink: z
    .object({
      address: z.string().min(1).max(200),
      label: translatableSchema.optional(),
      image: imageSrc.optional(),
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
        .array(z.object({ id: blockId, q: translatableRequired, a: tDoc }).strict())
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
