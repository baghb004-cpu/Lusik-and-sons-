// ============================================================
// Skeleton — generic loading-shimmer block
// ============================================================
// Used by OrderHistory + SavedDesignsSection during async loads.
// The CSS keyframes for `skeleton-shimmer` live in the global
// stylesheet (currently the <style> block in index.html;
// migrates to src/styles/index.css in Phase 10).
//
// MIRRORED FROM index.html (~line 7761).
// ============================================================

import React from "react";

export function Skeleton({ className = "", style = {} }) {
  return (
    <div
      className={`skeleton-shimmer ${className}`}
      style={{
        background: "linear-gradient(90deg, rgba(26,22,18,0.06) 0%, rgba(26,22,18,0.10) 50%, rgba(26,22,18,0.06) 100%)",
        backgroundSize: "200% 100%",
        ...style,
      }}
      aria-hidden="true"
    />
  );
}
