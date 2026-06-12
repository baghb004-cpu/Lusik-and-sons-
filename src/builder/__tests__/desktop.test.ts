import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// The desktop shell can only be COMPILED on Windows, but its contract is
// checkable here: the files exist, the config parses, the splash keeps the
// invariants the shell depends on, and nothing reaches the network.

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

test("desktop project: all the pieces exist", () => {
  for (const p of [
    "desktop/README.md",
    "desktop/package.json",
    "desktop/splash/splash.html",
    "desktop/src-tauri/Cargo.toml",
    "desktop/src-tauri/build.rs",
    "desktop/src-tauri/src/main.rs",
    "desktop/src-tauri/tauri.conf.json",
    "desktop/scripts/make-portable.mjs",
  ]) {
    assert.ok(existsSync(join(ROOT, p)), p);
  }
});

test("tauri.conf.json: valid JSON, splash as frontendDist, CSP locked to self", () => {
  const conf = JSON.parse(read("desktop/src-tauri/tauri.conf.json"));
  assert.equal(conf.build.frontendDist, "../splash");
  assert.match(conf.app.security.csp, /default-src 'self'/);
  assert.equal(conf.app.withGlobalTauri, true);
  assert.equal(conf.identifier, "com.baghdo.workshop");
  assert.equal(conf.productName, "Baghdo's Workshop");
});

test("splash invariants: offline, fallback-by-construction, reduced-motion, skip, shell hooks", () => {
  const html = read("desktop/splash/splash.html");
  // zero network: no external URLs in markup/CSS (https only allowed in comments — strip them)
  const noComments = html.replace(/<!--[\s\S]*?-->/g, "");
  assert.ok(!/src=["']https?:|href=["']https?:|url\(["']?https?:/i.test(noComments), "no external assets");
  // the shell's two events
  assert.ok(html.includes('listen("app-ready"'));
  assert.ok(html.includes('listen("app-error"'));
  // reduced-motion fallback and the final-state base layer
  assert.ok(html.includes("prefers-reduced-motion"));
  assert.ok(html.includes('id="done"'));
  // click-to-skip
  assert.ok(html.includes('addEventListener("click"'));
  // the cast: both characters exist as figures, and the title is the new name
  assert.ok(html.includes('class="figure baghdo"'));
  assert.ok(html.includes('class="figure gohar"'));
  assert.match(html, /Baghdo’s <em>Workshop<\/em>/);
  // their signatures: the beard, the curls, the coffee
  for (const part of ["beard", "curls", "cup", "steam", "broom"]) {
    assert.ok(html.includes(`class="${part}"`) || html.includes(`.${part}`), part);
  }
});

test("shell main.rs: splash-first, min duration, token hand-off, teardown", () => {
  const rs = read("desktop/src-tauri/src/main.rs");
  assert.match(rs, /MIN_SPLASH_MS: u64 = 3400/);
  assert.match(rs, /splash\.html/);
  assert.match(rs, /app-ready/);
  assert.match(rs, /app-error/);
  assert.match(rs, /#token=/); // the editor hand-off
  assert.match(rs, /BUILDER_LOCAL_TOKEN/);
  assert.match(rs, /WindowEvent::Destroyed/); // server dies with the window
  assert.match(rs, /4799/);
});

test("the editor accepts the shell's hash token hand-off", () => {
  const shell = read("src/builder/editor/BuilderShell.tsx");
  assert.match(shell, /#token=/);
  assert.match(shell, /history\.replaceState/); // token stripped from the URL
});
