// netlify/functions/_lib/auth.mjs
// ============================================================
// Auth helpers for Netlify Functions v2.
//
// Two ways to read the user (in order):
//   1) context.clientContext.user (auto-injected by Netlify edge from the
//      Authorization: Bearer JWT). This is the preferred path.
//   2) Fallback: parse the Authorization: Bearer JWT directly from
//      req.headers when clientContext.user is missing. Required when
//      callers run on a Netlify runtime that does not auto-inject
//      clientContext.user (observed on @netlify/functions v2.x).
//
// JWT signature verification: the Netlify edge performs JWT signature
// verification against the GoTrue keypair before the request reaches
// this function. Our fallback decodes the payload only and trusts the
// edge for signature/issuer/audience checks. If the request reached us,
// the JWT was valid at the edge.
//
// Admin gate uses BOTH:
//   - ADMIN_EMAILS env var (comma-separated, case-insensitive match on email)
//   - app_metadata.roles (case-insensitive match for "admin")
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

function decodeJwtPayload(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    let payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (payload.length % 4) payload += "=";
    const bin = (typeof atob === "function")
      ? atob(payload)
      : Buffer.from(payload, "base64").toString("binary");
    let utf8 = "";
    try {
      utf8 = decodeURIComponent(
        bin.split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
    } catch {
      utf8 = bin;
    }
    return JSON.parse(utf8);
  } catch {
    return null;
  }
}

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

function getRawUserFromAny(a, b) {
  const { req, context } = normalizeArgs(a, b);
  const cu = context?.clientContext?.user;
  if (cu && (cu.email || cu.sub)) return cu;
  if (!req) return null;
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authHeader) return null;
  const m = /^bearer\s+(.+)$/i.exec(authHeader.trim());
  if (!m) return null;
  const token = m[1].trim();
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  if (payload.exp && Date.now() / 1000 > payload.exp) return null;
  return payload;
}

// Transform the raw GoTrue user (from clientContext or decoded JWT) into
// the application-wide shape. Existing callers and tests assume
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

export function requireUser(a, b) {
  const raw = getRawUserFromAny(a, b);
  if (!raw) return unauthorized();
  // The user must have a `sub` claim; without it we can't identify them.
  if (!raw.sub) return unauthorized();
  return { user: shapeUser(raw) };
}

export function requireAdmin(a, b) {
  const result = requireUser(a, b);
  if (result.response) return result;
  const { user } = result;

  const adminEmails = String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const email = String(user.email || "").toLowerCase();
  const roles = user.roles.map((r) => String(r).toLowerCase());

  const isAdminByEmail = email && adminEmails.includes(email);
  const isAdminByRole = roles.includes("admin");

  if (!isAdminByEmail && !isAdminByRole) return forbidden();
  return { user };
}
