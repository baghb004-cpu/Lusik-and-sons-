// ============================================================
// MobileSearchView — dedicated full-screen search page (mobile)
// ============================================================
// Renders as a FIXED full-screen panel (not in the normal page
// flow) so the results are always anchored at the top and snap
// into view the instant the customer types — no scrolling up to
// find them. This is the fix for the "result is at the top of a
// tall page, hidden behind the keyboard" problem.
//
// Layout (top → bottom):
//   - "Search" title (+ avatar, mirrors the other mobile pages)
//   - Scrollable results / suggestions list, anchored to the top,
//     padded at the bottom so the last row clears the floating
//     search bar + keyboard
//   - The search INPUT itself lives in MobileBottomNav's collapsed
//     search bar (fixed at the bottom, z-30). This panel sits at
//     z-20 so that bar floats on top.
//
// On every query change the results container scrolls back to the
// top, so the first match is always the first thing the customer
// sees.
//
// Searches across products (CATALOG), journal posts, and site
// sections. Pure client-side string matching — the corpus is
// small (< 50 items) so it runs on every keystroke with no debounce.
// ============================================================

import React, { useMemo, useRef, useEffect } from "react";
import { CATALOG } from "../data/catalog.js";
import { JOURNAL_POSTS } from "../data/journalPosts.js";
import { Search, ChevronRight, User } from "./icons.jsx";
import { useKeyboardOffset } from "../lib/useKeyboardOffset.js";

const SITE_SECTIONS = [
  { label: "FAQ",                id: "faq",      type: "section" },
  { label: "Shipping & Returns", id: "shipping", type: "section" },
  { label: "Contact Us",         id: "contact",  type: "section" },
  { label: "Our Story",          id: "story",    type: "section" },
];

const SUGGESTIONS = [
  "Armenian alphabet blanket",
  "Baptism towel",
  "Bari akhorzhak",
  "Cotton blanket",
  "Shipping",
  "Refund policy",
];

function buildProductIndex() {
  const items = [];
  for (const [_, category] of Object.entries(CATALOG)) {
    for (const product of category.products) {
      items.push({
        type: "product",
        name: product.name,
        tagline: product.tagline || "",
        description: product.description || "",
        priceFrom: product.priceFrom,
        status: product.status,
        categorySlug: category.slug,
        productSlug: product.slug,
        _search: [
          product.name,
          product.tagline || "",
          product.description || "",
          category.label,
        ].join(" ").toLowerCase(),
      });
    }
  }
  return items;
}

const PRODUCT_INDEX = buildProductIndex();

