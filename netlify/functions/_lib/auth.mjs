// netlify/functions/_lib/auth.mjs
// ============================================================
// Auth helpers for Netlify Functions v2.
//
// The user is read ONLY from context.clientContext.user, which Netlify's
// edge injects AFTER it has verified the Identity (GoTrue) JWT's
// signature, issuer, and audience. If clientContext.user is absent, the
// caller is treated as unauthenticated — full stop.
//
// We deliberately do NOT fall back to decoding the Authorization: Bearer
// token ourselves. A manual base64 decode does not verify the signature,
// so a forged token (e.g. one minting app_metadata.roles:["admin"]) would
// otherwise be trusted. Trusting only the edge-verified clientContext.user
// closes that hole. (Production was confirmed to reject forged/absent
// tokens with 401 before this fallback was removed.)
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
  // ONLY the Netlify-edge-verified user is trusted. No manual token
  // decoding — an unverified decode would trust forged claims (incl.
  // app_metadata.roles:["admin"]). Absent clientContext.user == not
  // signed in.
  const { context } = normalizeArgs(a, b);
  const cu = context?.clientContext?.user;
  if (cu && (cu.email || cu.sub)) return cu;
  return null;
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
