// useTheme — persists a "light" / "dark" / "system" preference to
// localStorage and applies `data-theme="dark"` to <html> when the
// resolved theme is dark. The CSS variables in src/styles/index.css
// key off that attribute. "system" follows prefers-color-scheme and
// re-resolves when the OS preference changes.

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "lusik_theme_v1";
const VALID = new Set(["light", "dark", "system"]);

function readStored() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return VALID.has(v) ? v : "system";
  } catch {
    return "system";
  }
}

function applyTheme(pref) {
  const root = document.documentElement;
  const resolved =
    pref === "system"
      ? window.matchMedia?.("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : pref;
  if (resolved === "dark") root.setAttribute("data-theme", "dark");
  else root.removeAttribute("data-theme");
}

export function useTheme() {
  const [pref, setPref] = useState(() => (typeof window === "undefined" ? "system" : readStored()));

  useEffect(() => {
    applyTheme(pref);
    try {
      localStorage.setItem(STORAGE_KEY, pref);
    } catch {}
  }, [pref]);

  useEffect(() => {
    if (pref !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [pref]);

  const setTheme = useCallback((next) => {
    if (VALID.has(next)) setPref(next);
  }, []);

  return [pref, setTheme];
}
