// ============================================================
// /.netlify/functions/admin-order-milestone
// ============================================================
// POST { order_id, milestone, note? } → appends one step to an order's
// timeline. Admin only. This is the write half of "while she stitches";
// the customer reads it through /order-milestones.
//
// Append-only by intent: a milestone records that something happened at
// a moment. A correction is a new row, not an edit, so the history stays
// honest. Photos are NOT uploaded here — they already have a home in
// admin-order-photo (Netlify Blobs) and a milestone can point at one.
//
// The 'stitching' step optionally emails the customer once ("Lusik has
// started on your piece"), gated by orders.stitching_emailed_at so a
// double tap cannot send twice. Email failure never fails the write.
// ============================================================

import { sql }  from "./_lib/db.mjs";
import { json } from "./_lib/json.mjs";
import { requireAdmin } from "./_lib/auth.mjs";
import { isMilestone } from "./_lib/order-tokens.mjs";
import { sendStitchingStartedEmail } from "./_lib/email.mjs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOTE_MAX = 500;

export default async (req, context) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const auth = await requireAdmin(req, context);
  if (auth.response) return auth.response;

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const orderId = String(body?.order_id || "");
  if (!UUID_RE.test(orderId)) return json(400, { error: "order_id must be a UUID" });
  if (!isMilestone(body?.milestone)) return json(400, { error: "Unknown milestone" });

  const milestone = body.milestone;
  const note = typeof body.note === "string" && body.note.trim()
    ? body.note.trim().slice(0, NOTE_MAX)
    : null;
  const photoKey = typeof body.photo_key === "string" && body.photo_key.trim()
    ? body.photo_key.trim().slice(0, 300)
    : null;

  try {
    const rows = await sql`
      INSERT INTO order_milestones (order_id, milestone, note, photo_key)
      VALUES (${orderId}, ${milestone}, ${note}, ${photoKey})
      RETURNING id, order_id, milestone, note, photo_key, created_at
    `;
    const created = rows?.[0] ?? null;
    if (!created) return json(500, { error: "Milestone not recorded" });

    // One-time "she's started" note to the customer. Claimed atomically
    // so two taps (or two admins) cannot both send it.
    if (milestone === "stitching") {
      try {
        const claimed = await sql`
          UPDATE orders SET stitching_emailed_at = now()
          WHERE id = ${orderId} AND stitching_emailed_at IS NULL
          RETURNING id, order_number, customer_email
        `;
        const order = claimed?.[0];
        if (order?.customer_email) {
          await sendStitchingStartedEmail({
            to: order.customer_email,
            orderNumber: order.order_number,
            orderId: order.id,
            note,
          }).catch(() => {});
        }
      } catch (err) {
        console.error("stitching email skipped:", err?.message || err);
      }
    }

    return json(200, { milestone: created });
  } catch (err) {
    console.error("admin-order-milestone failed:", err?.message || err);
    return json(500, { error: "Could not record the milestone" });
  }
};
