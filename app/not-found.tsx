// Custom 404 — branded "page not found" rendered inside the site chrome
// (nav + footer come from app/layout.tsx). Server component; noindex so the
// 404 never lands in search results.
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    // Plain <div> (not <main>): this renders inside SiteChrome's <main>, so a
    // <main> here would create a nested/duplicate landmark.
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "4rem 1.5rem",
        color: "var(--text-primary)",
      }}
    >
      <p
        style={{
          fontSize: "0.7rem",
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          color: "var(--accent)",
          marginBottom: "1rem",
        }}
      >
        Error 404
      </p>
      <h1
        className="font-display"
        style={{ fontSize: "2rem", fontWeight: 400, lineHeight: 1.15, marginBottom: "0.75rem" }}
      >
        This page wandered off
      </h1>
      <p style={{ maxWidth: "26rem", color: "var(--text-muted)", lineHeight: 1.6, marginBottom: "2rem" }}>
        The page you&rsquo;re looking for isn&rsquo;t here &mdash; it may have moved, or the link
        was mistyped. Let&rsquo;s get you back to something handmade.
      </p>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
        <Link
          href="/"
          style={{
            padding: "0.75rem 1.5rem",
            background: "var(--ink)",
            color: "var(--text-on-ink)",
            fontSize: "0.85rem",
            letterSpacing: "0.05em",
          }}
        >
          Back home
        </Link>
        <Link
          href="/shop"
          style={{
            padding: "0.75rem 1.5rem",
            border: "1px solid var(--border-strong)",
            color: "var(--text-primary)",
            fontSize: "0.85rem",
            letterSpacing: "0.05em",
          }}
        >
          Browse the shop
        </Link>
      </div>
    </div>
  );
}
