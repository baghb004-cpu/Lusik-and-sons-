// ============================================================
// recentActivity — device-local "recently viewed" + "recent searches"
// ============================================================
// A tiny localStorage-backed memory for the GUEST'S OWN browser.
// No server, no account, nothing leaves the device — this is the
// same model the Apple Store app uses for its Search page (Recently
// Viewed strip + Recent Searches list) and For You page.
//
// Everything is wrapped in try/catch because localStorage throws in
// Safari Private Mode and when storage is full or disabled. A failure
// to read/write the history must NEVER break the page, so every getter
// falls back to [] and every writer silently no-ops on error.
//
// Storage is read on demand (no in-memory cache) — the lists are tiny
// (≤10 / ≤6 entries) and these run on navigation, not in a hot loop.
//
// Keys are versioned (`_v1`) so the shape can change later without
// colliding with stale entries from an older deploy.
// ============================================================

const VIEWED_KEY = "lusik_recently_viewed_v1";
const SEARCHES_KEY = "lusik_recent_searches_v1";

const VIEWED_CAP = 10;
const SEARCHES_CAP = 6;
const MIN_SEARCH_LEN = 2;

// --- low-level safe storage helpers -------------------------------

function readList(key) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeList(key, list) {
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // Private mode / quota exceeded / storage disabled — ignore.
  }
}

function removeKey(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// --- recently viewed ----------------------------------------------

// Prepend a product to the recently-viewed list. Dedupe by slug
// (a re-view moves the entry to the front), cap at 10, newest first.
// Missing slug → no-op (we can't dedupe or link without it).
export function recordProductView({ slug, categorySlug, name, image } = {}) {
  if (!slug) return;
  try {
    const existing = readList(VIEWED_KEY).filter(
      (item) => item && item.slug !== slug,
    );
    const entry = { slug, categorySlug, name };
    if (image) entry.image = image;
    const next = [entry, ...existing].slice(0, VIEWED_CAP);
    writeList(VIEWED_KEY, next);
  } catch {
    // ignore
  }
}

export function getRecentlyViewed() {
  return readList(VIEWED_KEY).filter((item) => item && item.slug);
}

export function clearRecentlyViewed() {
  removeKey(VIEWED_KEY);
}

// --- recent searches ----------------------------------------------

// Prepend a search term. Trim, ignore empty / too-short queries,
// dedupe case-insensitively (keeping the newest casing), cap at 6.
export function recordSearch(query) {
  if (typeof query !== "string") return;
  const trimmed = query.trim();
  if (trimmed.length < MIN_SEARCH_LEN) return;
  try {
    const lower = trimmed.toLowerCase();
    const existing = readList(SEARCHES_KEY).filter(
      (term) => typeof term === "string" && term.toLowerCase() !== lower,
    );
    const next = [trimmed, ...existing].slice(0, SEARCHES_CAP);
    writeList(SEARCHES_KEY, next);
  } catch {
    // ignore
  }
}

export function getRecentSearches() {
  return readList(SEARCHES_KEY).filter((term) => typeof term === "string");
}

export function clearRecentSearches() {
  removeKey(SEARCHES_KEY);
}
