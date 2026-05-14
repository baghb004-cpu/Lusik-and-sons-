// ============================================================
// /.netlify/functions/gift-reminder  (scheduled)
// ============================================================
// Runs daily. Finds orders that opted in to the one-year reminder
// at checkout, are now ~11 months old, and haven't been emailed
// yet — sends each one a single gentle "it's been a year" email.
//
// Schedule: daily at 9am UTC (~1am Pacific in winter / 2am in
// summer — sending before the customer's morning so the email is
// at the top of their inbox).
//
// Idempotency: orders.gift_reminder_sent_at is stamped after a
// successful Resend send. The partial index in schema.sql ensures
// the scan is cheap.
//
// Eligibility window: created_at older than 11 months. We don't
// upper-bound the age — if the job has been off for a while and
// there's a backlog, it catches up across multiple days, capped at
// MAX_PER_RUN so a single invocation can't blast the Resend quota.
// ============================================================

import { sql }                  from "./_lib/db.mjs";
import { sendGiftReminderEmail,
         signReminderToken }    from "./_lib/email.mjs";
import { isScheduledInvocation,
         forbidden }            from "./_lib/scheduled.mjs";

// Cap per run. Resend free tier is 100/day, 3000/month. With a
// realistic opt-in rate this is far more than we'd ever batch in
// one day, but the cap protects against schema/clock weirdness
// from spending the whole quota at once.
const MAX_PER_RUN = 50;

// How old an order has to be before we'll send the reminder.
// 11 months instead of 12 so the email lands a few weeks before
// the anniversary — gives the recipient lead time if they want
// to order another gift.
const ELIGIBILITY_INTERVAL = "11 months";

export default async (req) => {
  // HTTP gate — Netlify scheduled functions are reachable at the
  // public function URL. Without this check an attacker could
  // race-trigger reminder sends and burn Resend quota at the
  // tier's daily/monthly limits. The atomic claim below makes
  // double-sends impossible per-order, but a public endpoint
  // still wastes function invocations + email quota. See
  // _lib/scheduled.mjs for trigger paths.
  if (!(await isScheduledInvocation(req))) return forbidden();

  const baseUrl = process.env.URL || "https://lusikandsons.com";

  const eligible = await sql`
    SELECT id, order_number, customer_email, shipping_address, gift, created_at
      FROM orders
     WHERE gift_reminder_opt_in = true
       AND gift_reminder_sent_at IS NULL
       AND created_at < (now() - INTERVAL '11 months')
     ORDER BY created_at ASC
     LIMIT ${MAX_PER_RUN}
  `;

  if (eligible.length === 0) {
    return new Response("ok (nothing eligible)", { status: 200 });
  }

  let sent = 0;
  let failed = 0;
  for (const order of eligible) {
    // Atomic claim: stamp the timestamp BEFORE sending. The
    // `WHERE gift_reminder_sent_at IS NULL` predicate means a
    // concurrent invocation (Netlify retry, manual trigger, two
    // overlapping cron runs) that picked the same order will
    // see zero rows updated and skip — no double-send. If the
    // Resend send fails we NULL the timestamp back out so the
    // next run retries.
    const claim = await sql`
      UPDATE orders
         SET gift_reminder_sent_at = now()
       WHERE id = ${order.id}
         AND gift_reminder_sent_at IS NULL
       RETURNING id
    `;
    if (claim.length === 0) {
      // Lost the race to another invocation. Skip silently.
      continue;
    }

    const token = signReminderToken(order.id);
    const unsubscribeUrl = `${baseUrl}/.netlify/functions/unsubscribe-gift-reminder?o=${encodeURIComponent(order.id)}&t=${encodeURIComponent(token)}`;

    const ok = await sendGiftReminderEmail({ order, unsubscribeUrl })
      .catch((err) => {
        console.warn("[gift-reminder] send threw for", order.id, err?.message ?? err);
        return false;
      });

    if (ok) {
      sent += 1;
    } else {
      // Release the claim so the next run can retry. If THIS
      // update fails we accept a rare miss — better than a
      // double-send loop.
      await sql`
        UPDATE orders SET gift_reminder_sent_at = NULL WHERE id = ${order.id}
      `.catch((err) => console.warn("[gift-reminder] failed to release claim for", order.id, err?.message ?? err));
      failed += 1;
    }
  }

  console.log(`[gift-reminder] sent ${sent}, failed ${failed} (eligible ${eligible.length})`);
  return new Response(`ok (sent ${sent}, failed ${failed})`, { status: 200 });
};

// Netlify scheduled-function syntax: declare the cron on the
// exported `config`. "0 9 * * *" = every day at 09:00 UTC.
export const config = {
  schedule: "0 9 * * *",
};
