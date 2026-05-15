# Service Signup Checklist

Top-to-bottom list of every outside service the site uses, recommends, or has scaffolding for. Grouped by status:

- **✅ Implemented** — code uses this service; nothing more for you to do (or already configured)
- **🟡 Scaffolded** — code is ready and gracefully degrades, but you need to add a key/env var/DNS to activate
- **🟦 Recommended** — not yet integrated; would help if added

---

## ✅ Implemented (active in code)

### Netlify (hosting + functions + database + identity + blobs)
| | |
|---|---|
| **Website** | https://netlify.com |
| **What for** | Static hosting (Vite build → `dist/`), serverless functions (`netlify/functions/`), Postgres via `@netlify/neon` (`NETLIFY_DATABASE_URL`), file uploads via `@netlify/blobs`, customer auth via Netlify Identity |
| **Required?** | Required (the site is built around it) |
| **Cost** | Free tier covers small e-commerce volume. Estimated ~$0 / month at the volumes Lusik would see. |
| **You already have** | An account + the site (`lusikandsons.netlify.app`). |
| **Env vars set in Netlify dashboard** | `NETLIFY_DATABASE_URL` (auto-injected by `netlify database init`) |
| **Dashboard settings** | Identity → Enable. Identity → Settings → Registration → Invite-only. Identity → Services → Git Gateway → Enable (for Decap CMS). |
| **Status** | ✅ Active |

### Stripe (payments)
| | |
|---|---|
| **Website** | https://stripe.com |
| **What for** | Checkout sessions (`netlify/functions/create-checkout-session.mjs`), webhook for order persistence (`netlify/functions/stripe-webhook.mjs`), refunds, cart-abandonment recovery |
| **Required?** | Required (this is the payment processor) |
| **Cost** | 2.9% + $0.30 per transaction. No monthly fee. |
| **Env vars** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| **Dashboard settings** | Webhook endpoint `https://<site>/api/stripe-webhook` subscribed to **all three** of: `checkout.session.completed`, `charge.refunded`, `checkout.session.expired`. Optionally: `STRIPE_AUTOMATIC_TAX=true` env var if you've configured Stripe Tax. |
| **DNS / webhook** | Webhook endpoint above must be added in the Stripe dashboard. |
| **Status** | ✅ Active |

### Cloudflare (DNS + planned WAF)
| | |
|---|---|
| **Website** | https://cloudflare.com |
| **What for** | DNS hosting for `lusikandsons.com`. WAF + Bot Fight Mode + DDoS protection if the records are "proxied" (orange cloud). |
| **Required?** | DNS is required; proxy is optional but strongly recommended |
| **Cost** | Free tier covers everything you need. |
| **Dashboard settings** | To activate WAF: DNS → flip cloud icons gray → orange on root + www records. SSL/TLS → set to "Full (strict)". Security → Bots → enable Bot Fight Mode. |
| **Status** | ✅ DNS active; 🟦 proxy + Bot Fight Mode recommended |

---

## 🟡 Scaffolded (code is ready, needs your key/config to activate)

