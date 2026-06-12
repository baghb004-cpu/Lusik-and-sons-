// ============================================================
// Renderer — the v1 block components
// ============================================================
// Plain React, NO "use client", no hooks: every component here
// is server-component-safe, which is what keeps published pages
// static-first and makes the future static-HTML export honest
// (plan §10). Interactivity is CSS/<details>-based (the same
// progressive pattern the plan commits to); richer behaviors
// (floating drawers, lightboxes) layer on in later phases
// without changing the document shape.
//
// CMS-bound blocks (announcementBar, faqSection with binding)
// render from data the caller passes via RenderContext — wiring
// the real generated CMS data in is Phase 4's job; the renderer
// stays data-source-agnostic.
// ============================================================

import type { CSSProperties, ReactNode } from "react";
import type { Block, GlassPreset, RichTextDoc } from "../schema/index.ts";
import { RichText } from "./RichText.tsx";
import { cx } from "./style.ts";
import { tokenToCss } from "./style.ts";
import { glassPresetToCss } from "../theme/css.ts";
import { resolveProductRef, type CatalogProductSnapshot, type CatalogSnapshot } from "../engine/commerce.ts";
import { JUMPER_STOP_SELECTORS, jumperDomId, sectionJumperScript, sectionJumperCss } from "./jumperScript.ts";
import { appearanceDomId, appearanceSwitcherScript, appearanceSwitcherCss, CANDLE_DEFAULTS } from "./appearanceScript.ts";
import { videoDomId, videoFacadeScript, videoWatchUrl } from "./videoScript.ts";
import type { Candlelight } from "../schema/index.ts";

export interface RenderContext {
  /** CMS surfaces for bound blocks, injected by the caller (Phase 4). */
  cms?: {
    announcement?: { enabled: boolean; message: string; link?: string; linkLabel?: string };
    faq?: Array<{ q: string; a: RichTextDoc }>;
    /** The home featured pick (category/slug), for featuredProduct's cms:featured binding. */
    featured?: string;
  };
  /** Catalog snapshot for commerce blocks (Phase 10) — prices/names/photos
   *  resolve from here at render, NEVER from block props. */
  catalog?: CatalogSnapshot;
  /** Per-product availability for inventoryBadge ({ soldOut, remaining? }). */
  inventory?: Record<string, { soldOut: boolean; remaining?: number }>;
  /** Offline i18n context for the switcher/gate (Phase: languages).
   *  localePrefix is "" for the default locale, "/<code>" otherwise, so the
   *  switcher links to the same page under each locale's URL prefix. */
  i18n?: {
    locales: Array<{ code: string; endonym: string }>;
    current: string;
    /** Builds the href for switching to a locale on the current page. */
    hrefForLocale: (code: string) => string;
  };
  /** Theme glass presets (Phase 5) for glass-styled blocks like pillNav. */
  glass?: GlassPreset[];
  /** Candlelight config (theme.appearance.candlelight) — the appearance
   *  switcher's script needs the schedule + default warmth. */
  candle?: Candlelight;
  /** True inside the editor preview — fixed-position blocks render sticky
   *  so they stay inside the preview frame instead of escaping to the
   *  editor's own viewport. */
  editing?: boolean;
  /** Render children — provided by BlockRenderer to avoid an import cycle. */
  renderChildren: (blocks: Block[]) => ReactNode;
}

type BlockComponent = (block: Block, ctx: RenderContext) => ReactNode;

// Static class maps (Tailwind scanner needs full literals).
const COLUMNS_CLASS: Record<number, string> = {
  1: "grid grid-cols-1",
  2: "grid grid-cols-1 md:grid-cols-2",
  3: "grid grid-cols-1 md:grid-cols-3",
  4: "grid grid-cols-2 md:grid-cols-4",
};
const COLUMNS_NO_STACK: Record<number, string> = {
  1: "grid grid-cols-1",
  2: "grid grid-cols-2",
  3: "grid grid-cols-3",
  4: "grid grid-cols-4",
};
const GALLERY_GRID: Record<number, string> = {
  1: "grid gap-3 grid-cols-1",
  2: "grid gap-3 grid-cols-2",
  3: "grid gap-3 grid-cols-2 md:grid-cols-3",
  4: "grid gap-3 grid-cols-2 md:grid-cols-4",
};
const ROTATE_CLASS: Record<number, string> = {
  0: "",
  90: "rotate-90",
  180: "rotate-180",
  270: "-rotate-90",
};

// One SVG per PILL_ICONS name (schema/block.ts) — a unit test asserts
// the two stay in lockstep. 24px grid, stroke-based, currentColor.
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
export const PILL_ICON_SVGS: Record<string, ReactNode> = {
  home: <path d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-5v-6h-4v6H5a1 1 0 01-1-1z" {...stroke} />,
  shop: <path d="M5 8h14l-1 12H6L5 8zm4 0a3 3 0 016 0" {...stroke} />,
  journal: <path d="M6 4h12v16H6zM9 8h6M9 12h6M9 16h4" {...stroke} />,
  bag: <path d="M6 9h12l-1 11H7L6 9zm3 0V7a3 3 0 016 0v2" {...stroke} />,
  search: <><circle cx="11" cy="11" r="6" {...stroke} /><path d="M15.5 15.5L20 20" {...stroke} /></>,
  heart: <path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z" {...stroke} />,
  user: <><circle cx="12" cy="8" r="3.5" {...stroke} /><path d="M5 20a7 7 0 0114 0" {...stroke} /></>,
  phone: <path d="M6 3h4l1 5-2.5 1.5a12 12 0 006 6L16 13l5 1v4a2 2 0 01-2 2A16 16 0 014 5a2 2 0 012-2z" {...stroke} />,
  star: <path d="M12 3l2.7 5.7 6.3.8-4.6 4.3 1.2 6.2L12 17l-5.6 3 1.2-6.2L3 9.5l6.3-.8z" {...stroke} />,
  gift: <path d="M4 9h16v3H4zm2 3v8h12v-8M12 9v11M12 9s-4 0-5-2 1-4 3-3 2 5 2 5zm0 0s4 0 5-2-1-4-3-3-2 5-2 5z" {...stroke} />,
};

