// ============================================================
// LOOM IMPORT SPECIFIERS
// ============================================================
// This repo resolves TypeScript modules WITHOUT an extension and plain
// .js modules WITH one, because that is what webpack does here — a `.js`
// specifier is not remapped onto a `.ts` file.
//
// Getting it wrong does not fail typecheck (tsc's bundler resolution is
// happy either way) and does not fail lint. It fails the production
// build, several minutes in, with "Module not found". That cost three
// separate round trips while building the Loom, so it is a test now.
//
// It is a static property of the source, so it costs nothing to check.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, "../../../../src");

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|js|jsx)$/.test(entry)) out.push(full);
  }
  return out;
}

/** Resolve a relative specifier to the file it actually names. */
function resolveSpecifier(fromFile, spec) {
  const base = resolve(dirname(fromFile), spec);
  const stem = base.endsWith(".js") ? base.slice(0, -3) : base;
  for (const ext of [".ts", ".tsx", ".js", ".jsx"]) {
    if (existsSync(stem + ext)) return stem + ext;
  }
  if (existsSync(base) && statSync(base).isFile()) return base;
  return null;
}

const SPEC = /(?:from\s*|import\(\s*)["']([^"']+)["']/g;

test("every relative import under src/loom names a file that exists", () => {
  const problems = [];
  for (const file of walk(join(SRC, "loom"))) {
    const body = readFileSync(file, "utf8");
    for (const m of body.matchAll(SPEC)) {
      const spec = m[1];
      if (!spec.startsWith(".")) continue;
      if (!resolveSpecifier(file, spec)) {
        problems.push(`${file.replace(SRC, "src")} imports "${spec}", which resolves to nothing`);
      }
    }
  }
  assert.deepEqual(problems, [], `\n${problems.join("\n")}`);
});

test("TypeScript modules are imported without an extension, .js files with one", () => {
  // webpack does not remap a .js specifier onto a .ts file in this setup.
  // The mismatch typechecks fine and fails the production build minutes
  // later, so catch it here in milliseconds.
  const problems = [];
  for (const file of walk(join(SRC, "loom"))) {
    const body = readFileSync(file, "utf8");
    for (const m of body.matchAll(SPEC)) {
      const spec = m[1];
      if (!spec.startsWith(".")) continue;
      const target = resolveSpecifier(file, spec);
      if (!target) continue;
      const rel = file.replace(SRC, "src");
      const isTs = /\.(ts|tsx)$/.test(target);
      if (isTs && spec.endsWith(".js")) {
        problems.push(`${rel}: "${spec}" points at a TypeScript file — drop the .js`);
      }
      if (!isTs && !spec.endsWith(".js")) {
        problems.push(`${rel}: "${spec}" points at a JavaScript file — add the .js`);
      }
    }
  }
  assert.deepEqual(problems, [], `\n${problems.join("\n")}`);
});
