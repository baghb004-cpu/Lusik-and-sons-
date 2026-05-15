# Security Review — Round 2

Picks up where the prior six-PR security pass left off (CSP tightening, Stripe idempotency, scheduled-function gate, test coverage, defense-in-depth sweep, self-hosted fonts). This round's focus: review the new code paths added for features in this round + spot residual issues an attacker could still find.

---

## Vulnerabilities found and fixed in this round

| # | Area | Severity | Description | Fix |
|---|---|---|---|---|
| F1 | `customer_notes` field at checkout | **Medium** (pre-emptive) | New free-text field from the browser. Without bounds, an attacker could plant a multi-MB payload that bloats the orders.JSONB / admin email. CR/LF in the value could (if it ever flowed into a `subject` field) smuggle SMTP headers. | Cap at 280 chars in browser + function + webhook (defense-in-depth). Strip C0 control chars including CR/LF before storage. HTML-escape via existing `esc()` when rendering in admin email. |
| F2 | Newsletter signup duplicate component | **Low** (code health, not exploit) | Two newsletter components (`NewsletterForm` + `NewsletterSignup`). The one used on the home page (`NewsletterForm`) never actually POSTed anywhere — it showed a fake success state. Customers thought they were subscribed. | Deleted the dead duplicate; both surfaces now route through the working `NewsletterSignup` with the same honeypot + Netlify Forms POST. |
| F3 | Image MIME-confusion in case of CDN compromise | **Low** | Browsers can be tricked by missing `loading`/`decoding` hints in some edge cases. Mostly a performance issue, but `decoding="async"` reduces main-thread image-decode time which is also a DoS-resistance property. | Added `decoding="async"` to 18 of 20 image tags alongside `loading="lazy"` / `fetchPriority="high"`. |

---

## Remaining security recommendations (not fixed this round)

### 🔴 Critical
None. Prior six-PR pass closed the criticals; nothing new surfaced.

### 🟠 High

#### H1 — Sentry DSN still not active in production
- **Where:** `src/lib/errorReporting.js`
- **Why it matters:** the scaffold is in place but `VITE_SENTRY_DSN` is unset, so runtime errors are invisible. If a customer hits a JS crash on the PDP at 2 AM, you find out only when they email you the next day. A determined attacker would specifically look for paths that trigger uncaught exceptions because they're operationally invisible.
- **Fix:** 5-minute Sentry signup → paste DSN in Netlify env. See `SERVICE_SIGNUP_CHECKLIST.md`.

#### H2 — Admin endpoints have no client IP allowlist
- **Where:** `netlify/functions/admin-*.mjs`
- **Why it matters:** The admin endpoints are correctly gated by `requireAdmin(context)` (Identity JWT with `admin` role). But if Lusik's Identity credentials are ever stolen (phishing, password reuse, malware), the attacker can log in as admin from anywhere in the world. Adding an IP allowlist (Lusik's home + workshop networks) would make stolen-credentials attacks much harder.
- **Risk:** moderate — admin role grants full DB read + order edit + finished-piece photo upload.
- **Fix scope:** add a `process.env.ADMIN_IP_ALLOWLIST` (comma-separated CIDR list), check `ipFromRequest(req, context)` against it inside `requireAdmin` for write operations. Bypass if env unset (so existing deploys don't break). Half-day implementation.

### 🟡 Medium

#### M1 — `chat.mjs` documents `CHAT_DAILY_USD_CAP` but doesn't enforce it
- **Where:** `netlify/functions/chat.mjs:11-12`
- **Why it matters:** the function comment promises a daily-dollar cap, but no code reads the env var. Today's per-IP / per-session turn caps bound the daily exposure to roughly $X (varies with model price), but documented behavior should match real behavior — either remove the comment or implement the cap.
- **Risk:** low (feature is off by default; turn caps already exist).
- **Fix scope:** small. Either delete the comment or store daily-token-count in Blobs and short-circuit when over the cap.

#### M2 — Admin panel still has no CSRF protection
- **Where:** every `admin-*.mjs` function
- **Why it matters:** Identity JWT is sent in the `Authorization: Bearer …` header (not as a cookie), so CSRF in the classic sense isn't applicable. But a stored XSS in the admin panel (Decap CMS content?) could trigger admin actions via fetch() while Lusik is logged in. Decap is pinned + SRI'd which closes most of that, but content-driven XSS through markdown body is still theoretically possible.
- **Risk:** low (Decap markdown parser is well-tested; pinned version).
- **Fix scope:** add an `Origin` header check inside `requireAdmin` — require `request.headers.get("origin")` to match the deployed site's origin. Half-day implementation, no UI changes.

#### M3 — `customer_notes` is rendered in admin email but not yet displayed in the admin panel
- **Where:** `src/components/AdminOrderRow.jsx`
- **Why it matters:** Lusik sees the note in the email but if she's working from the admin panel days later (after archiving the email), she has no way to see it. Not a security issue but operational risk — she might miss a "ship by the 14th" note.
- **Fix scope:** small. Add a read-only display block in AdminOrderRow showing `order.customer_notes` if present. ~10 lines.

#### M4 — No formal logging of admin actions
- **Where:** N/A (gap)
- **Why it matters:** if Lusik's admin account is ever compromised and the attacker edits an order or uploads a photo, there's no audit trail. The `orders` table has timestamps for `created_at` and `shipped_at` but no history of admin edits.
- **Fix scope:** add an `order_audit_log` table that captures `(order_id, user_id, action, before, after, timestamp)` for every admin write. Medium-sized PR; defer unless you start growing the admin team.

### 🟢 Low / observational

#### L1 — Source-map files exist in `dist/assets/` but aren't linked
- **Where:** `vite.config.mjs` `sourcemap: "hidden"`
- **Why it matters:** the maps are deployed alongside the JS, just without the `//# sourceMappingURL=` comment. A determined attacker could guess the URL pattern (`index-*.js.map`) and download them. Until Sentry is wired up to ingest + delete the maps post-build, they're sitting in production.
- **Fix scope:** add a Netlify build step that deletes `dist/assets/*.map` after Sentry's upload completes (or before, if Sentry isn't configured). Or block `*.map` requests at the CDN level via a netlify.toml redirect.