// One SVG per SOCIAL_PLATFORMS name (schema/block.ts) — same lockstep
// contract as PILL_ICON_SVGS. Simple, recognizable glyphs, currentColor.
export const SOCIAL_ICON_SVGS: Record<string, ReactNode> = {
  instagram: <><rect x="4" y="4" width="16" height="16" rx="4.5" {...stroke} /><circle cx="12" cy="12" r="3.6" {...stroke} /><circle cx="16.7" cy="7.3" r="1" fill="currentColor" /></>,
  facebook: <path d="M14.5 8.5H13c-.6 0-1 .4-1 1V11h2.5l-.4 2.5H12V20a8 8 0 10-3 0v-6.5H7V11h2V9.2C9 7 10.3 5.6 12.6 5.6c.8 0 1.6.1 1.9.2z" {...stroke} />,
  tiktok: <path d="M14 4v9.5a3.5 3.5 0 11-3.5-3.5M14 4c.3 2.4 1.8 4 4.5 4.3" {...stroke} />,
  youtube: <><rect x="3" y="6.5" width="18" height="11" rx="3" {...stroke} /><path d="M10.5 9.8l4 2.2-4 2.2z" fill="currentColor" /></>,
  pinterest: <><circle cx="12" cy="12" r="8.5" {...stroke} /><path d="M11 8.5c-1.6.6-2.2 2.6-1.2 3.8M12.8 8.2c1.8.4 2.4 2.6 1.2 4.1-.9 1.1-2.4 1.2-3.2.4L9.5 19" {...stroke} /></>,
  x: <path d="M5 4l14 16M19 4L5 20" {...stroke} />,
  etsy: <path d="M7 4h10M8.5 4v16M7 20h10M8.5 11.5H15M16 6.5V4M16.5 20l.5-2.5" {...stroke} />,
  email: <><rect x="3.5" y="5.5" width="17" height="13" rx="2" {...stroke} /><path d="M4.5 7l7.5 6 7.5-6" {...stroke} /></>,
  phone: PILL_ICON_SVGS.phone,
};

const PillIcon = ({ name }: { name: string }) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    {PILL_ICON_SVGS[name] ?? PILL_ICON_SVGS.star}
  </svg>
);

// Conservative fallback when no theme presets reach the renderer.
const FALLBACK_GLASS: CSSProperties = {
  background: "#F5EFE3E0",
  backdropFilter: "blur(14px) saturate(1.15)",
  WebkitBackdropFilter: "blur(14px) saturate(1.15)",
  border: "1px solid #FFFFFF8C",
  boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
};

// ── commerce helpers (Phase 10) ─────────────────────────────
function productFrom(ctx: RenderContext, ref: string): CatalogProductSnapshot | null {
  if (!ctx.catalog) return null;
  return resolveProductRef(ctx.catalog, ref);
}

function productHref(ref: string): string {
  return `/shop/${ref}`; // the canonical PDP route — where real cart/checkout lives
}

function price(p: CatalogProductSnapshot): string {
  return p.priceFrom === null ? "Price coming soon" : `$${p.priceFrom}`;
}

function MissingProduct({ refStr, editing }: { refStr: string; editing?: boolean }) {
  if (!editing) return null; // published pages never leak broken bindings
  return (
    <div className="rounded-lg border border-dashed border-red-400 bg-red-50 p-3 text-xs text-red-700">
      Product “{refStr}” not found in the catalog
    </div>
  );
}

function ProductCardInner({ p, refStr, showPrice = true, showTagline = false }: { p: CatalogProductSnapshot; refStr: string; showPrice?: boolean; showTagline?: boolean }) {
  return (
    <a href={productHref(refStr)} className="block rounded-2xl border border-ink/10 bg-white/60 p-4 shadow-sm transition hover:shadow-md">
      {p.coverImage ? <img src={p.coverImage} alt={p.name} loading="lazy" className="mb-3 aspect-square w-full rounded-xl object-cover" /> : null}
      <h3 className="font-display text-base leading-snug">{p.name}</h3>
      {showTagline && p.tagline ? <p className="mt-1 line-clamp-2 text-xs text-muted">{p.tagline}</p> : null}
      <p className="mt-1 text-sm">
        {p.status === "live" ? price(p) : <span className="text-muted">Coming soon</span>}
      </p>
    </a>
  );
}

const GRID_COLS: Record<number, string> = {
  1: "grid grid-cols-1 gap-4",
  2: "grid grid-cols-2 gap-4",
  3: "grid grid-cols-2 gap-4 md:grid-cols-3",
  4: "grid grid-cols-2 gap-4 md:grid-cols-4",
};
const SWATCH_SIZE: Record<string, string> = { sm: "h-5 w-5", md: "h-7 w-7", lg: "h-10 w-10" };

