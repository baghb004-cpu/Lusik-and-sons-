// ============================================================
// useHashRoute — the routing decision (Chunk 1)
// ============================================================
// Hash-based routes, no router dependency: `#/products/bibs/hy-em-
// armenian-bib`. Hashes give real back-button + shareable URLs on
// any static host (Replit serves one HTML file) while the app keeps
// the iOS tab model: the first segment is the tab, the rest is that
// tab's own stack. App.jsx remembers each tab's last path so
// switching tabs preserves per-tab navigation state (RootTabView's
// kept-alive stacks).

import { useCallback, useSyncExternalStore } from "react";

function parse() {
  const raw = window.location.hash.replace(/^#\/?/, "");
  return raw ? raw.split("/").map(decodeURIComponent).filter(Boolean) : [];
}

function subscribe(onChange) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

// Cache the snapshot by hash string — useSyncExternalStore wants
// referentially stable snapshots for unchanged state.
let lastHash = null;
let lastSegments = [];
function getSnapshot() {
  const h = window.location.hash;
  if (h !== lastHash) {
    lastHash = h;
    lastSegments = parse();
  }
  return lastSegments;
}

export function useHashRoute() {
  const segments = useSyncExternalStore(subscribe, getSnapshot, () => []);

  const navigate = useCallback((path) => {
    window.location.hash = "#/" + path.replace(/^#?\/?/, "");
  }, []);

  const back = useCallback(() => window.history.back(), []);

  return { segments, navigate, back };
}
