// The floating ▲/▼ section navigator (plan §18) — schema contract,
// publish rules, the inline enhancement script's promises, i18n
// labels, and the native SwiftUI translation.
import { test } from "node:test";
import assert from "node:assert/strict";

import { blockSchema, BLOCK_TYPES, type Block } from "../schema/index.ts";
import { validatePage } from "../engine/validate.ts";
import { localizeBlocks } from "../i18n/index.ts";
import {
  JUMPER_STOP_SELECTORS,
  jumperDomId,
  sectionJumperScript,
  sectionJumperCss,
} from "../renderer/jumperScript.ts";
import { pageToSwiftView } from "../export/swiftui.ts";
import { makePage } from "./fixtures.ts";

const ok = (props: unknown, id = "b_jump00000001") =>
  blockSchema.safeParse({ id, type: "sectionJumper", props });

// ── schema ──────────────────────────────────────────────────
test("sectionJumper: registered; defaults-empty props validate; enums gated", () => {
  assert.ok(BLOCK_TYPES.sectionJumper, "must be in the registry");
  assert.equal(ok({}).success, true); // everything optional
  assert.equal(ok({ edge: "right", align: "lower", size: "lg", stops: "headings", accent: "#E58900" }).success, true);
  assert.equal(ok({ edge: "top" }).success, false); // not an edge
  assert.equal(ok({ size: "xl" }).success, false);
  assert.equal(ok({ accent: "orange" }).success, false); // hex only — it lands in a <style>
  assert.equal(ok({ stops: "div.anything" }).success, false); // no arbitrary selectors
  assert.equal(ok({ onClick: "x" }).success, false); // strict
});

test("sectionJumper: a11y labels are translatable (string or i18n map)", () => {
  assert.equal(ok({ upLabel: "Previous section" }).success, true);
  assert.equal(ok({ downLabel: { _i18n: { en: "Next section", hy: "Հաջորդ բաժինը" } } }).success, true);
});

// ── publish rules ───────────────────────────────────────────
function pageWith(extra: Block[]): unknown {
  const base = makePage();
  return { ...base, sections: [...base.sections, ...extra] };
}

test("validate: one top-level jumper on a multi-section page is clean", () => {
  const r = validatePage(pageWith([{ id: "b_jump00000001", type: "sectionJumper", props: {} }]));
  assert.equal(r.publishable, true);
  assert.ok(!r.issues.some((i) => i.code.startsWith("jumper_") && i.level === "error"));
});

test("validate: a second jumper is a publish error", () => {
  const r = validatePage(
    pageWith([
      { id: "b_jump00000001", type: "sectionJumper", props: {} },
      { id: "b_jump00000002", type: "sectionJumper", props: {} },
    ])
  );
  assert.equal(r.publishable, false);
  assert.ok(r.issues.some((i) => i.code === "jumper_multiple" && i.blockId === "b_jump00000002"));
});

test("validate: a nested jumper is a publish error", () => {
  const base = makePage();
  const sections = structuredClone(base.sections) as Block[];
  const container = sections.find((b) => b.children);
  assert.ok(container, "fixture needs a container section");
  container!.children!.push({ id: "b_jump00000003", type: "sectionJumper", props: {} });
  const r = validatePage({ ...base, sections });
  assert.equal(r.publishable, false);
  assert.ok(r.issues.some((i) => i.code === "jumper_nested"));
});

test("validate: fewer than two sections → warning, still publishable", () => {
  const base = makePage();
  const one = (base.sections as Block[]).filter((b) => b.type === "section").slice(0, 1);
  const r = validatePage({ ...base, sections: [...one, { id: "b_jump00000004", type: "sectionJumper", props: {} }] });
  assert.ok(r.issues.some((i) => i.code === "jumper_few_sections" && i.level === "warning"));
  assert.equal(r.publishable, true);
});

// ── the inline script's promises ────────────────────────────
test("script: id-scoped, un-hides the nav, honors reduced motion, no eval", () => {
  const js = sectionJumperScript("b_jump00000001");
  assert.ok(js.includes(`getElementById("sj_b_jump00000001")`), "scoped to this block's nav only");
  assert.match(js, /nav\.hidden=false/); // progressive: no JS → nav never appears
  assert.match(js, /prefers-reduced-motion: reduce/);
  assert.match(js, /behavior:rm\?"auto":"smooth"/); // instant jump when reduced
  assert.ok(!/\beval\(|new Function|innerHTML\s*=/.test(js), "no dynamic code paths");
  assert.match(js, /dataset\.sjInit/); // idempotent if somehow run twice
});

test("script + css: stop selectors come from the fixed map, never user input", () => {
  assert.deepEqual(Object.keys(JUMPER_STOP_SELECTORS).sort(), ["headings", "sections"]);
  assert.equal(jumperDomId("b_jump00000001"), "sj_b_jump00000001");
  const css = sectionJumperCss("b_jump00000001");
  assert.match(css, /var\(--bt-color-accent, #B08842\)/); // theme accent by default
  // no-JS guard: the nav's display classes must not beat [hidden]
  assert.match(css, /#sj_b_jump00000001\[hidden\]\{display:none !important;\}/);
  assert.match(css, /\[data-pos="bottom"\] \[data-jump="next"\]\{opacity:\.45;\}/); // dead end dims
  assert.match(sectionJumperCss("b_jump00000001", "#E58900"), /background:#E58900/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

// ── i18n ────────────────────────────────────────────────────
test("localize resolves the jumper's a11y labels per locale", () => {
  const blocks: Block[] = [
    {
      id: "b_jump00000001",
      type: "sectionJumper",
      props: { upLabel: { _i18n: { en: "Previous section", hy: "Նախորդ բաժինը" } } },
    },
  ];
  const hy = localizeBlocks(blocks, "hy", "en");
  assert.equal((hy[0].props as { upLabel: string }).upLabel, "Նախորդ բաժինը");
});

// ── SwiftUI translation ─────────────────────────────────────
test("swiftui: a jumper page becomes ScrollViewReader + SectionJumperControl with id()-tagged sections", () => {
  const base = makePage();
  const page = { ...base, sections: [...base.sections, { id: "b_jump00000001", type: "sectionJumper", props: {} }] };
  const swift = pageToSwiftView(page as never);
  assert.match(swift, /ScrollViewReader \{ proxy in/);
  assert.match(swift, /SectionJumperControl\(proxy: proxy, count: \d+\)/);
  assert.match(swift, /\.id\(0\)/);
  assert.ok(!swift.includes("not yet available natively"), "real mapping, not a placeholder");
});

test("swiftui: pages without a jumper keep the original simple shape", () => {
  const swift = pageToSwiftView(makePage() as never);
  assert.ok(!swift.includes("ScrollViewReader"));
  assert.ok(!swift.includes("SectionJumperControl"));
});
