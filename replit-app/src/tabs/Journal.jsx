// ============================================================
// Journal — Lusik's mini-blog (Chunk 7)
// ============================================================
// The JS sibling of ios/LusikSons/Views/JournalView.swift (itself the
// native sibling of the website's mobile journal): the editorial card
// list ("Read something new" — gold-wash cover bands carrying the
// title, since posts have no per-post art) and the single-post page
// rendering the typed content nodes (p / h2 / blockquote) with the
// "Keep reading" aside. Routes: #/journal, #/journal/<slug>.
// Post data is generated from the same markdown files the website
// compiles (scripts/gen-journal.mjs).

import React, { useEffect } from "react";
import { JOURNAL_POSTS } from "../data/journalPosts.js";
import { useHashRoute } from "../lib/useHashRoute.js";

// "May 17, 2026" — local-time parse so a YYYY-MM-DD string never
// shifts a day via UTC (web formatPublishedDate parity).
function formatDate(iso) {
  const [y, m, d] = (iso || "").split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function Journal() {
  const { segments, navigate, back } = useHashRoute();
  const slug = segments[1] ?? null;
  const post = slug ? JOURNAL_POSTS.find((p) => p.slug === slug) : null;

  // New post (or list↔post) = read from the top. The scroller is the
  // tab surface, not the window.
  useEffect(() => {
    document.querySelector(".tab-surface:not([hidden])")?.scrollTo({ top: 0, behavior: "instant" });
  }, [slug]);

  if (post) return <JournalPost post={post} onBack={back} onOpen={(s) => navigate(`journal/${s}`)} />;
  return <JournalList onOpen={(s) => navigate(`journal/${s}`)} />;
}

function JournalList({ onOpen }) {
  return (
    <div className="journal-page">
      <h1 className="page-title">Journal</h1>
      <p className="journal-lead">Read something new</p>
      <div className="journal-cards">
        {JOURNAL_POSTS.map((post) => (
          <button
            key={post.slug}
            type="button"
            className="journal-card"
            onClick={() => onOpen(post.slug)}
            aria-label={`${post.title} — ${post.readMinutes} minute read`}
          >
            <span className="journal-card-band">
              <span className="journal-eyebrow">Journal</span>
              <span className="journal-card-title brand-display">{post.title}</span>
            </span>
            <span className="journal-card-body">
              <span className="journal-card-excerpt">{post.excerpt}</span>
              <span className="journal-card-meta">
                {post.readMinutes} min read · {formatDate(post.publishedAt)}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function JournalPost({ post, onBack, onOpen }) {
  // The two other most-recent posts (the list is newest-first).
  const others = JOURNAL_POSTS.filter((p) => p.slug !== post.slug).slice(0, 2);

  return (
    <article className="journal-post readable">
      <button type="button" className="back-link" onClick={onBack} aria-label="All posts">
        ‹ All posts
      </button>

      <header className="journal-post-head">
        <p className="journal-post-meta">
          <span className="journal-eyebrow">Journal</span>
          <span aria-hidden="true"> · </span>
          {formatDate(post.publishedAt)}
          <span aria-hidden="true"> · </span>
          {post.readMinutes} min read
        </p>
        <h1 className="journal-post-title brand-display">{post.title}</h1>
      </header>

      <div className="journal-post-body">
        {post.content.map((node, i) => {
          if (node.type === "h2") {
            return <h2 key={i} className="journal-h2 brand-display">{node.text}</h2>;
          }
          if (node.type === "blockquote") {
            return <blockquote key={i} className="journal-quote brand-display">{node.text}</blockquote>;
          }
          return <p key={i} className="journal-p">{node.text}</p>;
        })}
      </div>

      {others.length > 0 && (
        <aside className="journal-keep">
          <p className="journal-eyebrow">Keep reading</p>
          {others.map((p) => (
            <button key={p.slug} type="button" className="journal-keep-card" onClick={() => onOpen(p.slug)}>
              <span className="journal-keep-date">{formatDate(p.publishedAt)}</span>
              <span className="journal-keep-title brand-display">{p.title}</span>
              <span className="journal-keep-excerpt">{p.excerpt}</span>
            </button>
          ))}
        </aside>
      )}
    </article>
  );
}
