// Creation Studio hub (§30, Phase 1): the tool registry is coherent — unique,
// app-relative hrefs and every tool lands in a real group.
import { test } from "node:test";
import assert from "node:assert/strict";

import { STUDIO_TOOLS, STUDIO_GROUPS } from "../studio/tools.ts";

test("registry: hrefs are unique + app-relative, names are present", () => {
  const hrefs = STUDIO_TOOLS.map((t) => t.href);
  assert.equal(new Set(hrefs).size, hrefs.length, "no duplicate hrefs");
  for (const t of STUDIO_TOOLS) {
    assert.ok(t.href.startsWith("/"), `${t.href} is app-relative`);
    assert.ok(!/^https?:/.test(t.href), `${t.href} is not external`);
    assert.ok(t.name.length > 0 && t.blurb.length > 0);
  }
});

test("registry: every tool has a known group + every group has tools", () => {
  const groupIds = new Set(STUDIO_GROUPS.map((g) => g.id));
  for (const t of STUDIO_TOOLS) assert.ok(groupIds.has(t.group), `${t.name} group is valid`);
  for (const g of STUDIO_GROUPS) assert.ok(STUDIO_TOOLS.some((t) => t.group === g.id), `group ${g.id} has tools`);
});