export function MobileSearchView({
  query = "",
  onQueryChange,
  onNavigateProduct,
  onSelectJournalPost,
  onScrollTo,
  user,
  onAvatarTap,
}) {
  const scrollRef = useRef(null);
  // Keyboard height so the results' bottom padding clears both the
  // floating search bar AND the keyboard — the last row stays
  // reachable while typing.
  const kbOffset = useKeyboardOffset(true);

  // Snap results back to the top whenever the query changes so the
  // first match is always immediately visible — the core fix.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [query]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;

    const matches = [];
    for (const p of PRODUCT_INDEX) {
      if (p._search.includes(q)) matches.push(p);
    }
    for (const post of JOURNAL_POSTS) {
      const corpus = [post.title, post.excerpt].join(" ").toLowerCase();
      if (corpus.includes(q)) {
        matches.push({ type: "journal", title: post.title, excerpt: post.excerpt, slug: post.slug });
      }
    }
    for (const section of SITE_SECTIONS) {
      if (section.label.toLowerCase().includes(q)) matches.push(section);
    }
    if ("refund".includes(q) || "final sale".includes(q) || q.includes("refund") || q.includes("final sale")) {
      const hasFaq = matches.some((m) => m.type === "section" && m.id === "faq");
      if (!hasFaq) matches.push({ label: "FAQ", id: "faq", type: "section" });
    }
    return matches;
  }, [query]);

  const handleSuggestion = (text) => onQueryChange?.(text);

  const handleResultTap = (result) => {
    if (result.type === "product") onNavigateProduct(result.categorySlug, result.productSlug);
    else if (result.type === "journal") onSelectJournalPost(result.slug);
    else if (result.type === "section") onScrollTo(result.id);
  };

  const showSuggestions = !query.trim();
  const noResults = results && results.length === 0;

  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.charAt(0).toUpperCase()
    : user?.email
      ? user.email.charAt(0).toUpperCase()
      : null;

  return (
    <div
      className="lg:hidden"
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--bg-page)",
        zIndex: 20,                 // below the bottom-nav search bar (z-30)
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Title row — matches the other mobile pages' header. */}
      <div
        className="flex items-start justify-between"
        style={{ padding: "56px 24px 14px", flexShrink: 0 }}
      >
        <h1
          className="font-display leading-tight"
          style={{ fontSize: "2.1rem", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-primary)" }}
        >
          Search
        </h1>
        {onAvatarTap && (
          <button
            type="button"
            onClick={onAvatarTap}
            className="flex-shrink-0 flex items-center justify-center"
            style={{
              width: 36, height: 36, borderRadius: "50%", marginTop: 4,
              background: initials ? "var(--ink)" : "rgba(26,22,18,0.08)",
              color: initials ? "var(--text-on-ink)" : "var(--text-muted)",
              fontFamily: "Fraunces, Georgia, serif", fontSize: "0.85rem", fontWeight: 600,
            }}
            aria-label="Your account"
          >
            {initials || <User size={18} strokeWidth={1.5} />}
          </button>
        )}
      </div>

      {/* Scrollable list — anchored to the top, padded at the bottom
          so the last row clears the floating search bar + keyboard. */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        style={{
          padding: "0 24px",
          // Clear the floating search bar (~90px) plus the keyboard
          // when it's open, so the last result is always reachable.
          paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${90 + kbOffset}px)`,
        }}
      >
        {showSuggestions && (
          <div>
            <p className="text-xs tracking-[0.2em] uppercase mb-2" style={{ color: "var(--text-muted)", fontWeight: 500 }}>
              Try searching
            </p>
            <div className="flex flex-col">
              {SUGGESTIONS.map((text) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => handleSuggestion(text)}
                  className="flex items-center gap-3 py-3.5 text-left border-b"
                  style={{ borderColor: "var(--border-soft)" }}
                >
                  <Search size={15} strokeWidth={1.4} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                  <span className="text-sm" style={{ color: "var(--text-primary)" }}>{text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {noResults && (
          <div className="text-center py-12">
            <p className="text-sm opacity-60 mb-1">No results for &ldquo;{query.trim()}&rdquo;</p>
            <p className="text-xs opacity-40">Try a different search, or browse the shop.</p>
          </div>
        )}

        {results && results.length > 0 && (
          <div className="flex flex-col">
            {results.map((r, i) => (
              <button
                key={`${r.type}-${r.slug || r.id || r.productSlug || i}`}
                type="button"
                onClick={() => handleResultTap(r)}
                className="flex items-center gap-3 py-3.5 text-left border-b"
                style={{ borderColor: "var(--border-soft)" }}
              >
                <div className="flex-1 min-w-0">
                  {r.type === "product" && (
                    <>
                      <p className="text-sm font-display truncate" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{r.name}</p>
                      <p className="text-xs opacity-60 truncate mt-0.5">{r.tagline}</p>
                      {r.priceFrom != null && (
                        <p className="text-xs mt-0.5" style={{ color: "var(--accent)", fontWeight: 500 }}>From ${r.priceFrom}</p>
                      )}
                      {r.status === "placeholder" && !r.priceFrom && (
                        <p className="text-xs mt-0.5 opacity-50 italic">Coming soon</p>
                      )}
                    </>
                  )}
                  {r.type === "journal" && (
                    <>
                      <p className="text-sm font-display truncate" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{r.title}</p>
                      <p className="text-xs opacity-60 truncate mt-0.5">{r.excerpt}</p>
                      <p className="text-xs mt-0.5 opacity-40 italic">Journal</p>
                    </>
                  )}
                  {r.type === "section" && (
                    <>
                      <p className="text-sm font-display" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{r.label}</p>
                      <p className="text-xs opacity-40 italic mt-0.5">Site section</p>
                    </>
                  )}
                </div>
                <ChevronRight size={16} strokeWidth={1.4} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
