"use client";

// ============================================================
// Lusik's Journal — mini-blog
// ============================================================
// Three components in one module: list view, single-post view,
// and the router-style parent that swaps between them based on
// the `slug` prop. Real history-API URLs are handled in App
// (which sets `journalSlug` state from window.location.pathname);
// this component just renders whatever it's told.
//
// JSON-LD BlogPosting structured data is emitted from
// JournalPostView so each post is indexed as its own page by
// Google.
//
// + their dependencies (JOURNAL_POSTS) consolidated here.
// ============================================================

import React, { useEffect } from "react";
import { JOURNAL_POSTS } from "../data/journalPosts.js";
import { BookOpen } from "./icons.jsx";
import { StitchDivider } from "./Theater.jsx";
import { useTilt3D } from "../lib/useTilt3D";

function formatPublishedDate(iso) {
  if (!iso) return "";
  // Construct in local time to avoid the off-by-one-day issue when a
  // pure YYYY-MM-DD string is interpreted as UTC midnight.
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// One mobile editorial card. A component (not a map body) so each card
// can own a useTilt3D ref — the DEPTH tilt + glare layer.
function MobilePostCard({ post, onSelect }) {
  const tiltRef = useTilt3D();
  return (
    <article
      ref={tiltRef}
      onClick={onSelect}
      className="vt-rise t3d t3d-glare w-full text-left overflow-hidden block cursor-pointer"
      style={{ borderRadius: 22, background: "var(--bg-surface, #FFFFFF)", border: "1px solid var(--border-soft, rgba(26,22,18,0.08))" }}
    >
      {/* "Cover" band — the title set large, like the media art
          on an Apple card (we have no per-post photos, so a soft
          brand-gold wash + the title carries it). */}
      <div
        className="relative flex flex-col justify-end"
        style={{
          minHeight: 172,
          padding: "20px",
          background: "linear-gradient(150deg, rgba(176,136,66,0.22) 0%, rgba(176,136,66,0.07) 55%, rgba(26,22,18,0.04) 100%)",
        }}
      >
        <span
          className="text-[0.6rem] tracking-[0.3em] uppercase"
          style={{ color: "var(--accent-text)", fontWeight: 600, position: "absolute", top: 18, left: 20 }}
        >
          Journal
        </span>
        <h2 className="font-display leading-tight" style={{ fontSize: "1.6rem", fontWeight: 400, letterSpacing: "-0.01em", color: "var(--text-primary)" }}>
          {post.title}
        </h2>
      </div>
      {/* Body — excerpt + a read-time meta pill. */}
      <div style={{ padding: "16px 20px 20px" }}>
        <p className="text-sm leading-relaxed mb-4 line-clamp-3" style={{ color: "var(--text-secondary, rgba(26,22,18,0.7))" }}>
          {post.excerpt}
        </p>
        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
          <BookOpen size={14} strokeWidth={1.6} style={{ color: "var(--accent-text)" }} />
          <span>{post.readMinutes} min read</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <time dateTime={post.publishedAt}>{formatPublishedDate(post.publishedAt)}</time>
        </div>
      </div>
    </article>
  );
}

export function JournalListView({ posts, onSelectPost, onBack }) {
  return (
    <div className="fade-in">
      {/* ============================================================
          MOBILE — Apple Store "Go Further" style: a section label and
          large editorial cards. The page title ("Journal") is supplied
          by MobilePageHeader above, mirroring the app's tab title.
          ============================================================ */}
      <div className="lg:hidden px-6 pt-1 pb-12">
        <p className="leading-tight mb-5" style={{ fontSize: "1.55rem", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
          Read something new
        </p>
        {/* Single column on phones; the editorial cards pair up
            magazine-style on the open-book tier (book: ≥700px — Fold
            inner display, iPad mini portrait). Desktop is below. */}
        <div className="t3d-scene space-y-5 book:space-y-0 book:grid book:grid-cols-2 book:gap-5">
          {posts.map((post) => (
            <MobilePostCard key={post.slug} post={post} onSelect={() => onSelectPost(post.slug)} />
          ))}
        </div>
      </div>

      {/* ============================================================
          DESKTOP — the existing editorial layout, unchanged.
          ============================================================ */}
      <div className="hidden lg:block max-w-4xl mx-auto px-6 lg:px-12 py-12 lg:py-20">
        <button onClick={onBack} className="text-xs tracking-[0.2em] uppercase opacity-70 hover:opacity-100 flex items-center gap-2 mb-8">
          ← Back to the shop
        </button>
        <header className="mb-12 lg:mb-16">
          <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: "var(--accent-text)" }}>The Journal</p>
          <h1 className="font-display text-4xl lg:text-5xl mb-4" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>
            Notes from <em style={{ fontWeight: 400 }}>Lusik's table</em>.
          </h1>
          <p className="text-base lg:text-lg opacity-75 leading-relaxed max-w-2xl">
            Short posts about the craft we make — the Armenian alphabet, the technique behind cross-stitch, the symbols woven into Lusik's blankets. Written for anyone curious about what goes into the work, not just the work itself.
          </p>
        </header>
        <div className="space-y-10">
          {posts.map((post) => (
            <article
              key={post.slug}
              className="group cursor-pointer pb-10"
              style={{ borderBottom: "1px solid rgba(26,22,18,0.1)" }}
              onClick={() => onSelectPost(post.slug)}
            >
              <div className="flex items-baseline gap-3 mb-2 flex-wrap">
                <time className="text-[0.65rem] tracking-[0.25em] uppercase opacity-70" dateTime={post.publishedAt}>
                  {formatPublishedDate(post.publishedAt)}
                </time>
                <span className="text-[0.65rem] tracking-[0.2em] uppercase opacity-40">·</span>
                <span className="text-[0.65rem] tracking-[0.25em] uppercase opacity-70">{post.readMinutes} min read</span>
              </div>
              <h2 className="font-display text-2xl lg:text-3xl mb-3 transition group-hover:opacity-80" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>
                {post.title}
              </h2>
              <p className="text-sm lg:text-base opacity-80 leading-relaxed mb-4 max-w-2xl">
                {post.excerpt}
              </p>
              <span className="text-[0.65rem] tracking-[0.2em] uppercase transition group-hover:opacity-100" style={{ color: "var(--accent-text)", fontWeight: 500 }}>
                Keep reading →
              </span>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

export function JournalPostView({ post, onBack, onSelectPost }) {
  // BlogPosting JSON-LD — gets indexed by Google whether it sits
  // in <head> or anywhere in the body, so we render it here
  // inline. Includes the canonical URL, author (the brand), and
  // publish date.
  const canonicalUrl = `https://lusikandsons.com/journal/${post.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type":    "BlogPosting",
    headline:   post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    author: { "@type": "Organization", name: "Lusik & Sons" },
    publisher: {
      "@type": "Organization",
      name:    "Lusik & Sons",
      logo: { "@type": "ImageObject", url: "https://lusikandsons.com/og-image.jpg" },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
    image: "https://lusikandsons.com/og-image.jpg",
  };

  // Quick "you might also like" — the two other most-recent posts.
  const others = JOURNAL_POSTS.filter((p) => p.slug !== post.slug).slice(0, 2);

  return (
    <div className="fade-in max-w-3xl mx-auto px-6 lg:px-12 py-12 lg:py-20">
      {/* The reading thread — a gold bar across the top of the screen
          spun from scroll position alone (CSS scroll(root) timeline). */}
      <div className="journal-progress" aria-hidden="true" />
      {/* Escape `<` so a future post body containing "</script>" can't
          break out of the JSON-LD block — same hardening as src/lib/seo.js. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <button onClick={onBack} className="text-xs tracking-[0.2em] uppercase opacity-70 hover:opacity-100 flex items-center gap-2 mb-8">
        ← All posts
      </button>
      <article>
        <header className="mb-10 lg:mb-12">
          <div className="flex items-baseline gap-3 mb-3 flex-wrap">
            <p className="text-[0.6rem] tracking-[0.3em] uppercase" style={{ color: "var(--accent-text)" }}>Journal</p>
            <span className="text-[0.65rem] tracking-[0.2em] uppercase opacity-40">·</span>
            <time className="text-[0.65rem] tracking-[0.25em] uppercase opacity-70" dateTime={post.publishedAt}>
              {formatPublishedDate(post.publishedAt)}
            </time>
            <span className="text-[0.65rem] tracking-[0.2em] uppercase opacity-40">·</span>
            <span className="text-[0.65rem] tracking-[0.25em] uppercase opacity-70">{post.readMinutes} min read</span>
          </div>
          <h1 className="font-display text-4xl lg:text-5xl leading-tight" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>
            {post.title}
          </h1>
          <StitchDivider className="mt-8" style={{ marginInline: 0 }} />
        </header>

        <div className="prose-journal space-y-6 max-w-none">
          {post.content.map((node, i) => {
            if (node.type === "h2") {
              return (
                <h2 key={i} className="font-display text-2xl lg:text-3xl mt-10 mb-2" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>
                  {node.text}
                </h2>
              );
            }
            if (node.type === "blockquote") {
              return (
                <blockquote key={i} className="font-display italic text-lg lg:text-xl border-l pl-5 leading-relaxed" style={{ borderColor: "var(--accent)", fontWeight: 400, color: "#3D332A" }}>
                  {node.text}
                </blockquote>
              );
            }
            return (
              <p key={i} className="text-base lg:text-lg leading-relaxed" style={{ color: "#3D332A" }}>
                {node.text}
              </p>
            );
          })}
        </div>
      </article>

      {others.length > 0 && (
        <aside className="mt-16 pt-10" style={{ borderTop: "1px solid rgba(26,22,18,0.12)" }}>
          <p className="text-[0.6rem] tracking-[0.3em] uppercase mb-5" style={{ color: "var(--accent-text)" }}>Keep reading</p>
          <div className="grid sm:grid-cols-2 gap-6">
            {others.map((p) => (
              <button
                key={p.slug}
                onClick={() => onSelectPost(p.slug)}
                className="text-left p-5 transition hover:bg-[rgba(26,22,18,0.03)]"
                style={{ border: "1px solid rgba(26,22,18,0.1)" }}
              >
                <time className="text-[0.6rem] tracking-[0.25em] uppercase opacity-70 block mb-2" dateTime={p.publishedAt}>
                  {formatPublishedDate(p.publishedAt)}
                </time>
                <h3 className="font-display text-lg leading-tight mb-2" style={{ fontWeight: 500 }}>
                  {p.title}
                </h3>
                <p className="text-xs opacity-70 leading-relaxed line-clamp-3">
                  {p.excerpt}
                </p>
              </button>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
}

export function JournalView({ slug, onSelectPost, onBack }) {
  // Scroll to top whenever the slug changes so readers don't land
  // mid-post when they tap into one from the list.
  useEffect(() => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "instant" });
  }, [slug]);

  if (slug) {
    const post = JOURNAL_POSTS.find((p) => p.slug === slug);
    if (post) {
      return <JournalPostView post={post} onBack={() => onSelectPost(null)} onSelectPost={onSelectPost} />;
    }
    // Unknown slug — fall through to the list with a soft notice.
  }
  return <JournalListView posts={JOURNAL_POSTS} onSelectPost={onSelectPost} onBack={onBack} />;
}
