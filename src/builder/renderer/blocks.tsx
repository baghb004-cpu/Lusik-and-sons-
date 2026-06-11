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
