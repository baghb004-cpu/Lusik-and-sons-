// Recommended default stacks (plan §17). Per category: ordered preset-id
// choices, first = suggested default. Every id is registry-checked by a
// unit test, so a renamed preset can't silently orphan a stack.
import type { Stack } from "./types.ts";

export const STACKS: Stack[] = [
  {
    id: "simple-business-site",
    label: "Simple business site",
    blurb: "A fast brochure site: pages, photos, contact info. No database, nothing to maintain. Email only if a form needs it.",
    choices: {
      hosting: ["netlify", "vercel"],
      database: ["none-static"],
      email: ["resend"],
      security: ["cloudflare-info"],
      cms: ["builtin-git-cms"],
      commerce: [],
    },
    optional: ["email", "security", "commerce"],
  },
  {
    id: "small-business-shop",
    label: "Small business shop",
    blurb: "Sell products with hosted Stripe checkout, orders in a real database, and receipt/notification emails. The reference Lusik & Sons stack.",
    choices: {
      hosting: ["netlify", "vercel"],
      database: ["supabase", "neon"],
      commerce: ["stripe-checkout", "stripe-webhooks"],
      email: ["resend"],
      security: ["cloudflare-info"],
      cms: ["builtin-git-cms"],
    },
    optional: ["security"],
  },
  {
    id: "cms-site",
    label: "CMS site",
    blurb: "A content-led site (journal, articles, editorial pages) edited through the built-in git-based CMS. Database only if features demand one.",
    choices: {
      hosting: ["netlify"],
      cms: ["builtin-git-cms"],
      database: ["none-static", "supabase"],
      email: ["resend"],
      security: ["cloudflare-info"],
      commerce: [],
    },
    optional: ["database", "email", "security", "commerce"],
  },
  {
    id: "app-builder-mode",
    label: "App project",
    blurb: "An app-like project: pick the database by need (relational → Supabase/Neon, realtime → Firebase, edge-light → Turso); auth and storage ride the same choice.",
    choices: {
      hosting: ["vercel", "netlify", "cloudflare-pages"],
      database: ["supabase", "firebase", "neon", "turso"],
      email: ["resend"],
      security: ["cloudflare-info"],
      cms: ["builtin-git-cms"],
      commerce: ["stripe-checkout"],
    },
    optional: ["email", "security", "commerce", "cms"],
  },
];
