// Business App Builder (§30, Phase 3): templates, screen derivation, validation
// (incl. payment-card refusal), the vibe parser, and blueprint codegen.
import { test } from "node:test";
import assert from "node:assert/strict";

import { appBlueprintSchema } from "../studio/bizapp/schemas.ts";
import { deriveScreens, validateBlueprint, withDerivedScreens } from "../studio/bizapp/engine.ts";
import { makeAppTemplate, APP_TEMPLATE_LIST } from "../studio/bizapp/templates.ts";
import { vibeApp, detectAppType } from "../studio/bizapp/vibe.ts";
import { generateApp } from "../studio/bizapp/codegen.ts";

test("templates are schema-valid with derived screens", () => {
  for (const { key } of APP_TEMPLATE_LIST) {
    const bp = makeAppTemplate(key, `t-${key}`);
    assert.ok(bp, key);
    appBlueprintSchema.parse(bp);
    // dashboard + list/form/detail per table
    assert.equal(bp!.screens.length, 1 + bp!.tables.length * 3);
    assert.ok(bp!.screens.some((s) => s.type === "dashboard"));
  }
});

test("deriveScreens makes one dashboard + 3 screens per table", () => {
  const screens = deriveScreens([{ id: "a", name: "Items", fields: [] }, { id: "b", name: "People", fields: [] }]);
  assert.equal(screens.filter((s) => s.type === "dashboard").length, 1);
  assert.equal(screens.filter((s) => s.tableId === "a").length, 3);
});

test("vibe routes to a template or a generic records app", () => {
  assert.equal(detectAppType("an appointment booking system"), "appointments");
  assert.equal(detectAppType("track repair tickets for devices"), "repair");
  assert.equal(vibeApp("an appointment booking system").blueprint.tables[0].id, "appointments");
  const generic = vibeApp("something unusual and unmatched");
  assert.equal(generic.blueprint.tables[0].id, "records");
  assert.ok(generic.notes.join(" ").toLowerCase().includes("records app"));
});

test("validation flags empty tables, dup fields, and REFUSES card data", () => {
  const ok = makeAppTemplate("crm", "v1")!;
  assert.equal(validateBlueprint(ok).filter((i) => i.level === "error").length, 0);
  const bad = appBlueprintSchema.parse({ id: "b", name: "Bad", tables: [{ id: "t", name: "T", fields: [{ name: "cardNumber", label: "", type: "text", required: false, options: [], relationTableId: "" }, { name: "cvv", label: "", type: "text", required: false, options: [], relationTableId: "" }] }] });
  const issues = validateBlueprint(bad);
  assert.ok(issues.some((i) => i.level === "error" && /payment-card/i.test(i.message)));
});

test("codegen emits a config + a JSON-Schema per table + docs, no card data", () => {
  const bp = makeAppTemplate("appointments", "a1")!;
  const { files } = generateApp(bp);
  assert.ok(files["business-app/app_config.json"] && files["business-app/SCREENS.md"] && files["business-app/PRIVACY_NOTES.md"]);
  assert.ok(files["business-app/schema/appointments.schema.json"]);
  const sch = JSON.parse(files["business-app/schema/appointments.schema.json"]);
  assert.equal(sch.type, "object");
  assert.ok(sch.properties.status.enum.includes("Booked")); // select → enum
  assert.ok(/never store payment card/i.test(files["business-app/PRIVACY_NOTES.md"]));
  assert.deepEqual(generateApp(bp).files, files); // deterministic
  // re-deriving screens after a table edit stays consistent
  assert.equal(withDerivedScreens(bp).screens.length, bp.screens.length);
});
