// Private offline Tax Assistant (plan §25): the safety contract
// (no unverified figure ever becomes a number), confidence rollups,
// the organizer's document/form guidance, validation, packet
// assembly, and real at-rest encryption.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { taxProject, rulePack, type TaxProject, type RulePack } from "../tax/schemas.ts";
import { neededDocuments, likelyForms, INTERVIEW } from "../tax/checklist.ts";
import { rollupConfidence, compareDeductions, standardDeductionCents } from "../tax/engine.ts";
import { validateProject } from "../tax/validate.ts";
import { buildPacket } from "../tax/packet.ts";
import { encryptProject, decryptProject } from "../tax/crypto.ts";

const base = (over: Partial<TaxProject> = {}): TaxProject =>
  taxProject.parse({ taxYear: 2026, filingStatus: "single", ...over });

const VERIFIED_PACK: RulePack = rulePack.parse({
  taxYear: 2026, jurisdiction: "us-federal", status: "user-verified",
  officialSource: "https://www.irs.gov/forms-instructions",
  figures: [{ key: "std_deduction_single", value: 14600, unit: "usd", verified: true, source: "https://www.irs.gov/forms-pubs/about-form-1040" }],
});
const UNVERIFIED_PACK: RulePack = rulePack.parse({
  ...VERIFIED_PACK,
  status: "template",
  figures: [{ key: "std_deduction_single", value: 14600, unit: "usd", verified: false, source: "https://www.irs.gov/forms-pubs/about-form-1040" }],
});

// ── THE SAFETY CONTRACT ─────────────────────────────────────
test("an UNVERIFIED standard-deduction figure never becomes a number", () => {
  const project = base({ deductions: [{ label: "Mortgage interest", itemized: true, amountCents: 900000, confidence: "confirmed-document" }] });
  assert.equal(standardDeductionCents(UNVERIFIED_PACK, project), null);
  const cmp = compareDeductions(project, UNVERIFIED_PACK);
  assert.equal(cmp.recommendation, "needs-review");
  assert.equal(cmp.standardCents, null);
  assert.match(cmp.explanation, /verify against the official/i);
  // with no pack at all, same safe refusal
  assert.equal(compareDeductions(project, null).recommendation, "needs-review");
});

test("a VERIFIED figure enables a plain arithmetic comparison both ways", () => {
  const itemizedBig = base({ deductions: [{ label: "Mortgage", itemized: true, amountCents: 2000000, confidence: "confirmed-document" }] });
  assert.equal(standardDeductionCents(VERIFIED_PACK, itemizedBig), 1460000);
  assert.equal(compareDeductions(itemizedBig, VERIFIED_PACK).recommendation, "itemized");
  const itemizedSmall = base({ deductions: [{ label: "Small", itemized: true, amountCents: 50000, confidence: "confirmed-manual" }] });
  assert.equal(compareDeductions(itemizedSmall, VERIFIED_PACK).recommendation, "standard");
});

// ── confidence: weakest input governs ───────────────────────
test("rollupConfidence returns the weakest part; empty = not-enough-info", () => {
  assert.equal(rollupConfidence(["confirmed-document", "confirmed-manual"]), "confirmed-manual");
  assert.equal(rollupConfidence(["calculated", "needs-review"]), "needs-review");
  assert.equal(rollupConfidence([]), "not-enough-info");
});

// ── organizer (Phase 1) ─────────────────────────────────────
test("the organizer maps answers → documents + forms, each citing irs.gov", () => {
  const answers = { "had-job": true, "self-employed": true, "marketplace-insurance": true } as Record<string, unknown>;
  const docs = neededDocuments(answers).map((d) => d.id);
  assert.ok(docs.includes("w2") && docs.includes("1099-nec") && docs.includes("1095-a"));
  assert.ok(docs.includes("id-info")); // always needed
  const forms = likelyForms(answers).map((f) => f.form);
  assert.ok(forms.includes("Form 1040") && forms.includes("Schedule C") && forms.includes("Form 8962"));
  for (const item of neededDocuments(answers)) assert.match(item.source, /^https:\/\/www\.irs\.gov/);
  for (const q of INTERVIEW) assert.ok(q.why.length > 10, `${q.id} explains why it matters`);
});

// ── validation: helpful, never accusatory ───────────────────
test("validation flags missing docs, marketplace as an error, duplicates, HoH", () => {
  const p = base({
    filingStatus: "head-of-household",
    dependents: 0,
    answers: { "had-job": true, "marketplace-insurance": true },
  });
  const codes = validateProject(p).map((x) => x.code);
  assert.ok(codes.includes("missing-W-2"));
  const marketplace = validateProject(p).find((x) => x.code === "missing-1095-A");
  assert.equal(marketplace?.level, "error"); // stalls the return — hard error
  assert.ok(codes.includes("hoh-no-dependent"));
  // every warning offers a concrete fix
  for (const wn of validateProject(p)) assert.ok(wn.fix.length > 10, wn.code);
});

