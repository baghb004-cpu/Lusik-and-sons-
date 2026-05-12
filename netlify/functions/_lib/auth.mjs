// ============================================================
// Auth helpers for Netlify Functions
// ============================================================
// Netlify Identity injects the verified user onto the Function's
// `context.clientContext.user` field when the request carries a
// valid `Authorization: Bearer <identity-jwt>` header. We don't
// have to verify the JWT ourselves — Netlify's runtime already did.
//
// Two chokepoints every authenticated endpoint uses:
//   requireUser   — any signed-in customer
//   requireAdmin  — Lusik and her sons. Granted by the "admin"
//                   role on the Identity user (set once in the
//                   Netlify dashboard: Identity → users → edit →
//                   add role "admin"). Falls back to the
//                   ADMIN_EMAILS env var (comma-separated list)
//                   for environments where role-assignment
//                   hasn't been done yet.
// Both return either { user } on success or { response } with a
// 401/403 to return immediately.
// ============================================================

import { json } from "./json.mjs";

/**
 * Extract the authenticated Identity user from a Functions request.
 * Returns { user } on success, or { response } with a 401 to return.
 *
 * Shape of `user`:
 *   { id, email, fullName, phone, roles, raw }
 */
export function requireUser(context) {
  const u = context?.clientContext?.user;
  if (!u || !u.sub) {
    return {
      response: json(401, {
        error: "Not signed in",
        hint: "Send the Netlify Identity JWT as Authorization: Bearer <token>",
      }),
    };
  }
  return {
    user: {
      id:       u.sub,
      email:    u.email ?? null,
      fullName: u.user_metadata?.full_name ?? null,
      phone:    u.user_metadata?.phone ?? null,
      roles:    Array.isArray(u.app_metadata?.roles) ? u.app_metadata.roles : [],
      raw: u,
    },
  };
}

/**
 * Like requireUser, but additionally enforces the admin role.
 * 401 if not signed in, 403 if signed in but not an admin.
 */
export function requireAdmin(context) {
  const inner = requireUser(context);
  if (inner.response) return inner;
  const { user } = inner;

  if (user.roles.includes("admin")) return { user };

  // Env-var fallback: ADMIN_EMAILS="lusik@example.com,son@example.com"
  // Useful before roles are assigned in the dashboard, or for a
  // single-admin shop that doesn't need full role management.
  const envList = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (user.email && envList.includes(user.email.toLowerCase())) {
    return { user };
  }

  return {
    response: json(403, {
      error: "Admin access required",
      hint: "Ask the site owner to add the 'admin' role to your Identity user.",
    }),
  };
}
