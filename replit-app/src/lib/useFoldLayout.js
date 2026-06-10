// ============================================================
// useFoldLayout — "the open book", the JS mirror of FoldLayout.swift
// ============================================================
// Written ahead of the book-style iPhone Fold (7.8" 4:3 inner display,
// 5.5" cover screen, horizontal fold, passport-like form factor):
//
//   • expanded = the unfolded 4:3 canvas (or any tablet-width window):
//     two-page product spreads, multi-column grids, readable columns,
//     the island stays a centered pill.
//   • compact  = phones and the Fold's 5.5" cover screen: the
//     pill-sheet, single-column app.
//
// 700px ≈ the unfolded canvas in CSS pixels; the viewport-segments
// query catches browsers that report fold posture directly. Keep this
// in lockstep with the media query in styles/app.css.

import { useSyncExternalStore } from "react";

const QUERY = "(min-width: 700px), (horizontal-viewport-segments: 2)";

function subscribe(onChange) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

export function useFoldLayout() {
  const expanded = useSyncExternalStore(subscribe, getSnapshot, () => false);
  return { expanded, compact: !expanded };
}
