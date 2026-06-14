// ============================================================
// App Developer Mode — store checklists + the two paths
// ============================================================
// The §23 Apple/Play lists as generators conditioned on the
// questionnaire. Item one of both lists is the disclaimer: this
// tool organizes the work; IT CANNOT GUARANTEE APPROVAL — and it
// never claims to. The easy path (web/PWA first) always renders
// before the hard one.
// ============================================================

import { deriveRequirements, type AppAnswers } from "./questionnaire.ts";

export interface ChecklistItem {
  id: string;
  label: string;
  detail: string;
}

const item = (id: string, label: string, detail: string): ChecklistItem => ({ id, label, detail });

export function buildAppleChecklist(answers: AppAnswers): ChecklistItem[] {
  const yes = (id: string) => answers[id] === true;
  const reqs = new Set(deriveRequirements(answers).map((r) => r.id));
  const out: ChecklistItem[] = [
    item("apple-disclaimer", "Understand: no tool guarantees approval", "Apple reviews by humans, with judgment. This checklist removes the predictable rejections; it cannot promise the outcome."),
    item("apple-account", "Apple Developer account ($99/yr)", "developer.apple.com — enrollment can take days; do it early."),
    item("apple-connect", "App Store Connect app record", "App name (unique on the store), bundle ID (reverse-DNS, permanent), primary language."),
    item("apple-icon", "App icon set", "1024×1024 master, no transparency, no rounded corners (Apple rounds them)."),
    item("apple-screens", "Screenshots per device size", "At minimum the 6.7\" and 6.1\" iPhone sets; iPad if it runs there."),
    item("apple-privacy-url", "Privacy policy URL", reqs.has("privacy-policy") ? "REQUIRED for this app (accounts/personal data/tracking)." : "Required for almost every submission anyway — have one."),
    item("apple-privacy-labels", "App Privacy details (nutrition labels)", "Declare every data type collected and why — must match reality."),
    item("apple-age", "Age rating questionnaire", yes("collectsChildData") ? "Kids category triggers extra review — see the children's-privacy requirement." : "Answer honestly; mismatches cause rejections."),
    item("apple-build", "Build uploaded via Xcode/Transporter", "Native wrapper builds only — a PWA skips this entire path."),
    item("apple-testflight", "TestFlight pass", "Run the real build on a real device; crashes in review = rejection."),
  ];
  if (yes("needsLogin")) out.push(item("apple-deletion", "Account deletion visible in-app", "Hard requirement since 2022 — a settings page link to your deletion flow."));
  if (reqs.has("iap")) out.push(item("apple-iap", "In-app purchase for digital goods", "Digital content/subscriptions must use Apple IAP (30/15% cut applies). Stripe inside the binary = rejection."));
  if (yes("hasUGC")) out.push(item("apple-ugc", "UGC: report, block, moderate", "All three must demonstrably exist or expect a 1.2 rejection."));
  if (yes("usesAdsTracking")) out.push(item("apple-att", "App Tracking Transparency prompt", "Tracking without the ATT prompt is an automatic rejection."));
  out.push(item("apple-rejections", "Read the common-rejection list", "Crashes, placeholder content, broken links, sign-in walls without Sign in with Apple, privacy mismatches — the usual suspects."));
  return out;
}

export function buildPlayChecklist(answers: AppAnswers): ChecklistItem[] {
  const yes = (id: string) => answers[id] === true;
  const reqs = new Set(deriveRequirements(answers).map((r) => r.id));
  const out: ChecklistItem[] = [
    item("play-disclaimer", "Understand: no tool guarantees approval", "Play review is faster but policy-strict, and policies shift — this list covers the stable core."),
    item("play-account", "Play Console account ($25 once)", "play.google.com/console — identity verification required."),
    item("play-package", "Application ID", "Reverse-DNS, permanent after first upload."),
    item("play-aab", "Signed Android App Bundle", "AAB (not APK) with Play App Signing enrolled."),
    item("play-listing", "Store listing", "Title, short + full description, screenshots, 512px icon, feature graphic."),
    item("play-privacy-url", "Privacy policy URL", reqs.has("privacy-policy") ? "REQUIRED for this app." : "Required for nearly all apps regardless."),
    item("play-datasafety", "Data safety section", "Declare collection/sharing/encryption/deletion — must match the privacy policy AND the code."),
    item("play-rating", "Content rating questionnaire", "IARC questionnaire; dishonest answers get apps pulled later."),
    item("play-audience", "Target audience & children", yes("collectsChildData") ? "Designed-for-families rules apply — strict." : "If not for kids, say so explicitly."),
    item("play-testing", "Testing track first", "Internal/closed track before production; new personal accounts must run a closed test with 12+ testers for 14 days."),
  ];
  if (reqs.has("iap")) out.push(item("play-iap", "Google Play Billing for digital goods", "Same rule as Apple: digital sales in the binary use Play Billing."));
  if (yes("hasUGC")) out.push(item("play-ugc", "UGC policy compliance", "Reporting, blocking, and enforcement — documented in the listing."));
  out.push(item("play-rejections", "Read the common-rejection list", "Data-safety mismatches, broken core flows, metadata violations, missing deletion for accounts."));
  return out;
}

export const EASY_PATH = [
  "Build it as a mobile-friendly site or installable PWA first (this builder's export does that today).",
  "Test it on a real iPhone and a real Android phone — add to home screen, try airplane mode.",
  "Deploy to the web. You're live: no store account, no review, no 15–30% cut, updates ship instantly.",
  "Add app-like features gradually (offline, push where supported).",
  "Only go native when something demands it: deep hardware access, store discoverability, or push on iOS beyond what web push offers.",
];

export const HARD_PATH = [
  "Native iOS + Android wrappers or rebuilds (React Native/Expo — a later phase of this builder, maybe).",
  "Two developer accounts, signing keys/certificates, bundle IDs you can never change.",
  "Screenshots, privacy labels, data-safety forms, age ratings — kept in sync with reality forever.",
  "Human review on every release; rejections cost days.",
  "In-app purchase rules (and revenue cuts) for digital goods.",
  "Ongoing: crash reporting, OS-update breakage, annual fees.",
];
