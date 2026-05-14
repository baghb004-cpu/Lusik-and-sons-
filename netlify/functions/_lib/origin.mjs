// ============================================================
// Origin allowlist — open-redirect defense for Stripe return URLs
// ============================================================
// `create-checkout-session` builds `success_url` and `cancel_url`
// for Stripe from the incoming `Origin` header. Without this check
// an attacker could send `Origin: https://evil.com` and Stripe
// would happily redirect the paid customer to evil.com after
// checkout — a perfect phishing setup ("your order confirmation is
// on the next page, please re-enter your card").
//
// Accept-list (anything else falls back to the canonical URL):
//   - process.env.URL                — production canonical URL
//   - process.env.DEPLOY_PRIME_URL    — deploy-preview / branch deploy
//   - https://lusikandsons.com        — hardcoded production fallback
//   - http://localhost(:port)?        — `netlify dev` local
//   - https://<hash>--<sitehost>      — Netlify deploy-preview pattern
//
// Env is taken as a parameter (defaulting to process.env) so the
// unit tests can drive it directly without mutating globals.
// ============================================================

export function isAllowedOrigin(origin, env = process.env) {
  if (!origin || typeof origin !== "string") return false;
  if (origin === env.URL) return true;
  if (origin === env.DEPLOY_PRIME_URL) return true;
  if (origin === "https://lusikandsons.com") return true;
  // localhost variants for netlify dev. Match http://localhost(:port)?
  // only — no IP literals, no other hostnames.
  if (/^http:\/\/localhost(?::\d+)?$/.test(origin)) return true;
  // Netlify deploy-preview / branch-deploy URLs are
  // https://<hash>--<sitename>. Accept any that match the site's
  // URL pattern. We compare against the canonical URL's hostname,
  // not just "netlify.app", so a custom domain still gets a
  // working preview pattern.
  if (env.URL) {
    try {
      const site = new URL(env.URL).hostname;
      const previewRe = new RegExp(`^https://[a-z0-9-]+--${site.replace(/\./g, "\\.")}$`);
      if (previewRe.test(origin)) return true;
    } catch {
      // Malformed env.URL — fall through to false.
    }
  }
  return false;
}
