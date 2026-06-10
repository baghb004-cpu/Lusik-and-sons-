// ============================================================
// JSON response helper
// ============================================================
// Every Function returns JSON. Centralize the headers so we don't
// scatter the same boilerplate everywhere.
// ============================================================

export function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      // No CORS headers needed — same-origin: the browser hits
      // /.netlify/functions/* on the same host as the static site.
      // no-store is the right DEFAULT (user-scoped data everywhere);
      // static public endpoints (zip-lookup) override via extraHeaders.
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}
