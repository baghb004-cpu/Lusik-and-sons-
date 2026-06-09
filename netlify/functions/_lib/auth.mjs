// netlify/functions/_lib/auth.mjs
// ============================================================
// Auth helpers for Netlify Functions v2.
//
// Identity resolution, in order:
//   1) context.clientContext.user — injected by Netlify's edge ONLY
//      after it has verified the Identity JWT's signature. Trusted as-is.
//   2) Fallback: a raw `Authorization: Bearer <jwt>` header. This path
//      exists because the v2 functions runtime does not always inject
//      clientContext.user even for valid tokens. We DO NOT trust the
//      token by decoding it — a decoded payload proves nothing about
//      authenticity (anyone can mint a JWT with arbitrary `sub` and
//      `app_metadata.roles`). Instead we verify the token against GoTrue
//      (the Identity issuer) via its /user endpoint and use the
//      authoritative response. A forged/unsigned/expired token gets a
//      401 from GoTrue and is rejected here.
//
// Because step 2 makes a network call, requireUser/requireAdmin are
// ASYNC and callers must `await` them. They fail CLOSED: if the issuer
// can't be reached, the request is treated as unauthenticated.
//
// Admin gate (isAdmin) uses BOTH:
//   - app_metadata.roles (case-insensitive match for "admin")
//   - ADMIN_EMAILS env var (comma-separated, case-insensitive on email)
//
// Returns { user } on success or { response } with a 401/403 Response on
// failure. Callers can pass EITHER (context) OR (req, context) ― both
// signatures are supported for backward compatibility.
//
// The returned user object has a stable shape used throughout the app:
//   { id, email, fullName, phone, roles, _raw }
// where _raw is the underlying GoTrue user payload (provided for
// advanced callers; consider this internal).
// ============================================================

// How long to wait on the GoTrue verification call before failing closed.
// Only hit on the fallback path (when clientContext.user is absent).
const AUTH_VERIFY_TIMEOUT_MS = 5000;

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function unauthorized() {
  return {
    response: jsonResponse(
      {
        error: "Not signed in",
        hint: "Send the Netlify Identity JWT as Authorization: Bearer <token>",
      },
      401
    ),
  };
}

function forbidden() {
  return {
    response: jsonResponse(
      { error: "Forbidden", hint: "Admin access required" },
      403
    ),
  };
}

function normalizeArgs(a, b) {
  const aIsReq = !!(a && typeof a.headers?.get === "function");
  if (aIsReq) return { req: a, context: b };
  return { req: null, context: a };
}

// Resolve the GoTrue (Netlify Identity) API base URL. Netlify hands it
// to functions in clientContext.identity.url; fall back to the site's
// Identity path derived from the deploy URL.
function identityBaseUrl(context) {
  const fromCtx = context?.clientContext?.identity?.url;
  if (fromCtx) return fromCtx;
  const site = process.env.URL || process.env.DEPLOY_PRIME_URL;
  return site ? `${site}/.netlify/identity` : null;
}

// Verify a bearer token by asking the issuer who it belongs to. Returns
// a JWT-payload-shaped object ({ sub, email, app_metadata, user_metadata })
// on success, or null on ANY failure (invalid/forged/expired token, no
// reachable endpoint, network error, timeout). Fails closed.
async function verifyTokenViaIdentity(token, context) {
  const base = identityBaseUrl(context);
  if (!base) return null;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), AUTH_VERIFY_TIMEOUT_MS);
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/user`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ac.signal,
    });
    if (!res.ok) return null; // 401/403 → GoTrue rejected the token
    const u = await res.json();
    if (!u || !u.id) return null;
    // GoTrue's /user returns { id, email, app_metadata, user_metadata, ... }.
    // Normalize to the JWT-payload shape shapeUser() expects (sub = id).
    return {
      sub: u.id,
      email: u.email,
      app_metadata: u.app_metadata || {},
      user_metadata: u.user_metadata || {},
    };
  } catch {
    return null; // network error or timeout → fail closed
  } finally {
    clearTimeout(timer);
  }
}

async function getRawUserFromAny(a, b) {
  const { req, context } = normalizeArgs(a, b);

  // 1) Edge-verified identity — Netlify only injects this after verifying
  //    the JWT signature, so it's trusted as-is.
  const cu = context?.clientContext?.user;
  if (cu && (cu.email || cu.sub)) return cu;

  // 2) Verified fallback. A bearer token alone is NOT trusted — we must
  //    check it against the issuer before believing any of its claims.
  if (!req) return null;
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authHeader) return null;
  const m = /^bearer\s+(.+)$/i.exec(authHeader.trim());
  if (!m) return null;
  return await verifyTokenViaIdentity(m[1].trim(), context);
}

// Transform the raw GoTrue user (from clientContext or verified token)
// into the application-wide shape. Existing callers and tests assume
// user.id / user.email / user.fullName / user.roles.
function shapeUser(raw) {
  if (!raw) return null;
  return {
    id: raw.sub,
    email: raw.email,
    fullName: raw.user_metadata?.full_name || null,
    phone: raw.user_metadata?.phone || null,
    roles: Array.isArray(raw.app_metadata?.roles) ? raw.app_metadata.roles : [],
    _raw: raw,
  };
}

// Shared admin predicate. Used by requireAdmin AND by any endpoint that
// needs its own "owner-or-admin" branch (e.g. order-photo-get). Keeping
// the role + ADMIN_EMAILS logic in ONE place stops the two from drifting.
export function isAdmin(user) {
  if (!user) return false;
  const adminEmails = String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const email = String(user.email || "").toLowerCase();
  const roles = (user.roles || []).map((r) => String(r).toLowerCase());
  return roles.includes("admin") || (!!email && adminEmails.includes(email));
}

export async function requireUser(a, b) {
  const raw = await getRawUserFromAny(a, b);
  if (!raw) return unauthorized();
  // The user must have a `sub` claim; without it we can't identify them.
  if (!raw.sub) return unauthorized();
  return { user: shapeUser(raw) };
}

export async function requireAdmin(a, b) {
  const result = await requireUser(a, b);
  if (result.response) return result;
  if (!isAdmin(result.user)) return forbidden();
  return { user: result.user };
}
