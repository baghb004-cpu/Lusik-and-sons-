// ============================================================
// /.netlify/functions/account-delete
// ============================================================
// Right to deletion (CCPA/CPRA, GDPR). The customer confirms
// from the account view by typing "DELETE" and we tear down:
//
//   - Avatar photo in Netlify Blobs (if any)
//   - profiles row (CASCADE drops their addresses, saved_carts,
//     saved_designs is on the profile row itself)
//   - Identity user (via Identity's admin API; the function's
//     identity token is service-role, so it can delete users)
//
// What we KEEP (and explicitly disclose in the Privacy Policy):
//   - Past `orders` rows. They get their user_id set to NULL
//     so they're no longer linked to the customer, but the
//     order itself stays for tax retention (California / IRS
//     require keeping financial records for ~7 years). The
//     customer_email column is REWRITTEN to a non-matchable
//     placeholder (`deleted-<userId>@lusik.invalid`) — this
//     is critical: the original email value would otherwise
//     let `link-guest-order` re-attach the deleted user's
//     orders to a future signup that happens to use the same
//     address. Stripe still holds the real email independently
//     for tax / financial-record purposes; ours doesn't need
//     to. `.invalid` is an RFC 6761 reserved TLD that no real
//     mail server can ever resolve.
//   - Finished-piece photos. Stored under <order_id>/... in
//     Blobs, not under user_id, so they're already detached
//     from identity. No way to look them up given just the
//     customer's email after the user_id link is gone.
//   - Lusik's internal admin_notes on past orders. These are
//     her business records about the order, not the customer
//     per se. The Privacy Policy disclosure tells customers
//     they can email separately to request those be scrubbed.
//
// After a successful delete, the browser side calls
// auth.signOut() to clear local Identity state and returns
// the customer to the home view with a toast.
// ============================================================

import { sql }            from "./_lib/db.mjs";
import { requireUser }    from "./_lib/auth.mjs";
import { json }           from "./_lib/json.mjs";
import { getStore }       from "@netlify/blobs";

const CONFIRM_PHRASE = "DELETE";

export default async (req, context) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const auth = requireUser(req, context);
  if (auth.response) return auth.response;
  const { user } = auth;

  // Defense-in-depth: even though the UI gates the button on a
  // typed-confirmation phrase, also enforce it here so a
  // direct API call can't bypass the safety net.
  const body = await req.json().catch(() => ({}));
  if (body.confirm !== CONFIRM_PHRASE) {
    return json(400, { error: `Confirmation missing. Send { "confirm": "${CONFIRM_PHRASE}" } to delete.` });
  }

  // 1. Capture the avatar URL so we can delete the Blob too.
  //    Skipping silently is fine if there's no profile row.
  const profileRows = await sql`SELECT avatar_url FROM profiles WHERE id = ${user.id} LIMIT 1`;
  const avatarUrl   = profileRows[0]?.avatar_url ?? null;

  // 2. Anonymize orders BEFORE deleting the profile row.
  //    orders.user_id has ON DELETE SET NULL in the schema, but
  //    doing it explicitly makes the intent obvious. Also rewrite
  //    customer_email to a deterministic .invalid address so the
  //    guest-order linkage code can never re-attach these rows to
  //    a future signup with the same email. See header comment.
  const placeholderEmail = `deleted-${user.id}@lusik.invalid`;
  await sql`
    UPDATE orders
       SET user_id = NULL,
           customer_email = ${placeholderEmail}
     WHERE user_id = ${user.id}
  `;

  // 3. Delete the profile row. ON DELETE CASCADE in the schema
  //    drops the customer's addresses + saved_carts. The
  //    saved_designs JSONB lives on the profile row itself, so
  //    it goes with the row.
  await sql`DELETE FROM profiles WHERE id = ${user.id}`;

  // 4. Delete the avatar Blob if present. The avatar Function
  //    stored it under "profile-photos" with the user_id as
  //    the folder prefix.
  if (avatarUrl) {
    try {
      // Avatar URL format: /.netlify/functions/avatar-get?key=<userId>/avatar-<ts>.<ext>
      const m = avatarUrl.match(/key=([^&]+)/);
      if (m) {
        const key = decodeURIComponent(m[1]);
        const store = getStore({ name: "profile-photos" });
        await store.delete(key);
      }
    } catch (err) {
      // Storage cleanup failure shouldn't block account deletion.
      console.warn("[account-delete] avatar cleanup failed:", err?.message ?? err);
    }
  }

  // 5. Delete the Identity user. context.clientContext.identity
  //    has the service-role token Netlify Functions get for
  //    talking to the Identity admin API. Without this step the
  //    customer's email is still on file in Identity, which
  //    would be a partial deletion at best.
  const identity = context?.clientContext?.identity;
  let identityDeleted = false;
  if (identity?.url && identity?.token) {
    try {
      const res = await fetch(`${identity.url}/admin/users/${encodeURIComponent(user.id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${identity.token}` },
      });
      identityDeleted = res.ok;
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.warn("[account-delete] Identity returned", res.status, text);
      }
    } catch (err) {
      console.warn("[account-delete] Identity delete failed:", err?.message ?? err);
    }
  } else {
    console.warn("[account-delete] no identity context available — Identity user not removed");
  }

  return json(200, {
    ok: true,
    identityDeleted,
    // The browser uses this to know whether to suggest the
    // customer also email Lusik (in case the Identity delete
    // failed and we want a human to follow up).
  });
};
