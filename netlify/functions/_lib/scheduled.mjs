// ============================================================
// Scheduled-function HTTP gate
// ============================================================
// Netlify scheduled functions live at /.netlify/functions/<name>
// just like every other function — they're reachable over HTTP by
// anyone unless the handler checks the caller.
//
// This module exports `isScheduledInvocation(req)` — call it as
// the first line of any scheduled-function handler. Returns true
// when the request came from one of two trusted sources:
//
//   1. Netlify's internal scheduler.  Netlify's scheduler POSTs a
//      JSON body containing a `next_run` ISO timestamp. An attacker
//      can of course forge a body, but they cannot forge it from
//      inside Netlify's network — the request still arrives at our
//      function with no Netlify edge-only headers, but the body
//      shape is good signal-of-intent.
//
//   2. An operator manually triggering via curl with a Bearer
//      token matching SCHEDULED_FN_SECRET. Use this for one-off
//      catch-up runs, debugging, etc.
//
// Any other request gets a 403 response (via `forbidden()` below).
//
// Required env var (set in Netlify dashboard → Site → Environment):
//
//   SCHEDULED_FN_SECRET   long random string. Rotate by changing
//                         the env var; outstanding manual-trigger
//                         shells stop working immediately. NOT
//                         required for Netlify's own scheduler to
//                         invoke the function — the scheduler is
//                         trusted by the next_run-body check above.
//                         Without this var set, manual triggering
//                         is disabled entirely (the schedule itself
//                         still works).
// ============================================================

export async function isScheduledInvocation(req) {
  if (!req || req.method !== "POST") return false;

  // Path 1: Netlify scheduler. Body is JSON `{ next_run: "..." }`.
  // We clone the request so the caller can still read the body
  // (Request bodies are single-shot streams).
  try {
    const clone = req.clone();
    const body = await clone.json();
    if (body && typeof body.next_run === "string" && body.next_run.length > 0) {
      return true;
    }
  } catch {
    // Body wasn't JSON or wasn't readable — fall through to the
    // secret check; might be a manual curl with no body.
  }

  // Path 2: Operator manual trigger. Compare in constant time so a
  // timing oracle can't reveal the secret one byte at a time.
  const expected = process.env.SCHEDULED_FN_SECRET;
  if (!expected || expected.length < 16) return false;
  const authz = req.headers.get("authorization") || "";
  const presented = authz.startsWith("Bearer ") ? authz.slice(7) : "";
  if (presented.length === 0) return false;
  return timingSafeEqualStr(presented, expected);
}

export function forbidden() {
  return new Response("forbidden", {
    status: 403,
    headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
  });
}

// Length-padded constant-time string compare. Returns false fast
// for mismatched lengths (acceptable leak — Bearer length isn't
// the secret).
function timingSafeEqualStr(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
