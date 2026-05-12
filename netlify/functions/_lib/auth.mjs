// ============================================================
// Auth helpers for Netlify Functions
// ============================================================
// Netlify Identity injects the verified user onto the Function's
// `context.clientContext.user` field when the request carries a
// valid `Authorization: Bearer <identity-jwt>` header. We don't
// have to verify the JWT ourselves — Netlify's runtime already did.
//
// `requireUser` is the single chokepoint every authenticated
// endpoint uses. It returns either { user } on success or
// { response } on failure (a 401 to return immediately).
// ============================================================

import { json } from "./json.mjs";

/**
 * Extract the authenticated Identity user from a Functions request.
 * Returns { user } on success, or { response } with a 401 to return.
 *
 * Shape of `user`:
 *   { id: string (UUID), email: string, user_metadata: {...}, ... }
 */
export function requireUser(context) {
  const user = context?.clientContext?.user;
  if (!user || !user.sub) {
    return {
      response: json(401, {
        error: "Not signed in",
        hint: "Send the Netlify Identity JWT as Authorization: Bearer <token>",
      }),
    };
  }
  // Identity uses `sub` as the UUID. Normalize to `id` so callers don't
  // have to remember which field to read.
  return {
    user: {
      id: user.sub,
      email: user.email ?? null,
      fullName: user.user_metadata?.full_name ?? null,
      phone: user.user_metadata?.phone ?? null,
      raw: user,
    },
  };
}
