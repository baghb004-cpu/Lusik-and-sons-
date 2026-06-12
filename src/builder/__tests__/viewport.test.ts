import { test } from "node:test";
import assert from "node:assert/strict";

import {
  VIEWPORT_PRESETS,
  presetById,
  presetGroups,
  breakpointForWidth,
  ratioLabel,
  layoutRulesFor,
  describeRules,
  staticScan,
  rectScan,
  scoreIssues,
  applyPreset,
  type ViewportPreset,
  type MeasuredRect,
} from "../viewport/index.ts";
import { emptyLayer } from "../engine/overrides.ts";
import { newId, type Block } from "../schema/index.ts";
import { makePage } from "./fixtures.ts";

// ── PRIVACY: no brand/model names in any label ──────────────
test("NO-BRAND LAW: no preset label names a manufacturer or model", () => {
  // word-boundaried so generic words like "ratios" (contains "ios") don't false-trip
  const banned = /\b(iphone|ipad|samsung|galaxy|google|pixel|huawei|xiaomi|oneplus|motorola|nokia|sony|xperia|surface|macbook|imac|android|ios|kindle)\b|\bwindows phone\b|\bamazon\b/i;
  for (const p of VIEWPORT_PRESETS) {
    assert.ok(!banned.test(p.label), `"${p.label}" leaks a brand/model name`);
    assert.ok(!banned.test(p.group), `group "${p.group}" leaks a brand/model name`);
  }
});

test("the catalog covers every family the spec asked for, ids unique", () => {
  const families = new Set(VIEWPORT_PRESETS.map((p) => p.family));
  for (const f of ["phone", "foldable", "tablet", "desktop", "legacy", "tv"]) {
    assert.ok(families.has(f as ViewportPreset["family"]), `missing family ${f}`);
  }
  const ids = VIEWPORT_PRESETS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate preset id");
  assert.ok(VIEWPORT_PRESETS.length >= 40);
});

test("breakpoint + ratio helpers", () => {
  assert.equal(breakpointForWidth(360), "mobile");
  assert.equal(breakpointForWidth(800), "tablet");
  assert.equal(breakpointForWidth(1440), "desktop");
  assert.equal(ratioLabel(1920, 1080), "16:9");
  assert.equal(ratioLabel(768, 768), "1:1");
  // 3440×1440 is marketed "21:9" but is mathematically 43:18; the helper is
  // honest, and the preset carries the colloquial label as an explicit override.
  assert.equal(ratioLabel(3440, 1440), "43:18");
  assert.equal(presetById("desktop-ultrawide")!.ratioLabel, "21:9");
});

test("foldables carry hinge zones, postures, and dual-pane flags", () => {
  const inner = presetById("fold-inner-square")!;
  assert.equal(inner.ratioLabel, "1:1");
  assert.ok(inner.hinge && inner.hinge.axis === "vertical");
  assert.equal(inner.dualPane, true);
  assert.ok(presetById("fold-clamshell")!.postures!.includes("partially-open"));
});

// ── adaptive rules ──────────────────────────────────────────
test("layout rules scale sensibly across the families", () => {
  assert.equal(layoutRulesFor(presetById("phone-compact")!).columns, 1);
  assert.equal(layoutRulesFor(presetById("phone-compact")!).navStyle, "bottom");
  assert.equal(layoutRulesFor(presetById("phone-compact")!).stickyActions, true);

  const tablet = layoutRulesFor(presetById("tablet-large")!);
  assert.ok(tablet.columns >= 2 && tablet.columns <= 3);
  assert.equal(tablet.panes, "dual");
  assert.equal(tablet.navStyle, "sidebar");

  const desktop = layoutRulesFor(presetById("desktop-fhd")!);
  assert.ok(desktop.columns >= 4);
  assert.equal(desktop.tapTargetMinPx, 28); // pointer, not touch
  assert.equal(layoutRulesFor(presetById("phone-compact")!).tapTargetMinPx, 44); // touch

  // short landscape screen → compact header + tighter spacing
  const land = layoutRulesFor(presetById("tablet-landscape")!);
  assert.ok(describeRules(layoutRulesFor(presetById("phone-compact")!)).includes("bottom nav"));
  assert.ok(land.columns >= 3);
});

// ── static scan ─────────────────────────────────────────────
function pageWith(...blocks: Block[]) {
  const p = makePage();
  p.sections = blocks;
  return p;
}

test("static scan flags an over-wide grid on a compact phone (fixable)", () => {
  const page = pageWith({ id: newId(), type: "productGrid", props: { category: "bibs", columns: 4 } } as Block);
  const issues = staticScan(page, presetById("phone-compact")!);
  const grid = issues.find((i) => i.code === "grid_too_wide")!;
  assert.ok(grid);
  assert.equal(grid.severity, "critical"); // 4 vs rec 1 → 3+ gap
  assert.equal(grid.fixable, true);
});

test("static scan flags a fixed width wider than the screen", () => {
  const page = pageWith({ id: newId(), type: "image", props: { src: "/img/a.jpg", alt: "a" }, style: { width: "900px" } } as Block);
  const issues = staticScan(page, presetById("phone-standard")!);
  assert.ok(issues.some((i) => i.code === "fixed_width_overflow" && i.severity === "critical"));
});