test("validation never auto-trusts OCR and warns on big deductions", () => {
  const p = base({
    income: [{ label: "Wages", amountCents: 1000000, confidence: "confirmed-document" }],
    deductions: [{ label: "Stuff", itemized: true, amountCents: 800000, confidence: "needs-review" }],
    documents: [{ id: "d1", kind: "W-2", source: "imported-ocr", fields: [{ label: "Box 1", value: "10000", confidence: "needs-review" }], addedAt: 1 }],
  });
  const codes = validateProject(p).map((x) => x.code);
  assert.ok(codes.includes("unconfirmed-ocr"));
  assert.ok(codes.includes("high-deductions"));
});

// ── audit-READY packet ──────────────────────────────────────
test("packet includes the honest disclaimer, citations, and checklists", () => {
  const p = base({ income: [{ label: "Wages", amountCents: 5000000, confidence: "confirmed-document" }] });
  const md = buildPacket(p, VERIFIED_PACK);
  assert.match(md, /not tax advice/i);
  assert.match(md, /not a guarantee of correctness/i);
  assert.match(md, /Record-retention checklist/);
  assert.match(md, /irs\.gov/);
  assert.ok(!/audit-?proof/i.test(md), "must never claim audit-proof");
});

// ── privacy: real local encryption ──────────────────────────
test("project encryption round-trips; wrong passphrase fails; tamper detected", () => {
  const p = base({ taxpayerName: "Baghdo", income: [{ label: "Wages", amountCents: 4200000, confidence: "confirmed-document" }] });
  const blob = encryptProject(p, "correct horse battery");
  assert.ok(!/Baghdo/.test(Buffer.from(blob, "base64").toString("latin1")), "name never in plaintext");
  assert.deepEqual(decryptProject(blob, "correct horse battery"), p);
  assert.throws(() => decryptProject(blob, "wrong passphrase"), /Wrong passphrase/);
  assert.throws(() => encryptProject(p, "short"), /at least 8/);
  const tampered = blob.slice(0, -4) + "AAAA";
  assert.throws(() => decryptProject(tampered, "correct horse battery"));
});

// ── the shipped template asserts no figures ─────────────────
test("the template rule pack ships with ZERO authoritative figures", () => {
  const raw = JSON.parse(readFileSync("builder/tax/rule-packs/_template.json", "utf8"));
  delete raw._README;
  const pack = rulePack.parse(raw);
  assert.equal(pack.status, "template");
  assert.ok(pack.figures.length > 0);
  for (const f of pack.figures) {
    assert.equal(f.value, null, `${f.key} must ship empty`);
    assert.equal(f.verified, false);
    assert.match(f.source, /irs\.gov/);
  }
});

// ── subsequent-year updater / scaffolder ────────────────────
test("a new tax year scaffolds an EMPTY, cited, unverified pack — never inherits amounts", async () => {
  const { scaffoldRulePack, isPackReady, packReadiness, updateGuidanceFor } = await import("../tax/updater.ts");
  const pack2028 = scaffoldRulePack(2028);
  assert.equal(pack2028.taxYear, 2028);
  assert.equal(pack2028.status, "template");
  assert.equal(isPackReady(pack2028), false);
  for (const f of pack2028.figures) {
    assert.equal(f.value, null);
    assert.equal(f.verified, false);
    assert.match(f.source, /irs\.gov/);
  }
  // inheriting structure from a prior verified pack keeps KEYS, drops VALUES
  const next = scaffoldRulePack(2029, VERIFIED_PACK);
  assert.ok(next.figures.some((f) => f.key === "std_deduction_single"));
  assert.equal(next.figures.find((f) => f.key === "std_deduction_single")!.value, null, "must NOT carry last year's number");
  assert.equal(next.figures.find((f) => f.key === "std_deduction_single")!.verified, false);

  // guidance opens official pages and never promises figures
  const g = updateGuidanceFor(2028);
  assert.ok(g.sources.every((sxc) => sxc.url.startsWith("https://www.irs.gov")));
  assert.ok(g.steps.some((step) => /verified/i.test(step)));

  // readiness banner is honest
  const r = packReadiness(pack2028);
  assert.equal(r.ready, false);
  assert.match(r.message, /needs review/i);
});
