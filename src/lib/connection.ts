// ============================================================
// connection — shared guard for speculative route prefetching
// ============================================================
// Centralizes the Save-Data / slow-link check so every prefetch path
// (the idle main-nav warm in SiteChrome AND the intent-based card
// prefetch) behaves identically: never speculatively fetch on a
// data-saver setting or a slow connection (2g/3g), where it would
// steal bandwidth from the page the visitor actually wants. Prefetch
// is always best-effort — navigation still works via router.push when
// this returns false.

export function prefetchAllowed(): boolean {
  // No navigator on the server; prefetch is a client-only optimization.
  if (typeof navigator === "undefined") return false;
  // `navigator.connection` is non-standard (absent in Safari/Firefox) —
  // when it's missing we proceed, matching the prior main-nav behavior.
  const conn = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (conn && (conn.saveData || /(^|-)2g$|^3g$/.test(conn.effectiveType || ""))) return false;
  return true;
}
