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

export default async () => {
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
    const token = signReminderToken(order.id);
    const unsubscribeUrl = `${baseUrl}/.netlify/functions/unsubscribe-gift-reminder?o=${encodeURIComponent(order.id)}&t=${encodeURIComponent(token)}`;

    const ok = await sendGiftReminderEmail({ order, unsubscribeUrl })
      .catch((err) => {
        console.warn("[gift-reminder] send threw for", order.id, err?.message ?? err);
        return false;
      });

    if (ok) {
      // Stamp the timestamp ONLY on success, so a Resend outage
      // doesn't permanently block the reminder — next day's run
      // picks it up again.
      await sql`UPDATE orders SET gift_reminder_sent_at = now() WHERE id = ${order.id}`;
      sent += 1;
    } else {
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
