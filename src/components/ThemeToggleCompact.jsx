"use client";

// ============================================================
// ThemeToggleCompact — single-tap light/dark pill for the header
// ============================================================
// The footer ThemeToggle is a 3-way segmented control (Light /
// Auto / Dark). For the mobile header we want the Asbarez-style
// one-tap switch: a small pill showing the icon of the mode you'd
// switch TO. Tapping flips between explicit light and dark. (The
// "system/auto" preference is still available in the footer; this
// is the quick toggle.)
// ============================================================

import React, { useState, useEffect } from "react";
import { Sun, Moon } from "./icons.jsx";
import { useTheme } from "../lib/useTheme.js";

export function ThemeToggleCompact() {
  const [pref, setTheme] = useTheme();
  // SSR-safe: useTheme reads the stored preference on the client (e.g. "dark")
  // while the server always renders "system", and the resolved-dark check below
  // reads matchMedia — both differ from the server, which would mismatch the
  // toggle's position/aria-label on hydration (React #418). Render the stable
  // default (light) until mounted, then resolve the real theme.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark =
    mounted &&
    (pref === "dark" ||
      (pref === "system" &&
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-color-scheme: dark)").matches));

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        width: 52,
        height: 30,
        borderRadius: 999,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: isDark ? "flex-end" : "flex-start",
        padding: 3,
        background: "rgba(26,22,18,0.06)",
        border: "1px solid rgba(26,22,18,0.10)",
        cursor: "pointer",
        transition: "background 0.2s ease",
      }}
    >
      {/* The "knob" slides to the side matching the current mode,
          carrying the icon of the CURRENT mode (sun = light is on,
          moon = dark is on). */}
      <span
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: "var(--bg-surface, #FFFBF3)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 1px 3px rgba(26,22,18,0.18)",
          color: isDark ? "#C9A678" : "#B08842",
        }}
      >
        {isDark ? <Moon size={14} strokeWidth={1.75} /> : <Sun size={14} strokeWidth={1.75} />}
      </span>
    </button>
  );
}
