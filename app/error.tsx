"use client";

// Custom error boundary for route segments — branded fallback shown when a
// render throws, with a "try again" reset and a path back home. Client
// component (required for error.tsx). Reports to Sentry if it's been wired
// (NEXT_PUBLIC_SENTRY_DSN set); otherwise it's a silent no-op.
import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      import("../src/lib/errorReporting")
        .then(({ Sentry }) => Sentry?.captureException?.(error))
        .catch(() => {
          /* monitoring unavailable — never block the fallback UI */
        });
    }
  }, [error]);

  return (
    <main
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
        Something went wrong
      </p>
      <h1
        className="font-display"
        style={{ fontSize: "2rem", fontWeight: 400, lineHeight: 1.15, marginBottom: "0.75rem" }}
      >
        A stitch slipped on our end
      </h1>
      <p style={{ maxWidth: "26rem", color: "var(--text-muted)", lineHeight: 1.6, marginBottom: "2rem" }}>
        This page hit an unexpected error. Trying again usually sorts it &mdash; if it keeps
        happening, you can always reach Lusik directly from the contact page.
      </p>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            padding: "0.75rem 1.5rem",
            background: "var(--ink)",
            color: "var(--text-on-ink)",
            fontSize: "0.85rem",
            letterSpacing: "0.05em",
            border: "none",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
        <Link
          href="/"
          style={{
            padding: "0.75rem 1.5rem",
            border: "1px solid var(--border-strong)",
            color: "var(--text-primary)",
            fontSize: "0.85rem",
            letterSpacing: "0.05em",
          }}
        >
          Back home
        </Link>
      </div>
    </main>
  );
}
