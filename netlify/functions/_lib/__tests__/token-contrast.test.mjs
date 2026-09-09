// ============================================================
// TOKEN CONTRAST GATE
// ============================================================
// SITE_OVERHAUL_HANDOFF.md 11.2 asks for "a unit test [that] runs the
// whole token set through a contrast checker in both atmospheres and
// fails on any regression". This is that test.
//
// It reads the real stylesheet — not a copy of the values — so a token
// edited in src/styles/index.css is what gets scored. Every pair below
// is a pairing the UI actually makes; the gate each is held to is the
// one the plan sets: AAA (7:1) for running body copy, AA (4.5:1) for
// any other text, and 3:1 for a boundary that identifies a control.
//
// If you are here because this test went red: the fix is almost never
// to lower a gate. It is to pick the token that matches the ground.
// The three that exist for exactly that reason:
//   --accent-text     gold text on a normal page surface
//   --accent-on-ink   gold text on an --ink panel (which INVERTS by theme)
//   --text-on-accent  text on a gold fill
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { contrastRatio, GATES } from "../../../../src/lib/contrast.js";

const here = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(resolve(here, "../../../../src/styles/index.css"), "utf8");

/** Pull the custom properties out of one selector's first block. */
function tokens(selector) {
  const start = CSS.indexOf(selector + " {");
  assert.notEqual(start, -1, `stylesheet has no "${selector} {" block — did the token block move?`);
  const end = CSS.indexOf("\n  }", start);
  const body = CSS.slice(start, end);
  const out = {};
  for (const m of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    out[m[1]] = m[2].trim().replace(/\s*\/\*[\s\S]*$/, "").trim();
  }
  return out;
}

const ATMOSPHERES = {
  // "Morning at the table" — the default light look.
  light: tokens(":root"),
  // "Evening at the table" — warm dark, not stark black.
  dark: tokens(':root[data-theme="dark"]'),
};

// [foreground token, background token, gate, what this pairing is]
const PAIRS = [
  ["--text-primary", "--bg-page", GATES.bodyAAA, "body copy on the page"],
  ["--text-primary", "--bg-surface", GATES.bodyAAA, "body copy on a card"],
  ["--text-primary", "--bg-elevated", GATES.bodyAAA, "body copy in the footer"],
  ["--text-primary", "--bg-subtle", GATES.bodyAAA, "body copy on a hover row"],
  ["--text-primary", "--bg-canvas", GATES.bodyAAA, "body copy on the mobile canvas"],
  ["--text-secondary", "--bg-page", GATES.bodyAAA, "running paragraphs"],
  ["--text-secondary", "--bg-surface", GATES.bodyAAA, "running paragraphs on a card"],
  ["--text-muted", "--bg-page", GATES.uiAA, "captions and meta"],
  ["--text-muted", "--bg-surface", GATES.uiAA, "captions on a card"],
  ["--text-muted", "--bg-elevated", GATES.uiAA, "footer meta"],
  ["--text-muted", "--bg-canvas", GATES.uiAA, "mobile nav labels"],
  ["--text-on-ink", "--ink", GATES.uiAA, "the Pay button"],
  ["--accent-text", "--bg-page", GATES.uiAA, "gold eyebrows on the page"],
  ["--accent-text", "--bg-surface", GATES.uiAA, "gold on a card"],
  ["--accent-text", "--bg-subtle", GATES.uiAA, "gold on a hover row"],
  ["--accent-text", "--bg-elevated", GATES.uiAA, "gold in the footer"],
  ["--accent-on-ink", "--ink", GATES.uiAA, "gold on an ink panel (inverts by theme)"],
  ["--text-on-accent", "--accent", GATES.uiAA, "the cart-count badge"],
  ["--success", "--bg-page", GATES.uiAA, "success text"],
  ["--success", "--bg-surface", GATES.uiAA, "success text on a card"],
  ["--error", "--bg-page", GATES.uiAA, "error text"],
  ["--error", "--bg-surface", GATES.uiAA, "error text on a card"],
  ["--error", "--error-soft", GATES.uiAA, "error text in its own tinted panel"],
  ["--border-strong", "--bg-page", GATES.nonTextAA, "the edge of an input on the page"],
  ["--border-strong", "--bg-surface", GATES.nonTextAA, "the edge of an input on a card"],
  ["--border-strong", "--bg-elevated", GATES.nonTextAA, "the edge of a control in the footer"],
];

for (const [name, set] of Object.entries(ATMOSPHERES)) {
  test(`${name} atmosphere: every token pairing clears its gate`, () => {
    const failures = [];
    for (const [fg, bg, gate, what] of PAIRS) {
      assert.ok(set[fg], `${name}: token ${fg} is not defined`);
      assert.ok(set[bg], `${name}: token ${bg} is not defined`);
      const ratio = contrastRatio(set[fg], set[bg], set["--bg-page"]);
      assert.ok(ratio !== null, `${name}: could not parse ${fg} (${set[fg]}) or ${bg} (${set[bg]})`);
      if (ratio < gate) {
        failures.push(`  ${what}: ${fg} (${set[fg]}) on ${bg} (${set[bg]}) = ${ratio.toFixed(2)}:1, needs ${gate}:1`);
      }
    }
    assert.equal(failures.length, 0, `${name} atmosphere contrast failures:\n${failures.join("\n")}`);
  });
}

test("both atmospheres define the same token names", () => {
  const l = Object.keys(ATMOSPHERES.light).sort();
  const d = Object.keys(ATMOSPHERES.dark).sort();
  const missingInDark = l.filter((k) => !d.includes(k) && k !== "color-scheme");
  // A token defined only in light silently keeps its light value in dark —
  // which is how the mega-menu ended up cream-on-cream.
  assert.deepEqual(missingInDark, [], `tokens missing a dark value: ${missingInDark.join(", ")}`);
});

test("--accent is documented as non-text on light grounds", () => {
  // Guard the trap directly: the brand gold is deliberately BELOW AA as text
  // on cream. If someone "fixes" that by brightening --accent-text or by
  // pointing text at --accent, this test says why not.
  const r = contrastRatio(ATMOSPHERES.light["--accent"], ATMOSPHERES.light["--bg-page"], ATMOSPHERES.light["--bg-page"]);
  assert.ok(r < GATES.uiAA, "--accent now passes AA on cream; if that is deliberate, retire --accent-text");
  const rt = contrastRatio(ATMOSPHERES.light["--accent-text"], ATMOSPHERES.light["--bg-page"], ATMOSPHERES.light["--bg-page"]);
  assert.ok(rt >= GATES.uiAA, "--accent-text must stay the AA-safe gold for text on light grounds");
});
