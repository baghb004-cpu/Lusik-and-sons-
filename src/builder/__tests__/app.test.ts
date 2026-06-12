import { test } from "node:test";
import assert from "node:assert/strict";

import {
  APP_QUESTIONS,
  deriveRequirements,
  appProjectSchema,
  buildAppleChecklist,
  buildPlayChecklist,
  EASY_PATH,
  HARD_PATH,
  buildWebManifest,
  buildServiceWorker,
  SW_REGISTER_SNIPPET,
} from "../app/index.ts";
import { assembleHtmlDocument } from "../export/static.ts";
import { themeSchema } from "../schema/index.ts";
import { makePage, makeMobileLayer } from "./fixtures.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ── questionnaire derivations ───────────────────────────────
test("derivations: accounts ⇒ privacy policy + deletion; UGC ⇒ moderation; kids ⇒ COPPA review", () => {
  const reqs = deriveRequirements({ needsLogin: true, hasUGC: true, collectsChildData: true });
  const ids = reqs.map((r) => r.id);
  assert.ok(ids.includes("privacy-policy"));
  assert.ok(ids.includes("account-deletion"));
  assert.ok(ids.includes("moderation"));
  assert.ok(ids.includes("children"));
  assert.ok(reqs.filter((r) => ["privacy-policy", "account-deletion", "moderation", "children"].includes(r.id)).every((r) => r.blocking));
});

test("derivations: the IAP fork — digital goods in stores need IAP; physical/web keeps Stripe", () => {
  const digital = deriveRequirements({ needsPayments: true, sellsDigital: true, needsStoreRelease: true });
  assert.ok(digital.some((r) => r.id === "iap" && r.blocking));
  const physical = deriveRequirements({ needsPayments: true, sellsDigital: false, needsStoreRelease: true });
  assert.ok(physical.some((r) => r.id === "stripe-ok"));
  assert.ok(!physical.some((r) => r.id === "iap"));
  // an empty questionnaire derives nothing — no fearmongering
  assert.deepEqual(deriveRequirements({}), []);
});

test("every question has a stable id and boolean/select/text kind", () => {
  const ids = new Set<string>();
  for (const q of APP_QUESTIONS) {
    assert.ok(!ids.has(q.id), `duplicate ${q.id}`);
    ids.add(q.id);
    assert.ok(["boolean", "select", "text"].includes(q.kind));
    if (q.kind === "select") assert.ok((q.options ?? []).length >= 2);
  }
});

// ── store checklists ────────────────────────────────────────
test("NO-GUARANTEE LAW: both checklists lead with the disclaimer; conditioning works", () => {
  const base = buildAppleChecklist({});
  assert.match(base[0].id, /disclaimer/);
  assert.match(base[0].detail, /cannot promise/);
  assert.match(buildPlayChecklist({})[0].id, /disclaimer/);

  const withUgc = buildAppleChecklist({ hasUGC: true, needsLogin: true, usesAdsTracking: true });
  const ids = withUgc.map((i) => i.id);
  assert.ok(ids.includes("apple-ugc"));
  assert.ok(ids.includes("apple-deletion"));
  assert.ok(ids.includes("apple-att"));
  assert.ok(!base.map((i) => i.id).includes("apple-ugc"));

  const playIap = buildPlayChecklist({ needsPayments: true, sellsDigital: true, needsStoreRelease: true });
  assert.ok(playIap.some((i) => i.id === "play-iap"));
});

test("easy path renders before hard path and starts web-first", () => {
  assert.match(EASY_PATH[0], /PWA/);
  assert.ok(EASY_PATH.length >= 4 && HARD_PATH.length >= 4);
});

// ── app project document ────────────────────────────────────
test("appProjectSchema: valid project parses; junk answers refused", () => {
  const ok = appProjectSchema.safeParse({
    schemaVersion: 1,
    id: "app_abc12345",
    name: "Lusik orders",
    slug: "lusik-orders",
    answers: { needsLogin: true, audience: "Lusik" },
    checkedItems: ["apple-account"],
    notes: "",
  });
  assert.equal(ok.success, true, JSON.stringify(!ok.success && ok.error.issues));
  const bad = appProjectSchema.safeParse({ schemaVersion: 1, id: "nope", name: "x", slug: "x", answers: {}, checkedItems: [], notes: "" });
  assert.equal(bad.success, false);
});

// ── PWA export pieces ───────────────────────────────────────
test("web manifest: themed from theme tokens, standalone, maskable icon present", () => {
  const theme = themeSchema.parse(JSON.parse(readFileSync(join(process.cwd(), "builder/theme.json"), "utf8")));
  const manifest = JSON.parse(buildWebManifest({ name: "Lusik & Sons", theme }));
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.theme_color, "#1A1612");
  assert.equal(manifest.background_color, "#F5EFE3");
  assert.ok(manifest.icons.some((i: { purpose?: string }) => i.purpose === "maskable"));
});

test("service worker: versioned cache, navigate network-first, asset cache-first", () => {
  const sw = buildServiceWorker("2026-06-12");
  assert.match(sw, /const CACHE = "pwa-2026-06-12"/);
  assert.match(sw, /mode === "navigate"/);
  assert.match(sw, /caches\.match\(e\.request\)/);
  assert.match(sw, /skipWaiting/);
});

test("html assembly: pwa adds EXACTLY one script + manifest link; plain static stays zero-JS", () => {
  const base = {
    page: makePage(),
    bodyHtml: "<p>hi</p>",
    layers: [makeMobileLayer()],
    theme: null,
    stylesheetHref: "styles.css",
    siteName: "Lusik & Sons",
  };
  const plain = assembleHtmlDocument(base);
  assert.equal((plain.match(/<script/g) ?? []).length, 0);
  assert.ok(!plain.includes("manifest.webmanifest"));

  const pwa = assembleHtmlDocument({ ...base, pwa: true });
  assert.equal((pwa.match(/<script/g) ?? []).length, 1);
  assert.ok(pwa.includes(SW_REGISTER_SNIPPET));
  assert.match(pwa, /<link rel="manifest" href="\/manifest.webmanifest" \/>/);
  assert.match(pwa, /<meta name="theme-color"/);
});