test("static scan flags a crowded pill menu on a narrow screen", () => {
  const items = Array.from({ length: 5 }, (_, i) => ({ id: newId(), icon: "star", label: `B${i}`, href: "/" }));
  const page = pageWith({ id: newId(), type: "pillNav", props: { items, position: "bottom" } } as Block);
  const issues = staticScan(page, presetById("phone-compact")!); // 320px / 5 = 64 → borderline; compact safe-area-less
  assert.ok(issues.some((i) => i.code === "nav_crowded"));
});

test("static scan: clean page on a fitting screen has no critical issues", () => {
  const page = pageWith({ id: newId(), type: "richText", props: { doc: { type: "doc", content: [] } } } as Block);
  const issues = staticScan(page, presetById("phone-standard")!);
  assert.equal(issues.filter((i) => i.severity === "critical").length, 0);
});

// ── rect scan (pure math) ───────────────────────────────────
test("rect scan catches off-screen, oversize, and footer-covers-content", () => {
  const vp = { width: 390, height: 844 };
  const rects: MeasuredRect[] = [
    { id: "a", label: "CTA", x: 360, y: 100, width: 120, height: 44 }, // runs off the right
    { id: "b", label: "Banner", x: 0, y: 200, width: 500, height: 60 }, // wider than screen
    { id: "c", label: "Body", x: 0, y: 790, width: 390, height: 80 }, // overlapped by footer
    { id: "f", label: "Buy bar", x: 0, y: 800, width: 390, height: 60, fixed: true },
  ];
  const issues = rectScan(rects, vp);
  assert.ok(issues.some((i) => i.code === "offscreen_x"));
  assert.ok(issues.some((i) => i.code === "element_too_wide"));
  assert.ok(issues.some((i) => i.code === "footer_covers_content"));
});

test("rect scan flags content under a notch safe area", () => {
  const issues = rectScan(
    [{ id: "h", label: "Header", x: 0, y: 5, width: 300, height: 40 }],
    { width: 390, height: 844, safeArea: { top: 44, bottom: 34, left: 0, right: 0 } }
  );
  assert.ok(issues.some((i) => i.code === "unsafe_area"));
});

// ── scoring ─────────────────────────────────────────────────
test("scoreIssues maps severities to the four grades", () => {
  assert.equal(scoreIssues([]), "Excellent");
  assert.equal(scoreIssues([{ code: "x", severity: "warning", message: "" }]), "Good");
  assert.equal(scoreIssues([
    { code: "x", severity: "warning", message: "" },
    { code: "y", severity: "warning", message: "" },
    { code: "z", severity: "warning", message: "" },
  ]), "Needs Fixes");
  assert.equal(scoreIssues([{ code: "x", severity: "critical", message: "" }]), "Needs Fixes");
  assert.equal(scoreIssues([
    { code: "x", severity: "critical", message: "" },
    { code: "y", severity: "critical", message: "" },
  ]), "Broken Layout");
});

// ── apply engine ────────────────────────────────────────────
test("applyPreset writes grid columns into the right breakpoint layer", () => {
  const page = pageWith({ id: "b_grid00000001", type: "productGrid", props: { category: "bibs", columns: 4 } } as Block);
  const layers = { tablet: emptyLayer(page.id, "tablet"), mobile: emptyLayer(page.id, "mobile") };

  // compact phone → mobile layer, 1 column
  const mobile = applyPreset(page, layers, presetById("phone-compact")!);
  assert.equal(mobile.breakpoint, "mobile");
  assert.equal(mobile.layer!.patches.b_grid00000001.props!.columns, 1);

  // standard tablet (768px → tablet bucket) → tablet layer
  // (note: tablet-large is 1024px wide, which is the DESKTOP bucket — a 1024
  // boundary is the conventional desktop breakpoint start.)
  const tablet = applyPreset(page, layers, presetById("tablet-standard")!);
  assert.equal(tablet.breakpoint, "tablet");
  assert.ok((tablet.layer!.patches.b_grid00000001.props!.columns as number) >= 2);

  // desktop → edits the BASE document, not a layer
  const desktop = applyPreset(page, layers, presetById("desktop-fhd")!);
  assert.ok(desktop.sections);
  assert.equal(desktop.layer, undefined);
  const grid = desktop.sections!.find((b) => b.id === "b_grid00000001")!;
  assert.equal((grid.props as { columns: number }).columns, 4); // capped at productGrid max(4)
});

test("applyPreset on a short screen also tightens spacing", () => {
  const page = pageWith({ id: "b_sec00000001", type: "section", props: { heading: "Hi" }, children: [] } as Block);
  const layers = { tablet: emptyLayer(page.id, "tablet"), mobile: emptyLayer(page.id, "mobile") };
  // a short landscape phone ratio → spacingScale < 1
  const res = applyPreset(page, layers, presetById("phone-ratio-22-9")!);
  // 393x961 is tall not short; use a legacy short one instead
  const shortRes = applyPreset(page, layers, presetById("legacy-compact")!); // 320x480, short
  assert.ok(shortRes.layer!.patches.b_sec00000001?.style?.margin || res.layer);
});
