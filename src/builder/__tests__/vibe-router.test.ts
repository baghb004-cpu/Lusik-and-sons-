// Cross-mode vibe router (§30, Phase 9): plain English → the right mode, with
// guided choices when unsure. Pure + local.
import { test } from "node:test";
import assert from "node:assert/strict";

import { routeVibe, MODE_ROUTES } from "../studio/vibe-router.ts";

const expect = (text: string, mode: string) => {
  const r = routeVibe(text);
  assert.ok(r.best, `routed: ${text}`);
  assert.equal(r.best!.mode, mode, `${text} → ${mode} (got ${r.best!.mode})`);
};

test("routes each request to the right mode", () => {
  expect("Make a platformer where the player collects coins and avoids spikes", "game-lab");
  expect("a cinematic 3D homepage where products appear as you scroll", "immersive");
  expect("a customer profile system with barcode inventory and purchase history", "store");
  expect("make a wedding photo booth with a 3-photo strip and countdown", "photo-booth");
  expect("let users tilt their phone and shake to start", "sensors");
  expect("help me practice a cold call and interview", "coach");
});

test("generic 'website' falls back to the builder but loses to specific modes", () => {
  assert.equal(routeVibe("build me a website").best?.mode, "builder");
  // a 3D website is immersive, not the generic builder
  assert.equal(routeVibe("a 3d scroll website with parallax").best?.mode, "immersive");
});

test("unclear input returns choices, not a confident pick", () => {
  const r = routeVibe("asdf qwer zxcv");
  assert.equal(r.confident, false);
  assert.ok(r.choices.length === MODE_ROUTES.length); // offer every mode as a guided choice
});

test("seedable flag marks the builders that can auto-run the prompt", () => {
  assert.equal(routeVibe("a 3d product reveal").best?.seedable, true);
  assert.equal(routeVibe("a barcode inventory system").best?.seedable, false);
});
