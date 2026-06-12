"use client";

// ============================================================
// Page SEO panel (plan §22) — title, description, social image
// ============================================================
// Edits the page's seo fields with a live search-result preview,
// so "how this looks on Google" is visible while typing instead
// of discovered after indexing. Exports already consume these
// fields (title/meta/og:image) and the sitemap covers every page.
// ============================================================

import type { Page } from "../schema/index.ts";

const inputClass =
  "w-full rounded-lg border border-ink/15 bg-white/80 px-2 py-1.5 text-xs focus:border-accent focus:outline-none";

export function SeoPanel({
  page,
  siteName,
  onChange,
}: {
  page: Page;
  siteName: string;
  onChange: (seo: Page["seo"]) => void;
}) {
  const seo = page.seo ?? {};
  const set = (key: "title" | "description" | "ogImage", v: string) =>
    onChange({ ...seo, [key]: v || undefined });
  const shownTitle = seo.title || `${page.title} — ${siteName}`;
  const shownDesc = seo.description || "Add a description — search engines write their own (often worse) when this is empty.";

  return (
    <details className="rounded-xl border border-ink/10 bg-white/50">
      <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
        Search & sharing (SEO)
      </summary>
      <div className="space-y-2 px-3 pb-3">
        {/* the live search-result preview */}
        <div className="rounded-lg border border-ink/10 bg-white p-3" aria-hidden="true">
          <p className="truncate text-[15px] leading-snug text-[#1a0dab]">{shownTitle}</p>
          <p className="text-[11px] text-[#006621]">yoursite.com/{page.slug === "index" ? "" : page.slug}</p>
          <p className={`line-clamp-2 text-xs ${seo.description ? "text-[#545454]" : "italic text-muted"}`}>{shownDesc}</p>
        </div>

        <label className="block text-xs">
          <span className="mb-0.5 flex justify-between text-[11px] uppercase tracking-wide text-muted">
            <span>Search title</span>
            <span className={(seo.title?.length ?? 0) > 60 ? "text-red-600" : ""}>{seo.title?.length ?? 0}/60</span>
          </span>
          <input type="text" value={seo.title ?? ""} placeholder={shownTitle} onChange={(e) => set("title", e.target.value)} className={inputClass} aria-label="SEO title" />
        </label>
        <label className="block text-xs">
          <span className="mb-0.5 flex justify-between text-[11px] uppercase tracking-wide text-muted">
            <span>Description</span>
            <span className={(seo.description?.length ?? 0) > 160 ? "text-red-600" : ""}>{seo.description?.length ?? 0}/160</span>
          </span>
          <textarea rows={2} value={seo.description ?? ""} onChange={(e) => set("description", e.target.value)} className={inputClass} aria-label="SEO description" />
        </label>
        <label className="block text-xs">
          <span className="mb-0.5 block text-[11px] uppercase tracking-wide text-muted">Social share image</span>
          <input type="text" value={seo.ogImage ?? ""} placeholder="/img/uploads/… (🖼 Media panel)" onChange={(e) => set("ogImage", e.target.value)} className={`${inputClass} font-mono`} aria-label="Social share image path" />
        </label>
        {seo.ogImage ? <img src={seo.ogImage} alt="Social share preview" className="aspect-[1.91/1] w-full rounded-lg border border-ink/10 object-cover" /> : null}
      </div>
    </details>
  );
}