const SearchIcon = () => (
  <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" aria-hidden="true">
    <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const chevron = (
  <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true">
    <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const BLOCK_COMPONENTS: Record<string, BlockComponent> = {
  section: (block, ctx) => {
    const p = block.props as { eyebrow?: string; heading?: string; anchor?: string; container?: boolean };
    return (
      <section id={p.anchor} className={cx("py-8", p.container !== false && "mx-auto max-w-5xl px-4")}>
        {p.eyebrow ? (
          <p className="mb-1 text-xs uppercase tracking-[0.2em] text-accent">{p.eyebrow}</p>
        ) : null}
        {p.heading ? <h2 className="mb-4 font-display text-2xl md:text-3xl">{p.heading}</h2> : null}
        <div className="space-y-6">{block.children ? ctx.renderChildren(block.children) : null}</div>
      </section>
    );
  },

  columns: (block, ctx) => {
    const p = block.props as { count: number; stackOnMobile?: boolean };
    const map = p.stackOnMobile === false ? COLUMNS_NO_STACK : COLUMNS_CLASS;
    return (
      <div className={cx(map[p.count] ?? COLUMNS_CLASS[2], "gap-6")}>
        {block.children ? ctx.renderChildren(block.children) : null}
      </div>
    );
  },

  drawer: (block, ctx) => {
    const p = block.props as { triggerLabel: string };
    return (
      <details className="group rounded-xl border border-ink/10 bg-cream/60">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 font-body font-medium [&::-webkit-details-marker]:hidden">
          {p.triggerLabel}
          {chevron}
        </summary>
        <div className="space-y-4 px-4 pb-4">{block.children ? ctx.renderChildren(block.children) : null}</div>
      </details>
    );
  },

  richText: (block) => <RichText doc={(block.props as { doc: RichTextDoc }).doc} />,

  image: (block) => {
    const p = block.props as { src: string; alt: string; decorative?: boolean; caption?: string; rotate?: number };
    const img = (
      <img
        src={p.src}
        alt={p.decorative ? "" : p.alt}
        loading="lazy"
        className={cx("max-w-full rounded-lg", ROTATE_CLASS[p.rotate ?? 0])}
      />
    );
    return p.caption ? (
      <figure>
        {img}
        <figcaption className="mt-1 text-sm text-muted">{p.caption}</figcaption>
      </figure>
    ) : (
      img
    );
  },

  card: (block) => {
    const p = block.props as {
      title: string;
      body?: RichTextDoc;
      image?: { src: string; alt: string };
      href?: string;
      ctaLabel?: string;
    };
    const inner = (
      <>
        {p.image ? <img src={p.image.src} alt={p.image.alt} loading="lazy" className="mb-3 w-full rounded-lg object-cover" /> : null}
        <h3 className="font-display text-lg">{p.title}</h3>
        {p.body ? <div className="mt-2 text-sm text-muted"><RichText doc={p.body} /></div> : null}
        {p.href && p.ctaLabel ? (
          <span className="mt-3 inline-block text-sm font-medium text-accent">{p.ctaLabel} →</span>
        ) : null}
      </>
    );
    const className = "block rounded-2xl border border-ink/10 bg-white/60 p-5 shadow-sm";
    return p.href ? (
      <a href={p.href} className={cx(className, "transition hover:shadow-md")}>{inner}</a>
    ) : (
      <div className={className}>{inner}</div>
    );
  },

  accordion: (block) => {
    const p = block.props as { items: Array<{ id: string; title: string; body: RichTextDoc }> };
    return (
      <div className="divide-y divide-ink/10 rounded-xl border border-ink/10">
        {p.items.map((item) => (
          <details key={item.id} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 font-medium [&::-webkit-details-marker]:hidden">
              {item.title}
              {chevron}
            </summary>
            <div className="px-4 pb-4 text-sm"><RichText doc={item.body} /></div>
          </details>
        ))}
      </div>
    );
  },

  gallery: (block, ctx) => {
    const raw = block.props as { images?: Array<{ src: string; alt: string }>; product?: string; layout: string; columns?: number };
    const bound = raw.product ? productFrom(ctx, raw.product) : null;
    const p = {
      ...raw,
      images:
        raw.images ??
        (bound?.images ?? []).map((src) => ({ src, alt: bound?.name ?? "" })),
    };
    if (p.images.length === 0) return ctx.editing ? <MissingProduct refStr={raw.product ?? "gallery"} editing /> : null;
    if (p.layout === "carousel") {
      return (
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
          {p.images.map((img, i) => (
            <img key={i} src={img.src} alt={img.alt} loading="lazy" className="h-56 w-auto shrink-0 snap-center rounded-lg object-cover" />
          ))}
        </div>
      );
    }
    return (
      <div className={GALLERY_GRID[p.columns ?? 3] ?? GALLERY_GRID[3]}>
        {p.images.map((img, i) => (
          <img key={i} src={img.src} alt={img.alt} loading="lazy" className="w-full rounded-lg object-cover" />
        ))}
      </div>
    );
  },

  spacer: (block) => {
    const p = block.props as { size: string };
    return <div aria-hidden="true" style={{ height: tokenToCss(p.size) }} />;
  },

  button: (block) => {
    const p = block.props as { label: string; href: string; variant?: string };
    const variants: Record<string, string> = {
      primary: "bg-ink text-cream hover:opacity-90",
      secondary: "border border-ink/25 text-ink hover:bg-cream",
      ghost: "text-accent underline decoration-accent/50 underline-offset-2",
    };
    return (
      <a href={p.href} className={cx("inline-block rounded-full px-5 py-2 text-sm font-medium transition", variants[p.variant ?? "primary"])}>
        {p.label}
      </a>
    );
  },

  breadcrumbs: (block) => {
    const p = block.props as { items: Array<{ label: string; href?: string }> };
    return (
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
          {p.items.map((item, i) => {
            const last = i === p.items.length - 1;
            return (
              <li key={i} className="flex items-center gap-1">
                {item.href && !last ? (
                  <a href={item.href} className="hover:text-ink hover:underline">{item.label}</a>
                ) : (
                  <span aria-current={last ? "page" : undefined} className={last ? "text-ink" : undefined}>{item.label}</span>
                )}
                {!last ? (
                  <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
                    <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </li>
            );
          })}
        </ol>
      </nav>
    );
  },

  // Radio + named-peer tabs: pure CSS, zero JS, static-export safe.
  // All radios render first (sr-only) so every label and panel is a
  // LATER SIBLING the peer selector can reach. The class arrays below
  // are complete static literals — the Tailwind scanner requirement —
  // which is why the schema caps tabs at 6.
  tabs: (block) => {
    const p = block.props as { items: Array<{ id: string; label: string; body: RichTextDoc }> };
    const group = `tabs-${block.id}`;
    const RADIO = ["peer/t0", "peer/t1", "peer/t2", "peer/t3", "peer/t4", "peer/t5"];
    const LABEL = [
      "peer-checked/t0:bg-cream peer-checked/t0:text-ink",
      "peer-checked/t1:bg-cream peer-checked/t1:text-ink",
      "peer-checked/t2:bg-cream peer-checked/t2:text-ink",
      "peer-checked/t3:bg-cream peer-checked/t3:text-ink",
      "peer-checked/t4:bg-cream peer-checked/t4:text-ink",
      "peer-checked/t5:bg-cream peer-checked/t5:text-ink",
    ];
    const PANEL = [
      "hidden peer-checked/t0:block",
      "hidden peer-checked/t1:block",
      "hidden peer-checked/t2:block",
      "hidden peer-checked/t3:block",
      "hidden peer-checked/t4:block",
      "hidden peer-checked/t5:block",
    ];
    const items = p.items.slice(0, 6);
    // ONE flex-wrap container: radios (sr-only), then labels (the tab
    // strip row), then full-width panels — everything a direct sibling
    // so the general-sibling peer selector reaches labels AND panels.
    return (
      <div className="flex flex-wrap gap-1 rounded-xl border border-ink/10 p-1">
        {items.map((item, i) => (
          <input
            key={item.id}
            type="radio"
            id={`${group}-${i}`}
            name={group}
            defaultChecked={i === 0}
            className={cx("sr-only", RADIO[i])}
          />
        ))}
        {items.map((item, i) => (
          <label
            key={item.id}
            htmlFor={`${group}-${i}`}
            className={cx("cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition hover:bg-cream", LABEL[i])}
          >
            {item.label}
          </label>
        ))}
        {items.map((item, i) => (
          <div key={item.id} className={cx("w-full border-t border-ink/10 p-4 text-sm", PANEL[i])}>
            <RichText doc={item.body} />
          </div>
        ))}
      </div>
    );
  },

  // ── Commerce blocks (Phase 10): bind, never own ───────────
  productCard: (block, ctx) => {
    const p = block.props as { product: string; showPrice?: boolean; showTagline?: boolean };
    const product = productFrom(ctx, p.product);
    if (!product) return <MissingProduct refStr={p.product} editing={ctx.editing} />;
    return <ProductCardInner p={product} refStr={p.product} showPrice={p.showPrice} showTagline={p.showTagline} />;
  },

  productGrid: (block, ctx) => {
    const p = block.props as { category: string; columns?: number; limit?: number; includeComingSoon?: boolean };
    const products = ctx.catalog?.[p.category] ?? [];
    const visible = products
      .filter((x) => p.includeComingSoon !== false || x.status === "live")
      .slice(0, p.limit ?? 24);
    if (visible.length === 0) return ctx.editing ? <MissingProduct refStr={`${p.category}/*`} editing /> : null;
    return (
      <div className={GRID_COLS[p.columns ?? 3] ?? GRID_COLS[3]}>
        {visible.map((x) => (
          <ProductCardInner key={x.slug} p={x} refStr={`${p.category}/${x.slug}`} showTagline={false} />
        ))}
      </div>
    );
  },

  featuredProduct: (block, ctx) => {
    const p = block.props as { binding: string; headline?: string };
    const ref = p.binding === "cms:featured" ? ctx.cms?.featured : p.binding;
    const product = ref ? productFrom(ctx, ref) : null;
    if (!product || !ref) return <MissingProduct refStr={p.binding} editing={ctx.editing} />;
    return (
      <a href={productHref(ref)} className="grid items-center gap-5 rounded-2xl border border-ink/10 bg-white/60 p-5 shadow-sm transition hover:shadow-md md:grid-cols-2">
        {product.coverImage ? <img src={product.coverImage} alt={product.name} loading="lazy" className="aspect-square w-full rounded-xl object-cover" /> : null}
        <div>
          <p className="mb-1 text-xs uppercase tracking-[0.2em] text-accent">{p.headline ?? "We think you’ll love"}</p>
          <h3 className="font-display text-xl md:text-2xl">{product.name}</h3>
          {product.tagline ? <p className="mt-2 text-sm text-muted">{product.tagline}</p> : null}
          <p className="mt-3 font-medium">{price(product)}</p>
        </div>
      </a>
    );
  },

  relatedProducts: (block, ctx) => {
    const p = block.props as { product: string; limit?: number };
    const [category, slug] = p.product.split("/");
    const siblings = (ctx.catalog?.[category] ?? []).filter((x) => x.slug !== slug).slice(0, p.limit ?? 3);
    if (siblings.length === 0) return ctx.editing ? <MissingProduct refStr={p.product} editing /> : null;
    return (
      <div className={GRID_COLS[3]}>
        {siblings.map((x) => (
          <ProductCardInner key={x.slug} p={x} refStr={`${category}/${x.slug}`} />
        ))}
      </div>
    );
  },

  swatchRow: (block, ctx) => {
    const p = block.props as {
      product?: string;
      swatches?: Array<{ id: string; color: string; name: string; description?: string }>;
      layout: "horizontal" | "vertical";
      size?: string;
      showNames?: boolean;
    };
    // Product binding: render its colorways' swatch colors; else inline swatches.
    const items = p.product
      ? (productFrom(ctx, p.product)?.colorways ?? []).map((cw, i) => ({
          id: `cw-${i}`,
          color: String((cw.swatch as { color?: string; gradient?: string[] } | undefined)?.color ?? (cw.swatch as { gradient?: string[] } | undefined)?.gradient?.[0] ?? "#CCCCCC"),
          name: cw.label,
          description: undefined as string | undefined,
        }))
      : (p.swatches ?? []);
    if (items.length === 0) return ctx.editing ? <MissingProduct refStr={p.product ?? "swatches"} editing /> : null;
    const dot = SWATCH_SIZE[p.size ?? "md"] ?? SWATCH_SIZE.md;
    return (
      <ul className={p.layout === "vertical" ? "space-y-2" : "flex flex-wrap items-start gap-3"}>
        {items.map((s) => (
          <li key={s.id} className={p.layout === "vertical" ? "flex items-center gap-2" : "flex max-w-24 flex-col items-center gap-1 text-center"}>
            <span className={cx(dot, "shrink-0 rounded-full border border-ink/15 shadow-sm")} style={{ background: s.color }} title={s.name} />
            {p.showNames !== false ? (
              <span className="text-xs leading-tight">
                {s.name}
                {s.description ? <span className="block text-[10px] text-muted">{s.description}</span> : null}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    );
  },

  inventoryBadge: (block, ctx) => {
    const p = block.props as { product: string };
    const product = productFrom(ctx, p.product);
    if (!product) return <MissingProduct refStr={p.product} editing={ctx.editing} />;
    const inv = ctx.inventory?.[p.product];
    if (product.status !== "live") {
      return <span className="inline-block rounded-full bg-ink/10 px-3 py-1 text-xs font-medium text-muted">Coming soon</span>;
    }
    if (inv?.soldOut) {
      return <span className="inline-block rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800">Sold out</span>;
    }
    if (inv?.remaining !== undefined && inv.remaining <= 3) {
      return <span className="inline-block rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-ink">Only {inv.remaining} left</span>;
    }
    return <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-900">Made to order</span>;
  },

  buyBox: (block, ctx) => {
    const p = block.props as { product: string; ctaLabel?: string };
    const product = productFrom(ctx, p.product);
    if (!product) return <MissingProduct refStr={p.product} editing={ctx.editing} />;
    if (product.status !== "live") return <MissingProduct refStr={`${p.product} (not live)`} editing={ctx.editing} />;
    return (
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-ink/10 bg-white/70 p-4 shadow-sm">
        <div className="min-w-0">
          <h3 className="truncate font-display text-base">{product.name}</h3>
          <p className="text-sm font-medium">{price(product)}</p>
        </div>
        <a href={productHref(p.product)} className="shrink-0 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream transition hover:opacity-90">
          {p.ctaLabel ?? "View & buy"}
        </a>
      </div>
    );
  },

  pillNav: (block, ctx) => {
    const p = block.props as {
      items: Array<{ id: string; icon: string; label: string; href: string }>;
      position: "bottom" | "top";
      preset?: string;
      showLabels?: boolean;
      heightPx?: number;
      radiusPx?: number;
    };
    const preset = ctx.glass?.find((g) => g.name === p.preset) ?? ctx.glass?.[0];
    const glass: CSSProperties = preset ? (glassPresetToCss(preset) as CSSProperties) : FALLBACK_GLASS;
    const height = p.heightPx ?? 56;
    const radius = p.radiusPx ?? 28;

    // Published pages: fixed to the viewport with safe-area breathing
    // room. Editor preview: sticky inside the frame (same geometry).
    const positionClass = ctx.editing
      ? p.position === "top"
        ? "sticky top-2 z-30"
        : "sticky bottom-2 z-30"
      : p.position === "top"
        ? "fixed inset-x-0 top-0 z-40 pt-[max(0.5rem,env(safe-area-inset-top))]"
        : "fixed inset-x-0 bottom-0 z-40 pb-[max(0.75rem,env(safe-area-inset-bottom))]";

    return (
      <nav aria-label="Mobile navigation" className={cx(positionClass, "pointer-events-none px-4")}>
        <div
          className="pointer-events-auto mx-auto flex w-fit max-w-full items-stretch justify-center gap-1 px-2"
          style={{ ...glass, height, borderRadius: radius }}
        >
          {p.items.map((item, i) => (
            <a
              key={item.id}
              href={item.href}
              aria-label={item.label}
              className="flex min-w-[52px] flex-col items-center justify-center gap-0.5 rounded-full px-3 text-ink transition hover:opacity-80"
              style={
                i === 0 && preset && preset.activeGlow > 0
                  ? { boxShadow: `0 0 ${Math.round(16 * preset.activeGlow)}px rgba(176,136,66,${(0.7 * preset.activeGlow).toFixed(2)})` }
                  : undefined
              }
            >
              <PillIcon name={item.icon} />
              {p.showLabels !== false ? <span className="text-[10px] font-medium leading-none">{item.label}</span> : null}
            </a>
          ))}
        </div>
      </nav>
    );
  },

  // Floating ▲/▼ section navigator (plan §18). The ONE block that
  // inlines JavaScript: "scroll to the next section from here" has
  // no CSS expression. The script ships inside the block's markup —
  // parser-inserted, so it runs on the SSR'd live site and in every
  // export with zero extra files — and the nav renders `hidden`
  // until the script un-hides it, so no-JS visitors never meet dead
  // buttons. In the editor preview (client render: innerHTML scripts
  // don't execute) it renders as a sticky visual mock instead.
  sectionJumper: (block, ctx) => {
    const p = block.props as {
      edge?: "right" | "left";
      align?: "center" | "lower";
      size?: "sm" | "md" | "lg";
      stops?: string;
      preset?: string;
      accent?: string;
      upLabel?: string;
      downLabel?: string;
    };
    const preset = ctx.glass?.find((g) => g.name === p.preset) ?? ctx.glass?.[0];
    const glass: CSSProperties = preset ? (glassPresetToCss(preset) as CSSProperties) : FALLBACK_GLASS;
    const px = { sm: 44, md: 52, lg: 60 }[p.size ?? "md"]; // 44px tap floor
    const domId = jumperDomId(block.id);

    // Static class literals (Tailwind scanner): edge × align × mode.
    const positionClass = ctx.editing
      ? "sticky bottom-20 z-30 ml-auto mr-3 w-fit"
      : cx(
          "fixed z-40",
          p.edge === "left"
            ? "left-[max(0.75rem,env(safe-area-inset-left))]"
            : "right-[max(0.75rem,env(safe-area-inset-right))]",
          p.align === "lower" ? "bottom-[max(6rem,env(safe-area-inset-bottom))]" : "top-1/2 -translate-y-1/2"
        );

    const btn = (dir: "prev" | "next", label: string) => (
      <button
        type="button"
        data-jump={dir}
        aria-label={label}
        className="flex items-center justify-center rounded-full border border-ink/15 text-ink shadow-md"
        style={{ ...glass, width: px, height: px }}
      >
        <svg viewBox="0 0 16 16" className="h-5 w-5" aria-hidden="true">
          <path d={dir === "prev" ? "M4 10l4-4 4 4" : "M4 6l4 4 4-4"} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    );

    return (
      <>
        <nav
          id={domId}
          aria-label="Jump between sections"
          hidden={!ctx.editing}
          data-stops={JUMPER_STOP_SELECTORS[p.stops ?? "sections"] ?? JUMPER_STOP_SELECTORS.sections}
          data-pos="top"
          className={cx(positionClass, "flex flex-col gap-2")}
        >
          {btn("prev", p.upLabel ?? "Previous section")}
          {btn("next", p.downLabel ?? "Next section")}
        </nav>
        <style dangerouslySetInnerHTML={{ __html: sectionJumperCss(block.id, p.accent) }} />
        {ctx.editing ? null : <script dangerouslySetInnerHTML={{ __html: sectionJumperScript(block.id) }} />}
      </>
    );
  },

  // Day / Night / Candlelight switcher (plan §19). Same progressive
  // pattern as sectionJumper: hidden until its inline script runs
  // (mode toggling and the candle are inherently JS), while the AUTO
  // dark path needs no JS at all — prefers-color-scheme CSS from the
  // appearance compiler handles visitors who never touch this.
  appearanceSwitcher: (block, ctx) => {
    const p = block.props as {
      style?: "pills" | "icons";
      showAuto?: boolean;
      showCandle?: boolean;
      showWarmth?: boolean;
      preset?: string;
      lightLabel?: string;
      darkLabel?: string;
      autoLabel?: string;
      candleLabel?: string;
    };
    const preset = ctx.glass?.find((g) => g.name === p.preset) ?? ctx.glass?.[0];
    const glass: CSSProperties = preset ? (glassPresetToCss(preset) as CSSProperties) : FALLBACK_GLASS;
    const domId = appearanceDomId(block.id);
    const iconsOnly = p.style === "icons";

    const icon = (name: "sun" | "moon" | "auto" | "candle") => (
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
        {name === "sun" ? (
          <>
            <circle cx="12" cy="12" r="4" {...stroke} />
            <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" {...stroke} />
          </>
        ) : name === "moon" ? (
          <path d="M20 13.5A8 8 0 1110.5 4 6.5 6.5 0 0020 13.5z" {...stroke} />
        ) : name === "auto" ? (
          <>
            <circle cx="12" cy="12" r="8" {...stroke} />
            <path d="M12 4a8 8 0 010 16z" fill="currentColor" opacity="0.55" />
          </>
        ) : (
          // the candle: flame over a wick
          <path d="M12 3s3.5 3.4 3.5 6.2A3.5 3.5 0 0112 12.7a3.5 3.5 0 01-3.5-3.5C8.5 6.4 12 3 12 3zM9 15h6v6H9z" {...stroke} />
        )}
      </svg>
    );

    const modeBtn = (mode: "light" | "dark" | "auto", label: string, ic: "sun" | "moon" | "auto", pressed: boolean) => (
      <button
        type="button"
        data-ap-mode={mode}
        aria-pressed={pressed}
        aria-label={label}
        className="flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-transparent px-3 text-sm text-ink"
      >
        {icon(ic)}
        {iconsOnly ? null : <span className="font-medium">{label}</span>}
      </button>
    );

    return (
      <>
        <div id={domId} hidden={!ctx.editing} className="inline-flex flex-col gap-2">
          <div role="group" aria-label="Appearance" className="flex w-fit items-center gap-1 rounded-full p-1" style={glass}>
            {modeBtn("light", p.lightLabel ?? "Day", "sun", true)}
            {modeBtn("dark", p.darkLabel ?? "Night", "moon", false)}
            {p.showAuto !== false ? modeBtn("auto", p.autoLabel ?? "Auto", "auto", false) : null}
            {p.showCandle !== false ? (
              <button
                type="button"
                data-ap-candle
                aria-pressed={false}
                aria-label={p.candleLabel ?? "Candlelight"}
                className="flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-transparent px-3 text-sm text-ink"
              >
                {icon("candle")}
                {iconsOnly ? null : <span className="font-medium">{p.candleLabel ?? "Candlelight"}</span>}
              </button>
            ) : null}
          </div>
          {p.showCandle !== false && p.showWarmth !== false ? (
            <label data-ap-warmthrow hidden={!ctx.editing} className="flex items-center gap-2 text-xs text-muted">
              <span>Less warm</span>
              <input type="range" min={0} max={100} step={1} defaultValue={(ctx.candle ?? CANDLE_DEFAULTS).warmth} data-ap-warmth aria-label="Candlelight warmth" className="w-36 accent-ink" />
              <span>More warm</span>
            </label>
          ) : null}
        </div>
        <style dangerouslySetInnerHTML={{ __html: appearanceSwitcherCss(block.id) }} />
        {ctx.editing ? null : <script dangerouslySetInnerHTML={{ __html: appearanceSwitcherScript(block.id, ctx.candle ?? CANDLE_DEFAULTS) }} />}
      </>
    );
  },

  // ── Languages (offline) ───────────────────────────────────
  languageSwitcher: (block, ctx) => {
    const p = block.props as { label?: string; style?: string; locales?: string[]; showFlags?: boolean };
    const all = ctx.i18n?.locales ?? [];
    const list = p.locales && p.locales.length ? all.filter((l) => p.locales!.includes(l.code)) : all;
    if (list.length <= 1) return null; // nothing to switch between
    const current = ctx.i18n?.current;
    if (p.style === "dropdown") {
      // zero-JS native dropdown: links inside a <details>.
      return (
        <details className="relative inline-block text-sm">
          <summary className="cursor-pointer list-none rounded-full border border-ink/20 px-3 py-1.5 [&::-webkit-details-marker]:hidden">
            {list.find((l) => l.code === current)?.endonym ?? p.label ?? "Language"} ▾
          </summary>
          <ul className="absolute z-30 mt-1 min-w-32 rounded-xl border border-ink/15 bg-white p-1 shadow-card">
            {list.map((l) => (
              <li key={l.code}>
                <a href={ctx.i18n!.hrefForLocale(l.code)} hrefLang={l.code} className={cx("block rounded px-3 py-1.5", l.code === current ? "bg-cream font-medium" : "hover:bg-cream")}>
                  {l.endonym}
                </a>
              </li>
            ))}
          </ul>
        </details>
      );
    }
    // pills / inline: a row of links
    return (
      <nav aria-label="Language" className={cx("flex flex-wrap items-center gap-1.5 text-sm", p.style === "inline" && "gap-3")}>
        {p.label ? <span className="text-muted">{p.label}:</span> : null}
        {list.map((l) => (
          <a
            key={l.code}
            href={ctx.i18n!.hrefForLocale(l.code)}
            hrefLang={l.code}
            aria-current={l.code === current ? "true" : undefined}
            className={
              p.style === "inline"
                ? cx("underline-offset-2 hover:underline", l.code === current && "font-semibold text-accent")
                : cx("rounded-full border px-3 py-1", l.code === current ? "border-ink bg-ink text-cream" : "border-ink/20 hover:bg-cream")
            }
          >
            {l.endonym}
          </a>
        ))}
      </nav>
    );
  },

  languageGate: (block, ctx) => {
    const p = block.props as { heading?: string; subtext?: string; continueLabel?: string; mode?: string };
    const list = ctx.i18n?.locales ?? [];
    if (list.length <= 1) return null;
    // A full-bleed pre-entry prompt: pick a language → enter that locale's
    // site. Zero-JS — each choice is a link to the locale's home.
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/80 p-6 text-center backdrop-blur" role="dialog" aria-modal="true">
        <div className="w-full max-w-sm rounded-2xl bg-cream p-6 shadow-float">
          <h2 className="font-display text-2xl">{p.heading ?? "Choose your language"}</h2>
          {p.subtext ? <p className="mt-1 text-sm text-muted">{p.subtext}</p> : null}
          <div className="mt-4 grid gap-2">
            {list.map((l) => (
              <a key={l.code} href={ctx.i18n!.hrefForLocale(l.code)} hrefLang={l.code} className="rounded-full bg-ink px-5 py-2.5 text-cream">
                {l.endonym}
              </a>
            ))}
          </div>
        </div>
      </div>
    );
  },

  searchLauncher: (block) => {
    const p = block.props as { label: string; placeholder?: string; href: string; style?: string };
    if (p.style === "bar") {
      return (
        <a href={p.href} aria-label={p.label} className="flex items-center gap-2 rounded-xl border border-ink/15 bg-white/70 px-4 py-2.5 text-sm text-muted hover:border-accent">
          <SearchIcon />
          {p.placeholder ?? p.label}
        </a>
      );
    }
    return (
      <a href={p.href} aria-label={p.label} className="inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-ink/15 bg-white/70 px-4 text-sm hover:border-accent">
        <SearchIcon />
        <span>{p.label}</span>
      </a>
    );
  },

  // ── Small-business blocks (plan §22) ──────────────────────
  contactForm: (block, ctx) => {
    const p = block.props as {
      provider: "netlify" | "formspree" | "web3forms" | "mailto";
      endpoint?: string;
      heading?: string;
      nameLabel?: string;
      emailLabel?: string;
      messageLabel?: string;
      submitLabel?: string;
    };
    const formName = `contact-${block.id}`;
    if (p.provider === "mailto") {
      return (
        <div className="rounded-2xl border border-ink/10 bg-white/60 p-5 text-center shadow-sm">
          {p.heading ? <h3 className="mb-2 font-display text-lg">{p.heading}</h3> : null}
          <a href={`mailto:${p.endpoint}`} className="inline-block rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream transition hover:opacity-90">
            {p.submitLabel ?? "Email us"}
          </a>
        </div>
      );
    }
    const action =
      p.provider === "formspree" ? p.endpoint : p.provider === "web3forms" ? "https://api.web3forms.com/submit" : undefined;
    const inputClass = "w-full rounded-lg border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none";
    return (
      <form
        method="POST"
        action={action}
        {...(p.provider === "netlify" ? { "data-netlify": "true", name: formName, "netlify-honeypot": "bot-field" } : {})}
        className="space-y-3 rounded-2xl border border-ink/10 bg-white/60 p-5 shadow-sm"
      >
        {p.heading ? <h3 className="font-display text-lg">{p.heading}</h3> : null}
        {p.provider === "netlify" ? <input type="hidden" name="form-name" value={formName} /> : null}
        {p.provider === "web3forms" ? <input type="hidden" name="access_key" value={p.endpoint} /> : null}
        {/* honeypot — bots fill it, humans never see it */}
        <p className="hidden" aria-hidden="true">
          <input type="text" name="bot-field" tabIndex={-1} autoComplete="off" />
        </p>
        <label className="block text-sm">
          {p.nameLabel ?? "Name"}
          <input type="text" name="name" required className={inputClass} />
        </label>
        <label className="block text-sm">
          {p.emailLabel ?? "Email"}
          <input type="email" name="email" required className={inputClass} />
        </label>
        <label className="block text-sm">
          {p.messageLabel ?? "Message"}
          <textarea name="message" rows={4} required className={inputClass} />
        </label>
        <button type="submit" className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream transition hover:opacity-90">
          {p.submitLabel ?? "Send"}
        </button>
        {ctx.editing && p.provider === "netlify" ? (
          <p className="rounded bg-accent/10 px-2 py-1 text-xs text-muted">Netlify Forms works when the site is hosted on Netlify (submissions appear in the dashboard). Other hosts: switch to Formspree or Web3Forms.</p>
        ) : null}
      </form>
    );
  },

  // Local files play natively; YouTube/Vimeo render as a privacy facade:
  // a plain link (zero third-party requests) the inline script upgrades
  // to an embed on click. Reduced-data, no-JS and export-safe by default.
  video: (block, ctx) => {
    const p = block.props as { kind: "file" | "youtube" | "vimeo"; src: string; poster?: string; caption?: string };
    let inner: ReactNode;
    if (p.kind === "file") {
      inner = <video controls preload="metadata" poster={p.poster} src={p.src} className="w-full rounded-xl" />;
    } else {
      const domId = videoDomId(block.id);
      inner = (
        <div className="relative aspect-video overflow-hidden rounded-xl bg-ink">
          <a
            id={domId}
            href={videoWatchUrl(p.kind, p.src)}
            target="_blank"
            rel="noreferrer"
            aria-label={p.caption ?? "Play video"}
            className="absolute inset-0 flex items-center justify-center"
            style={p.poster ? { background: `center/cover no-repeat url(${JSON.stringify(p.poster)})` } : undefined}
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-cream/90 shadow-md transition hover:scale-105">
              <svg viewBox="0 0 24 24" className="ml-1 h-7 w-7 text-ink" aria-hidden="true">
                <path d="M8 5l11 7-11 7z" fill="currentColor" />
              </svg>
            </span>
          </a>
          {ctx.editing ? null : <script dangerouslySetInnerHTML={{ __html: videoFacadeScript(block.id, p.kind, p.src) }} />}
        </div>
      );
    }
    return p.caption ? (
      <figure>
        {inner}
        <figcaption className="mt-1 text-sm text-muted">{p.caption}</figcaption>
      </figure>
    ) : (
      inner
    );
  },

  socialRow: (block) => {
    const p = block.props as { label?: string; links: Array<{ platform: string; href: string }>; size?: string };
    const px = { sm: 36, md: 44, lg: 52 }[p.size ?? "md"];
    return (
      <nav aria-label={p.label ?? "Social links"} className="flex flex-wrap items-center gap-2">
        {p.label ? <span className="mr-1 text-sm text-muted">{p.label}</span> : null}
        {p.links.map((l, i) => (
          <a
            key={i}
            href={l.href}
            aria-label={l.platform}
            target={l.href.startsWith("http") ? "_blank" : undefined}
            rel={l.href.startsWith("http") ? "noreferrer" : undefined}
            className="flex items-center justify-center rounded-full border border-ink/15 bg-white/70 text-ink transition hover:border-accent"
            style={{ width: px, height: px }}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              {SOCIAL_ICON_SVGS[l.platform] ?? SOCIAL_ICON_SVGS.email}
            </svg>
          </a>
        ))}
      </nav>
    );
  },

  hoursTable: (block) => {
    const p = block.props as { heading?: string; rows: Array<{ days: string; hours: string }>; note?: string };
    return (
      <div className="rounded-2xl border border-ink/10 bg-white/60 p-5 shadow-sm">
        {p.heading ? <h3 className="mb-3 font-display text-lg">{p.heading}</h3> : null}
        <dl className="space-y-1.5">
          {p.rows.map((r, i) => (
            <div key={i} className="flex items-baseline justify-between gap-4 text-sm">
              <dt className="font-medium">{r.days}</dt>
              <dd className="text-muted">{r.hours}</dd>
            </div>
          ))}
        </dl>
        {p.note ? <p className="mt-3 text-xs text-muted">{p.note}</p> : null}
      </div>
    );
  },

  specTable: (block) => {
    const p = block.props as { heading?: string; rows: Array<{ label: string; value: string; detail?: string }>; striped?: boolean; note?: string };
    return (
      <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white/60 shadow-sm">
        {p.heading ? <h3 className="border-b border-ink/10 px-4 py-3 font-display text-lg">{p.heading}</h3> : null}
        <table className="w-full text-sm">
          <tbody>
            {p.rows.map((r, i) => (
              <tr key={i} className={p.striped !== false && i % 2 === 1 ? "bg-cream/50" : undefined}>
                <th scope="row" className="px-4 py-2 text-left font-medium">{r.label}</th>
                <td className="px-4 py-2 text-right">{r.value}</td>
                {p.rows.some((x) => x.detail) ? <td className="px-4 py-2 text-right text-xs text-muted">{r.detail ?? ""}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
        {p.note ? <p className="border-t border-ink/10 px-4 py-2 text-xs text-muted">{p.note}</p> : null}
      </div>
    );
  },

  mapLink: (block) => {
    const p = block.props as { address: string; label?: string; image?: string };
    const href = `https://maps.google.com/?q=${encodeURIComponent(p.address)}`;
    return (
      <a href={href} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl border border-ink/10 bg-white/60 shadow-sm transition hover:shadow-md">
        {p.image ? <img src={p.image} alt="" loading="lazy" className="h-40 w-full object-cover" /> : null}
        <span className="flex items-center gap-3 p-4">
          <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 text-accent" aria-hidden="true">
            <path d="M12 21s-7-6.1-7-11a7 7 0 0114 0c0 4.9-7 11-7 11z" {...stroke} />
            <circle cx="12" cy="10" r="2.5" {...stroke} />
          </svg>
          <span>
            <span className="block text-sm font-medium">{p.label ?? "Find us"}</span>
            <span className="block text-xs text-muted">{p.address}</span>
          </span>
        </span>
      </a>
    );
  },

  announcementBar: (_block, ctx) => {
    const a = ctx.cms?.announcement;
    if (!a?.enabled || !a.message) return null; // off = renders nothing, same as the live site
    return (
      <div className="bg-ink px-4 py-2 text-center text-sm text-cream">
        {a.message}
        {a.link && a.linkLabel ? (
          <a href={a.link} className="ml-2 underline decoration-accent underline-offset-2">{a.linkLabel}</a>
        ) : null}
      </div>
    );
  },

  faqSection: (block, ctx) => {
    const p = block.props as { binding?: string; items?: Array<{ id: string; q: string; a: RichTextDoc }> };
    const items = p.binding
      ? (ctx.cms?.faq ?? []).map((f, i) => ({ id: `faq-${i}`, q: f.q, a: f.a }))
      : (p.items ?? []);
    if (items.length === 0) return null;
    return (
      <div className="divide-y divide-ink/10 rounded-xl border border-ink/10">
        {items.map((item) => (
          <details key={item.id} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 font-medium [&::-webkit-details-marker]:hidden">
              {item.q}
              {chevron}
            </summary>
            <div className="px-4 pb-4 text-sm"><RichText doc={item.a} /></div>
          </details>
        ))}
      </div>
    );
  },
};
