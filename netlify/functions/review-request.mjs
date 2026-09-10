// ============================================================
// /.netlify/functions/review-request  (scheduled)
// ============================================================
// Runs daily. Finds orders that shipped about a fortnight ago and have
// not been asked yet, and sends each one a single "how is it holding
// up?" email carrying a signed link to /review/<token>.
//
// Fourteen days rather than on delivery: a hand cross-stitched blanket
// is not judged on arrival, it is judged after a fortnight of being
// slept under and washed once. It also puts the ask far enough from the
// money that it does not read as part of the transaction.
//
// The claim is stamped BEFORE the send and released on failure, exactly
// as gift-reminder.mjs does it — that pattern is what makes a retry, an
// overlapping run and a manual trigger unable to double-send.
//
// Nothing here is offered in exchange for a review. A review that was
// paid for is not a review.
// ============================================================

import { sql }                        from "./_lib/db.mjs";
import { sendReviewRequest }          from "./_lib/email.mjs";
import { signReviewToken }            from "./_lib/order-tokens.mjs";
import { isScheduledInvocation,
         forbidden }                  from "./_lib/scheduled.mjs";

// Resend's free tier is 100 a day. A cap here means a backlog (the job
// off for a week, a clock jump) catches up over several days instead of
// spending the whole quota in one invocation.
const MAX_PER_RUN = 40;

export default async (req) => {
  // Defence in depth: Netlify already blocks public URLs for scheduled
  // functions, and the atomic claim below independently prevents
  // double-sends. See _lib/scheduled.mjs for the trigger paths.
  if (!(await isScheduledInvocation(req))) return forbidden();

  const baseUrl = process.env.URL || "https://lusikandsons.com";

  // A signing secret is what makes the link a capability. Without one
  // the feature stays dark rather than emailing links that cannot be
  // verified — the same call order-tokens.mjs makes.
  if (!signReviewToken("probe")) {
    console.warn("[review-request] no ORDER_LINK_SECRET/REMINDER_SECRET; skipping");
    return new Response("ok (no signing secret)", { status: 200 });
  }

  const eligible = await sql`
    SELECT id, order_number, customer_email, shipping_address, shipped_at
      FROM orders
     WHERE shipped_at IS NOT NULL
       AND review_request_sent_at IS NULL
       AND shipped_at < (now() - INTERVAL '14 days')
       AND fulfillment_status <> 'cancelled'
     ORDER BY shipped_at ASC
     LIMIT ${MAX_PER_RUN}
  `;

  if (eligible.length === 0) {
    return new Response("ok (nothing eligible)", { status: 200 });
  }

  let sent = 0;
  let failed = 0;
  for (const order of eligible) {
    // Stamp first. A concurrent invocation that picked the same order
    // updates zero rows and moves on.
    const claim = await sql`
      UPDATE orders
         SET review_request_sent_at = now()
       WHERE id = ${order.id}
         AND review_request_sent_at IS NULL
       RETURNING id
    `;
    if (claim.length === 0) continue;

    const token = signReviewToken(order.id);
    const reviewUrl = `${baseUrl}/review/${encodeURIComponent(token)}?id=${encodeURIComponent(order.id)}`;

    const ok = await sendReviewRequest({ order, reviewUrl }).catch((err) => {
      console.warn("[review-request] send threw for", order.id, err?.message ?? err);
      return false;
    });

    if (ok) {
      sent += 1;
    } else {
      // Release the claim so the next run retries. A failure to release
      // costs one missed ask, which is better than a send loop.
      await sql`UPDATE orders SET review_request_sent_at = NULL WHERE id = ${order.id}`
        .catch((err) => console.warn("[review-request] failed to release claim for", order.id, err?.message ?? err));
      failed += 1;
    }
  }

  console.log(`[review-request] sent ${sent}, failed ${failed} (eligible ${eligible.length})`);
  return new Response(`ok (sent ${sent}, failed ${failed})`, { status: 200 });
};

// Daily at 10:00 UTC — an hour after the gift reminder, so the two jobs
// never contend for the same Resend quota window.
export const config = {
  schedule: "0 10 * * *",
};
