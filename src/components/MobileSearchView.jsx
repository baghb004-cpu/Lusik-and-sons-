// ============================================================
// MobileSearchView — client-side search for the mobile 5th tab
// ============================================================
// Searches across products (CATALOG), journal posts, and site
// sections. Renders only on mobile (lg:hidden wrapper). The
// large "Search" title comes from MobilePageHeader in App — this
// component owns the input + results only.
//
// When the input is empty, shows suggested searches as tappable
// rows (Apple-style). Each suggestion pre-fills the input and
// runs the search so the customer gets instant results.
//
// The search is pure client-side string matching — no server
// call, no debounce needed, runs on every keystroke. The corpus
// is small enough (< 50 items) that this stays fast.
// ============================================================

import React, { useState, useMemo, useRef, useEffect } from "react";
import { CATALOG } from "../data/catalog.js";
import { JOURNAL_POSTS } from "../data/journalPosts.js";
import { Search, ChevronRight } from "./icons.jsx";

// Site sections that should be findable via search. Each maps
// to a scrollTo target or a view change in App.
const SITE_SECTIONS = [
  { label: "FAQ",               id: "faq",      type: "section" },
  { label: "Shipping & Returns", id: "shipping", type: "section" },
  { label: "Contact Us",        id: "contact",  type: "section" },
  { label: "Our Story",         id: "story",    type: "section" },
];

const SUGGESTIONS = [
  "Armenian alphabet blanket",
  "Baptism towel",
  "Bari akhorzhak",
  "Cotton blanket",
  "Shipping",
  "Refund policy",
];

// Flatten the catalog into a searchable list once at module level.
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
        // Searchable corpus — lowercased, joined so one indexOf
        // call covers all fields.
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

export function MobileSearchView({ onNavigateProduct, onSelectJournalPost, onScrollTo }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);

  // Auto-focus the input when the view mounts so the customer can
  // start typing immediately. Mobile keyboards open automatically.
  useEffect(() => {
    // Small delay lets the page-enter animation finish before the
    // keyboard rises — avoids a visual jank where the animation
    // and the keyboard fight for layout space.
    const t = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;

    const matches = [];

    // Search products
    for (const p of PRODUCT_INDEX) {
      if (p._search.includes(q)) {
        matches.push(p);
      }
    }

    // Search journal posts
    for (const post of JOURNAL_POSTS) {
      const corpus = [post.title, post.excerpt].join(" ").toLowerCase();
      if (corpus.includes(q)) {
        matches.push({
          type: "journal",
          title: post.title,
          excerpt: post.excerpt,
          slug: post.slug,
        });
      }
    }

    // Search site sections
    for (const section of SITE_SECTIONS) {
      if (section.label.toLowerCase().includes(q)) {
        matches.push(section);
      }
    }

    // Also match "refund" → Final Sale Policy section
    if ("refund".includes(q) || "final sale".includes(q) || q.includes("refund") || q.includes("final sale")) {
      const alreadyHasFaq = matches.some((m) => m.type === "section" && m.id === "faq");
      if (!alreadyHasFaq) {
        matches.push({ label: "FAQ", id: "faq", type: "section" });
      }
    }

    return matches;
  }, [query]);

  const handleSuggestion = (text) => {
    setQuery(text);
  };

  const handleResultTap = (result) => {
    if (result.type === "product") {
      onNavigateProduct(result.categorySlug, result.productSlug);
    } else if (result.type === "journal") {
      onSelectJournalPost(result.slug);
    } else if (result.type === "section") {
      onScrollTo(result.id);
    }
  };

  const showSuggestions = !query.trim();
  const noResults = results && results.length === 0;

  return (
    <div className="lg:hidden px-6 pb-32">
      {/* Search input — pill shape, brand palette */}
      <div className="relative mb-6">
        <span
          className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: "var(--text-muted)" }}
        >
          <Search size={18} strokeWidth={1.5} />
        </span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="What are you looking for?"
          className="mobile-search-input"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100"
            aria-label="Clear search"
            style={{ color: "var(--text-primary)" }}
          >
            <span style={{ fontSize: "1.1rem", fontWeight: 300 }}>&times;</span>
          </button>
        )}
      </div>

      {/* Suggestions when input is empty */}
      {showSuggestions && (
        <div>
          <p
            className="text-xs tracking-[0.2em] uppercase mb-4"
            style={{ color: "var(--text-muted)", fontWeight: 500 }}
          >
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
                <Search
                  size={15}
                  strokeWidth={1.4}
                  style={{ color: "var(--text-muted)", flexShrink: 0 }}
                />
                <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                  {text}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No results */}
      {noResults && (
        <div className="text-center py-12">
          <p className="text-sm opacity-60 mb-1">
            No results for &ldquo;{query.trim()}&rdquo;
          </p>
          <p className="text-xs opacity-40">
            Try a different search, or browse the shop.
          </p>
        </div>
      )}

      {/* Results list */}
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
                    <p className="text-sm font-display truncate" style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                      {r.name}
                    </p>
                    <p className="text-xs opacity-60 truncate mt-0.5">
                      {r.tagline}
                    </p>
                    {r.priceFrom != null && (
                      <p className="text-xs mt-0.5" style={{ color: "var(--accent)", fontWeight: 500 }}>
                        From ${r.priceFrom}
                      </p>
                    )}
                    {r.status === "placeholder" && !r.priceFrom && (
                      <p className="text-xs mt-0.5 opacity-50 italic">Coming soon</p>
                    )}
                  </>
                )}
                {r.type === "journal" && (
                  <>
                    <p className="text-sm font-display truncate" style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                      {r.title}
                    </p>
                    <p className="text-xs opacity-60 truncate mt-0.5">
                      {r.excerpt}
                    </p>
                    <p className="text-xs mt-0.5 opacity-40 italic">Journal</p>
                  </>
                )}
                {r.type === "section" && (
                  <>
                    <p className="text-sm font-display" style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                      {r.label}
                    </p>
                    <p className="text-xs opacity-40 italic mt-0.5">Site section</p>
                  </>
                )}
              </div>
              <ChevronRight
                size={16}
                strokeWidth={1.4}
                style={{ color: "var(--text-muted)", flexShrink: 0 }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
