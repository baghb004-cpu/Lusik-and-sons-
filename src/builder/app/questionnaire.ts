// ============================================================
// App Developer Mode — questionnaire + derived requirements
// ============================================================
// The §15/§23 guided questions as data, and the pure derivation
// from answers to obligations: what the project NEEDS (privacy
// policy, account deletion, moderation…) before anyone talks
// about app stores. Honest by construction — derivations explain
// themselves, and nothing here promises approval anywhere.
// ============================================================

import { z } from "zod";

export interface AppQuestion {
  id: string;
  text: string;
  kind: "boolean" | "select" | "text";
  options?: string[];
  help?: string;
}

export const APP_QUESTIONS: AppQuestion[] = [
  { id: "appType", text: "What kind of app is this?", kind: "select", options: ["app-like website", "installable PWA", "native app (later)"], help: "Start web-first — decide native only when something truly needs it." },
  { id: "audience", text: "Who is it for?", kind: "text" },
  { id: "needsLogin", text: "Do people sign in / have accounts?", kind: "boolean" },
  { id: "needsPayments", text: "Does it take payments?", kind: "boolean" },
  { id: "sellsDigital", text: "If payments: digital goods/subscriptions (not physical products)?", kind: "boolean", help: "Matters for store rules — digital sales inside native apps must use Apple/Google in-app purchase." },
  { id: "needsPush", text: "Push notifications?", kind: "boolean" },
  { id: "needsOffline", text: "Should it work offline?", kind: "boolean" },
  { id: "needsDatabase", text: "Does it store data on a server?", kind: "boolean" },
  { id: "collectsPersonalData", text: "Does it collect names, emails, addresses, location or similar?", kind: "boolean" },
  { id: "collectsChildData", text: "Is it aimed at children, or does it knowingly collect children's data?", kind: "boolean" },
  { id: "hasUGC", text: "Can users post content others can see?", kind: "boolean" },
  { id: "usesAdsTracking", text: "Ads or cross-site tracking?", kind: "boolean" },
  { id: "needsStoreRelease", text: "Does it need an App Store / Google Play release?", kind: "boolean", help: "A PWA on the web needs neither — that's the easy path." },
];

export const appAnswersSchema = z.record(z.string(), z.union([z.boolean(), z.string()])).default({});
export type AppAnswers = z.infer<typeof appAnswersSchema>;

export interface DerivedRequirement {
  id: string;
  label: string;
  why: string;
  blocking: boolean; // must exist before release vs strongly advised
}

export function deriveRequirements(answers: AppAnswers): DerivedRequirement[] {
  const yes = (id: string) => answers[id] === true;
  const out: DerivedRequirement[] = [];
  if (yes("collectsPersonalData") || yes("needsLogin") || yes("usesAdsTracking")) {
    out.push({ id: "privacy-policy", label: "Public privacy policy page", why: "Personal data, accounts or tracking ⇒ a reachable privacy policy URL (stores and law both ask for it)", blocking: true });
  }
  if (yes("needsLogin")) {
    out.push({ id: "account-deletion", label: "In-app account deletion", why: "Accounts ⇒ users must be able to delete them (Apple requires it; CCPA/GDPR expect it)", blocking: true });
  }
  if (yes("hasUGC")) {
    out.push(
      { id: "moderation", label: "Moderation + report/block tools", why: "User-generated content ⇒ stores require reporting, blocking and moderation", blocking: true },
      { id: "ugc-terms", label: "Content rules in your terms", why: "Say what's allowed and what gets removed", blocking: false }
    );
  }
  if (yes("collectsChildData")) {
    out.push({ id: "children", label: "Children's-privacy review (COPPA etc.)", why: "Kids' data triggers strict legal rules — get real advice before launch", blocking: true });
  }
  if (yes("needsPayments")) {
    out.push(
      yes("sellsDigital") && yes("needsStoreRelease")
        ? { id: "iap", label: "Apple/Google in-app purchase integration", why: "Digital goods sold inside native store apps must use IAP — Stripe checkout there gets rejected", blocking: true }
        : { id: "stripe-ok", label: "Web checkout (Stripe) is fine", why: "Physical goods and web/PWA payments may use normal web checkout", blocking: false }
    );
  }
  if (yes("needsPush")) {
    out.push({ id: "push-consent", label: "Ask for push permission in context", why: "Permission prompts on first launch get denied and (on iOS) reviewed poorly — ask when the value is obvious", blocking: false });
  }
  if (yes("usesAdsTracking")) {
    out.push({ id: "tracking-consent", label: "Tracking consent + store privacy labels", why: "ATT prompt on iOS, Data-safety disclosure on Play, opt-out where CPRA applies", blocking: true });
  }
  if (yes("needsOffline")) {
    out.push({ id: "offline-shell", label: "Offline shell (service worker)", why: "The PWA export includes one — test it in airplane mode", blocking: false });
  }
  return out;
}

// ── the app project document (builder/apps/<slug>.json) ─────
export const appProjectSchema = z
  .object({
    schemaVersion: z.number().int().min(1).default(1),
    id: z.string().regex(/^[a-z]+_[A-Za-z0-9]{8,}$/),
    name: z.string().min(1).max(60),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    answers: appAnswersSchema,
    /** Checklist items the owner ticked off (ids from checklists.ts). */
    checkedItems: z.array(z.string()).default([]),
    notes: z.string().default(""),
  })
  .strict();

export type AppProject = z.infer<typeof appProjectSchema>;
export const APP_DIR = "builder/apps";
