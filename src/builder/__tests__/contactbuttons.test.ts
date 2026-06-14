// Call / Text / Email block: gates, tap-to-action hrefs, descriptions.
import { test } from "node:test";
import assert from "node:assert/strict";
import { blockSchema } from "../schema/index.ts";
import { FIELD_HELP } from "../editor/introspect.ts";

const ok = (props: unknown) => blockSchema.safeParse({ id: "b_contact0001", type: "contactButtons", props });

test("contactButtons: at least one channel required; numbers/email gated", () => {
  assert.equal(ok({ phone: "555-123-4567" }).success, true);
  assert.equal(ok({ sms: "+1 (555) 123-4567" }).success, true);
  assert.equal(ok({ email: "hello@example.com" }).success, true);
  assert.equal(ok({ phone: "555-123-4567", sms: "555-123-4567", email: "hello@example.com", style: "icons" }).success, true);
  assert.equal(ok({}).success, false); // nothing to contact
  assert.equal(ok({ email: "not-an-email" }).success, false);
  assert.equal(ok({ phone: "abc" }).success, false);
  assert.equal(ok({ callLabel: { _i18n: { en: "Call us", hy: "Զանգիր" } }, phone: "555-1234" }).success, true);
});

test("every contact option has a plain-language description in the form", () => {
  for (const key of ["contactButtons.phone", "contactButtons.sms", "contactButtons.email", "contactButtons.style"]) {
    assert.ok((FIELD_HELP[key] ?? "").length > 25, key);
  }
  assert.match(FIELD_HELP["contactButtons.phone"], /dial|call/i);
});