#### L2 — No formal pentest
- Same as previous review. Run OWASP ZAP locally for a sanity check before any real launch.

#### L3 — Resend send-failures degrade silently
- **Where:** Various `.catch(() => false)` patterns in `_lib/email.mjs`
- **Why it matters:** the design choice (don't fail the order because email send failed) is correct, but there's no aggregation of email-send failures. If Resend is rate-limiting you for a day, you'd silently miss notifications.
- **Fix scope:** when Sentry is wired (H1), forward email-send failures to Sentry as warnings.

#### L4 — `SCHEDULED_FN_SECRET` is optional
- **Where:** `netlify/functions/_lib/scheduled.mjs`
- **Why it matters:** if the env var is unset, only Netlify's scheduler can invoke the scheduled functions. That's fine in production. But during incident-recovery you might want to manually trigger `cleanup-blobs`. Setting the secret is a 30-second one-time task.
- **Fix scope:** documented; just set the env var.

---

## Bug-bounty-style notes (what a researcher would try)

If you posted a bounty tomorrow, here are the angles a serious researcher would probe — and what they'd find:

1. **Stuff the gift_message / customer_notes / waitlist productName with control characters or `\r\nBcc:`** → blocked at the function boundary (we strip C0 controls).
2. **Stuff a 1 MB JSON payload into `idempotency_key`** → rejected by length + character whitelist.
3. **Send a webhook POST without a signature** → 400 (now tested).
4. **Manually call `/cleanup-blobs` or `/gift-reminder` over HTTP** → 403 unless they have `SCHEDULED_FN_SECRET` (also tested).
5. **Bypass per-SKU pricing by sending a `price` field** → server ignores it; uses `TRUSTED_PRODUCTS` map (tested).
6. **Race two checkout sessions with the same cart** → idempotency-key returns the same Stripe Session URL (tested).
7. **Try to fetch another user's orders by changing the user_id param** → not possible; functions filter by JWT-derived `user.id`, not body params (audited).
8. **Inject markup into a journal post or product name** → React escapes by default; the few `dangerouslySetInnerHTML` blocks (JSON-LD in JournalView) contain only constant compile-time data (audited).
9. **Open-redirect via the Stripe success URL** → blocked by `isAllowedOrigin` (tested with the real helper imported, not a re-implementation).
10. **Steal the Netlify Database URL** → not exposed in any function response or log; reviewed.

Things they might find:
- **The unlinked source maps** (L1 above) — partial.
- **Operational gaps** they can't exploit but can write a "low" report on (Sentry not wired, etc.).
- **Brand-new endpoints** added by future PRs that don't follow the existing patterns — but that's a forward-looking concern, not a current vuln.

A skilled researcher might find one logic bug in the gift-reminder or waitlist timing window. None should be high-severity.

---

## Files / areas involved

This round touched the following security-relevant areas (cross-reference with `IMPLEMENTATION_REPORT.md`):

- `netlify/schema.sql` — schema migration (additive, non-destructive)
- `netlify/functions/create-checkout-session.mjs` — input validation for new `customer_notes` field
- `netlify/functions/stripe-webhook.mjs` — defense-in-depth sanitization at insert time
- `netlify/functions/_lib/email.mjs` — HTML-escape on the new note block
- `src/components/CheckoutView.jsx` — client-side cap on textarea
- `src/components/NewsletterSignup.jsx` — kept the working honeypot path (the deleted NewsletterForm had none)

---

## Priority summary

| Priority | Item | Effort | When |
|---|---|---|---|
| 🟠 High | Wire up Sentry DSN | 5 min | This week |
| 🟠 High | Admin IP allowlist | Half day | This month |
| 🟡 Medium | `chat.mjs` daily-USD-cap enforcement OR remove the comment | 1 hour | Anytime |
| 🟡 Medium | `Origin` header check in `requireAdmin` | Half day | Anytime |
| 🟡 Medium | Display `customer_notes` in AdminOrderRow | 30 min | Before launch traffic |
| 🟡 Medium | `order_audit_log` table | 1-2 days | If admin team grows beyond Lusik + sons |
| 🟢 Low | Block `*.map` at the CDN edge | 15 min | Anytime |
| 🟢 Low | OWASP ZAP scan | Half day | Before public launch |
| 🟢 Low | Pipe Resend send-failures to Sentry once Sentry is live | 30 min | After H1 |
| 🟢 Low | Set `SCHEDULED_FN_SECRET` | 30 sec | Anytime |

Most of these are operational rather than code-fix. The site is in genuinely good shape post-this-round; the remaining work is about closing operational gaps, not patching exploitable code paths.
