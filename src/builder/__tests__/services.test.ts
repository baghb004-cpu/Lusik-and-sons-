import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { servicesSelectionSchema, checklistMarkdown, SERVICES_PATH } from "../presets/selection.ts";
import { validateDocument } from "../server/validateDoc.ts";
import { stackDefaults, stackById } from "../presets/index.ts";

test("the seeded services.json is the validated Lusik production stack", async () => {
  const raw = JSON.parse(readFileSync(join(process.cwd(), "builder/data/services.json"), "utf8"));
  const parsed = servicesSelectionSchema.safeParse(raw);
  assert.equal(parsed.success, true);
  assert.deepEqual(await validateDocument(SERVICES_PATH, raw), []);
  assert.ok(raw.selection.includes("netlify") && raw.selection.includes("stripe-checkout"));
});

test("the save gate refuses broken selections", async () => {
  const base = { schemaVersion: 1, stack: null, selection: ["geocities"] };
  const unknown = await validateDocument(SERVICES_PATH, base);
  assert.ok(unknown.some((i) => /Unknown preset/.test(i.message)));

  const twoHosts = await validateDocument(SERVICES_PATH, { ...base, selection: ["netlify", "vercel"] });
  assert.ok(twoHosts.some((i) => /Only one hosting/.test(i.message)));

  const orphanCapability = await validateDocument(SERVICES_PATH, { ...base, selection: ["admin-notifications"] });
  assert.ok(orphanCapability.some((i) => /needs one of/.test(i.message)));
});

test("checklistMarkdown: accounts, env vars, secrets, ordered steps, the honesty footer", () => {
  const md = checklistMarkdown(stackDefaults(stackById("small-business-shop")!), "small-business-shop");
  assert.match(md, /# Setup checklist/);
  assert.match(md, /Stack: \*\*Small business shop\*\*/);
  assert.match(md, /- \[ \] `STRIPE_SECRET_KEY` \(required\)/);
  assert.match(md, /- \[ \] `DATABASE_URL` \(required\)/);
  assert.match(md, /## ⚠ Secret keys/);
  assert.match(md, /## Netlify/);
  assert.match(md, /1\. Create a free account at netlify.com/);
  assert.match(md, /Recommendations are informational — any provider works; nothing here locks you in/);
});