### Resend (transactional email)
| | |
|---|---|
| **Website** | https://resend.com |
| **What for** | Six transactional emails: admin order notification, customer order confirmation, finished-piece photo notification, shipped notification, refund notification, cart-abandonment recovery, gift reminder, waitlist availability |
| **Required?** | Strongly recommended. Without it, customers don't get order confirmations, Lusik doesn't get admin alerts. |
| **Cost** | Free tier: 100/day, 3,000/month. More than enough at this volume. |
| **Sign-up** | https://resend.com/signup |
| **Env vars** | `RESEND_API_KEY` (required), `ADMIN_NOTIFICATION_EMAIL` (required — Lusik's inbox), `RESEND_FROM_EMAIL` (optional but recommended; defaults to `onboarding@resend.dev` which spam-foldering risks) |
| **Code location** | `netlify/functions/_lib/email.mjs` |
| **Dashboard settings** | Verify `lusikandsons.com` in Resend → Domains. Set `RESEND_FROM_EMAIL=Lusik & Sons <orders@lusikandsons.com>` once verified. |
| **DNS** | Resend will give you 3-4 DNS records (SPF, DKIM, DMARC) to add at Cloudflare. |
| **Status** | 🟡 Needs your action — add `RESEND_API_KEY` + `ADMIN_NOTIFICATION_EMAIL` in Netlify env |

### Sentry (error monitoring)
| | |
|---|---|
| **Website** | https://sentry.io |
| **What for** | Captures JS errors + React render errors (via the ErrorBoundary in `src/main.jsx`) so you find out immediately when something breaks for a real customer |
| **Required?** | Optional but strongly recommended |
| **Cost** | Free tier: 5,000 errors/month. Plenty at this volume. |
| **Sign-up** | https://sentry.io/signup/ |
| **Env vars** | `VITE_SENTRY_DSN` (the DSN string from your Sentry project) |
| **Code location** | `src/lib/errorReporting.js` + `src/main.jsx` |
| **Dashboard settings** | Create a project (Platform: React). Copy the DSN. |
| **Status** | 🟡 Wired but inactive — paste DSN into Netlify env |

### Umami / privacy-first analytics
| | |
|---|---|
| **Website** | https://umami.is (or self-host) |
| **What for** | Page views + custom events (`add-to-cart`, `checkout-start`, `order-complete`, etc.) without cookies or cross-site tracking |
| **Required?** | Optional |
| **Cost** | Free tier: 100k events/month |
| **Sign-up** | https://cloud.umami.is/signup |
| **Env vars** | None (configured inline in `src/data/config.js` → `CONFIG.ANALYTICS.UMAMI_WEBSITE_ID`) |
| **Code location** | `src/lib/analytics.js`, `src/App.jsx:378-390` (script loader) |
| **Dashboard settings** | Create a website for `lusikandsons.com`, copy its ID. |
| **Status** | 🟡 Wired but inactive — paste ID into `CONFIG.ANALYTICS.UMAMI_WEBSITE_ID` and redeploy |

### Anthropic (chat assistant)
| | |
|---|---|
| **Website** | https://www.anthropic.com |
| **What for** | The off-by-default chat widget (`src/components/ChatAssistant.jsx`) backed by `netlify/functions/chat.mjs` |
| **Required?** | Optional (feature is off by default in `CONFIG.PAID_FEATURES.CHAT_ASSISTANT.ENABLED`) |
| **Cost** | Pay-as-you-go (per token). Current per-IP / per-session turn caps in `chat.mjs` bound the daily exposure. |
| **Env vars** | `ANTHROPIC_API_KEY`, optional `CHAT_DAILY_USD_CAP` (documented in the function header but not yet enforced — see SECURITY_REVIEW.md) |
| **Status** | 🟡 Wired but off — flip `CONFIG.PAID_FEATURES.CHAT_ASSISTANT.ENABLED = true` + set the API key |

### Decap CMS (browser editor for Lusik's Journal)
| | |
|---|---|
| **Website** | https://www.decapcms.org |
| **What for** | In-browser editor at `/admin/` that lets Lusik write new journal posts and commits them back to GitHub on save |
| **Required?** | Optional (Journal can be edited via PRs without it) |
| **Cost** | Free (open source). Decap script loads from unpkg with pinned SRI. |
| **Sign-up** | None. Activated via Netlify Identity (Lusik gets invited as an editor). |
| **Env vars** | None |
| **Dashboard settings** | Netlify → Identity → Services → Git Gateway → Enable. Netlify → Identity → Users → Invite Lusik (with editor role). |
| **Status** | ✅ Implemented and pinned to `decap-cms@3.8.4` with sha384 SRI |

### Web Push notifications to Lusik's phone — NOT YET BUILT
| | |
|---|---|
| **What for** | Buzz Lusik's phone the moment a new order lands, without needing an app |
| **Status** | 🟦 Recommended only — scoped in previous chat, separate PR will add this |

---

## Required env vars summary

Set all of these in Netlify dashboard → Site configuration → Environment variables.

| Var | Required? | What it does | If missing |
|---|---|---|---|
| `NETLIFY_DATABASE_URL` | Required | Postgres connection (Neon) | Functions can't read/write orders → checkout breaks |
| `STRIPE_SECRET_KEY` | Required | Server-side Stripe API auth | Checkout returns 500 |
| `STRIPE_WEBHOOK_SECRET` | Required | Verifies webhook signatures | Webhooks 400 → no orders persisted |
| `STRIPE_AUTOMATIC_TAX` | Optional | `true` if you've configured Stripe Tax | Tax = $0 collected |
| `RESEND_API_KEY` | Strongly recommended | Sends all transactional emails | No emails sent (degrades silently — order still persists, just no inbox alert) |
| `ADMIN_NOTIFICATION_EMAIL` | With Resend | Lusik's inbox for admin alerts | No admin alerts even with Resend |
| `RESEND_FROM_EMAIL` | Optional | Branded sender like `orders@lusikandsons.com` (requires domain verification) | Falls back to `onboarding@resend.dev` (often spam-foldered) |
| `REMINDER_SECRET` | Required for gift-reminder unsubscribe | HMAC key for one-year reminder unsubscribe URLs | Unsubscribe links 400 |
| `SCHEDULED_FN_SECRET` | Optional | Lets you manually trigger `cleanup-blobs` / `gift-reminder` via curl | Only Netlify's scheduler can invoke; manual trigger 403s |
| `VITE_SENTRY_DSN` | Optional | Activates Sentry error monitoring | Errors not reported (degrades silently) |
| `ANTHROPIC_API_KEY` | Optional | Chat assistant LLM | Chat widget off (feature flag also off by default) |
| `ADMIN_EMAILS` | Optional | Comma-separated list of emails that get admin role before Identity role is assigned in dashboard | Admin panel inaccessible until role is assigned the proper way |

---

## DNS records to verify exist at Cloudflare

| Record | Target | Notes |
|---|---|---|
| `lusikandsons.com` A/CNAME | Netlify load balancer | Proxied (orange) for WAF |
| `www.lusikandsons.com` CNAME | Netlify load balancer | Proxied (orange) |
| Resend SPF + DKIM + DMARC | Resend will give you 3-4 records | Required for branded `RESEND_FROM_EMAIL` |

---

## Quick start order (if doing this fresh)

1. Sign up at **Resend** → get API key → paste `RESEND_API_KEY` + `ADMIN_NOTIFICATION_EMAIL` into Netlify env vars.
2. Verify `lusikandsons.com` in Resend → add their DNS records at Cloudflare → set `RESEND_FROM_EMAIL` once verified.
3. Sign up at **Sentry** → create a React project → paste DSN into `VITE_SENTRY_DSN` env var → redeploy.
4. (Optional) Sign up at **Umami Cloud** → paste website ID into `src/data/config.js` → commit + redeploy.
5. Confirm **Cloudflare** records are proxied (orange cloud) and SSL/TLS is "Full (strict)".
6. Apply schema migration: `netlify db query --file netlify/schema.sql` (adds the new `customer_notes` column from this round).

Total time: ~30 minutes if you're walking through it for the first time.
