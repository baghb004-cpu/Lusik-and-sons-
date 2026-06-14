// Tax Assistant — state rule-pack scaffolder + filing helpers (§25 Phases 5-6).
// Safety contract: a scaffolded pack NEVER contains a guessed/verified figure;
// the filing helpers only ever point at official irs.gov pages (no e-file).
import { test } from "node:test";
import assert from "node:assert/strict";

import { scaffoldStatePack, stateGuidanceFor, freeFileGuidance, printAndMailGuidance, STATE_DIRECTORY_URL } from "../tax/updater.ts";
import { rulePack } from "../tax/schemas.ts";

test("state scaffold: valid pack, every figure empty + unverified (never guessed)", () => {
  const pack = scaffoldStatePack("ca", 2024);
  assert.doesNotThrow(() => rulePack.parse(pack));
  assert.equal(pack.jurisdiction, "us-ca");
  assert.equal(pack.status, "template");
  assert.ok(pack.figures.length > 0);
  for (const f of pack.figures) {
    assert.equal(f.value, null, `${f.key} must be empty`);
    assert.equal(f.verified, false, `${f.key} must be unverified`);
    assert.match(f.source, /^https:\/\/www\.irs\.gov\//, "cited to an official source");
  }
  assert.throws(() => scaffoldStatePack("", 2024), /state code/);
});

test("state scaffold: custom figure keys + percent units for tax rates", () => {
  const pack = scaffoldStatePack("ny", 2024, ["state-income-tax", "state-standard-deduction"]);
  assert.equal(pack.figures.find((f) => f.key === "state-income-tax")?.unit, "percent");
  assert.equal(pack.figures.find((f) => f.key === "state-standard-deduction")?.unit, "usd");
});

test("filing helpers: official IRS links only, never an e-file action", () => {
  const sg = stateGuidanceFor("ca", 2024);
  assert.equal(sg.sources[0].url, STATE_DIRECTORY_URL);
  assert.ok(sg.steps.some((s) => /verify/i.test(s)));

  const ff = freeFileGuidance(2024);
  assert.ok(ff.sources.every((s) => s.url.startsWith("https://www.irs.gov/")));
  assert.ok(ff.steps.some((s) => /never files for you/i.test(s)));

  const pm = printAndMailGuidance(2024);
  assert.ok(pm.sources.every((s) => s.url.startsWith("https://www.irs.gov/")));
  assert.ok(pm.steps.some((s) => /does not mail or submit/i.test(s)));
});
