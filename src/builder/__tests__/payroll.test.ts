// Payroll / self-employment tax calculator (§27): the SE-tax math is
// hand-checked against IRS Schedule SE; the safety design (stable rates
// vs the year-specific wage base) and the one-click updater are verified.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { ratePack, payrollInput, computePayroll, payrollUpdateGuidance, scaffoldRatePack, ratePackReadiness, type RatePack } from "../payroll/index.ts";

const PACK = (over: Partial<RatePack> = {}): RatePack =>
  ratePack.parse({ taxYear: 2026, officialSource: "https://www.irs.gov/businesses/small-businesses-self-employed/self-employment-tax-social-security-and-medicare-taxes", ...over });

const dollars = (cents: number) => cents / 100;

// ── the headline case: a 1099 contractor under the cap ──────
test("1099 SE tax matches Schedule SE by hand ($50,000 profit)", () => {
  // net earnings = 50000 * 0.9235 = 46175
  // SS  = 46175 * 0.124  = 5725.70
  // Med = 46175 * 0.029  = 1339.075
  // SE tax = 7064.775 ; half = 3532.39
  const r = computePayroll(payrollInput.parse({ scenario: "self-employed-1099", amount: 50000 }), PACK());
  const seTax = r.lines.find((l) => l.label === "Self-employment tax total")!;
  assert.equal(Math.round(dollars(seTax.cents) * 100) / 100, 7064.78);
  assert.equal(Math.round(dollars(r.deductibleHalfCents) * 100) / 100, 3532.39);
  // no income-tax rate given → 30% cushion guidance, and set-aside ≥ SE tax
  assert.ok(dollars(r.setAsideCents) >= 7064.77);
  assert.ok(r.warnings.some((w) => /cushion|income-tax rate/i.test(w)));
  assert.equal(r.quarterlyCents, Math.round(r.setAsideCents / 4));
});

test("1099 with an income-tax rate gives SE tax + income tax exactly", () => {
  // half SE deduction reduces the income-tax base: (50000 - 3532.39) * 0.12
  const r = computePayroll(payrollInput.parse({ scenario: "self-employed-1099", amount: 50000, incomeTaxRate: 0.12 }), PACK());
  const incomeLine = r.lines.find((l) => l.label.startsWith("Income tax estimate"))!;
  assert.equal(Math.round(dollars(incomeLine.cents) * 100) / 100, Math.round((50000 - 3532.39) * 0.12 * 100) / 100);
  // set-aside = SE tax (7064.78) + the income-tax estimate, to the cent
  assert.equal(r.setAsideCents, 706478 + incomeLine.cents);
});

// ── Medicare is exact without the wage base; SS is flagged ──
test("under the cap is exact; high earner without a verified wage base is flagged approximate", () => {
  const low = computePayroll(payrollInput.parse({ scenario: "self-employed-1099", amount: 40000 }), PACK());
  assert.equal(low.approximate, true); // wage base not verified → honest flag
  assert.ok(low.warnings.some((w) => /Social Security wage|cap/i.test(w)));
  // with a verified wage base, the SS portion caps and approximate clears
  const withBase = computePayroll(
    payrollInput.parse({ scenario: "self-employed-1099", amount: 300000 }),
    PACK({ socialSecurityWageBase: 168600, socialSecurityWageBaseVerified: true })
  );
  assert.equal(withBase.approximate, false);
  // SS capped: 168600 * 0.124 = 20906.40 ; net earnings = 277050 → Medicare on full
  const ss = withBase.lines.find((l) => l.label.startsWith("Social Security"))!;
  assert.equal(Math.round(dollars(ss.cents) * 100) / 100, 20906.4);
  // additional Medicare kicks in over $200k (single)
  assert.ok(withBase.lines.some((l) => l.label.startsWith("Extra Medicare")));
});

// ── other scenarios ─────────────────────────────────────────
test("W-2 employee shows the employee half; employer-cost shows the match", () => {
  const w2 = computePayroll(payrollInput.parse({ scenario: "w2-employee", amount: 100000 }), PACK());
  // SS 6.2% of 100k = 6200 ; Medicare 1.45% = 1450
  assert.equal(dollars(w2.lines.find((l) => l.label.startsWith("Social Security"))!.cents), 6200);
  assert.equal(dollars(w2.lines.find((l) => l.label.startsWith("Medicare"))!.cents), 1450);
  assert.equal(w2.deductibleHalfCents, 0); // no SE deduction for W-2

  const emp = computePayroll(payrollInput.parse({ scenario: "employer-cost", amount: 100000 }), PACK());
  assert.equal(dollars(emp.setAsideCents), 7650); // 6200 + 1450
});

test("pay interval annualizes for the cap, per-payment + quarterly split out", () => {
  const monthly = computePayroll(payrollInput.parse({ scenario: "self-employed-1099", amount: 5000, interval: "monthly" }), PACK());
  assert.equal(dollars(monthly.annualizedAmountCents), 60000); // 5000 * 12
  assert.equal(monthly.perPaymentCents, Math.round(monthly.setAsideCents / 12));
});

// ── ease of use: every line has a plain explanation ─────────
test("every result line carries a five-year-old-simple explanation", () => {
  const r = computePayroll(payrollInput.parse({ scenario: "self-employed-1099", amount: 50000 }), PACK());
  for (const l of r.lines) assert.ok(l.plain.length > 15, l.label);
});

// ── updater / dataset ───────────────────────────────────────
test("the updater opens official sources and scaffolds a year without inheriting the wage base", () => {
  const g = payrollUpdateGuidance(2027);
  assert.ok(g.sources.some((s) => /ssa\.gov/.test(s.url))); // official SS wage base
  assert.ok(g.sources.every((s) => s.url.startsWith("https://")));
  const prev = PACK({ socialSecurityWageBase: 168600, socialSecurityWageBaseVerified: true });
  const next = scaffoldRatePack(2027, prev);
  assert.equal(next.taxYear, 2027);
  assert.equal(next.socialSecurityWageBase, null, "must NOT carry last year's cap");
  assert.equal(next.socialSecurityWageBaseVerified, false);
  assert.equal(next.socialSecurityRateSelf, 0.124); // stable percentages DO carry
  assert.equal(ratePackReadiness(next).ready, false);
  assert.equal(ratePackReadiness(prev).ready, true);
});

// ── the shipped dataset ─────────────────────────────────────
test("the starter rate pack ships stable percentages but NO wage base", () => {
  const raw = JSON.parse(readFileSync("builder/payroll/rate-packs/_defaults.json", "utf8"));
  delete raw._README;
  const pack = ratePack.parse(raw);
  assert.equal(pack.socialSecurityRateSelf, 0.124);
  assert.equal(pack.netEarningsFactor, 0.9235);
  assert.equal(pack.socialSecurityWageBase, null); // year-specific → user enters it
  assert.equal(pack.socialSecurityWageBaseVerified, false);
});
