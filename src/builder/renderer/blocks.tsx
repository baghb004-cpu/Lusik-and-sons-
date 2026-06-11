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

import type { ReactNode } from "react";
import type { Block, RichTextDoc } from "../schema/index.ts";
import { RichText } from "./RichText.tsx";
import { cx } from "./style.ts";
import { tokenToCss } from "./style.ts";

export interface RenderContext {
  /** CMS surfaces for bound blocks, injected by the caller (Phase 4). */
  cms?: {
    announcement?: { enabled: boolean; message: string; link?: string; linkLabel?: string };
    faq?: Array<{ q: string; a: RichTextDoc }>;
  };
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

  gallery: (block) => {
    const p = block.props as { images: Array<{ src: string; alt: string }>; layout: string; columns?: number };
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
