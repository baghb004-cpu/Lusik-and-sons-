// ============================================================
// CART THUMBNAILS
// ============================================================
// The small picture of the configured piece that a bag row shows. It is
// written by the 3D stage, stored in localStorage, and then put straight
// into an <img src> — which is why it is re-checked on the way out of
// storage rather than trusted because it was already there.
//
// localStorage is same-device data, but it is still data this code did
// not write: an extension, another tab, or a developer console can put
// anything in it, and the value goes on to make the browser fetch
// something.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { THUMB_MAX_BYTES, THUMB_MAX_EDGE, THUMB_QUALITIES, sanitizeThumb, thumbSize } from "../../../../src/lib/cartThumb.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = (p) => resolve(here, "../../../../", p);

const webp = (body = "AAAA") => `data:image/webp;base64,${body}`;

test("a real base64 raster data URL survives", () => {
  assert.equal(sanitizeThumb(webp()), webp());
  assert.equal(sanitizeThumb("data:image/png;base64,iVBORw0KGgo="), "data:image/png;base64,iVBORw0KGgo=");
  assert.equal(sanitizeThumb("data:image/jpeg;base64,/9j/4AA="), "data:image/jpeg;base64,/9j/4AA=");
});

test("anything that would make the browser fetch elsewhere is dropped", () => {
  // The one that matters: a URL here is a request to somebody else's
  // server, made on the customer's behalf, from a value in storage.
  assert.equal(sanitizeThumb("https://tracker.example/pixel.gif"), null);
  assert.equal(sanitizeThumb("//tracker.example/pixel.gif"), null);
  assert.equal(sanitizeThumb("/img/abc-blanket/01.jpg"), null);
});

test("an SVG data URL is dropped, because it can carry script", () => {
  assert.equal(sanitizeThumb("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="), null);
  assert.equal(sanitizeThumb("data:image/svg+xml,%3Csvg%3E%3C/svg%3E"), null);
});

test("non-base64 and non-image data URLs are dropped", () => {
  assert.equal(sanitizeThumb("data:text/html;base64,PGgxPmhpPC9oMT4="), null);
  assert.equal(sanitizeThumb("data:image/webp,notbase64"), null);
  assert.equal(sanitizeThumb("data:image/webp;base64,has spaces!"), null);
  assert.equal(sanitizeThumb("javascript:alert(1)"), null);
});

test("non-strings are dropped rather than thrown on", () => {
  for (const value of [undefined, null, 0, 1, {}, [], true, () => {}]) {
    assert.equal(sanitizeThumb(value), null);
  }
});

test("an oversized thumbnail is dropped", () => {
  // A cart holds forty rows and they share one localStorage origin, so
  // the cap is a real budget rather than a formality.
  const huge = webp("A".repeat(THUMB_MAX_BYTES));
  assert.ok(huge.length > THUMB_MAX_BYTES);
  assert.equal(sanitizeThumb(huge), null);
});

test("the capture keeps the stage's own shape", () => {
  // Squeezing a blanket into a fixed landscape frame makes the piece the
  // wrong shape, and its proportions are most of what it is.
  assert.deepEqual(thumbSize(420, 525), { width: 256, height: 320 });
  assert.deepEqual(thumbSize(800, 600), { width: 320, height: 240 });
  assert.deepEqual(thumbSize(1000, 1000), { width: 320, height: 320 });
  // Never enlarged: a small stage stays small rather than being blown up.
  assert.deepEqual(thumbSize(120, 90), { width: 120, height: 90 });
  // Degenerate input cannot produce a zero-sized canvas, which throws.
  for (const [w, h] of [[0, 0], [-5, 10], [NaN, NaN], [undefined, undefined]]) {
    const size = thumbSize(w, h);
    assert.ok(size.width >= 1 && size.height >= 1, `thumbSize(${w}, ${h}) produced ${JSON.stringify(size)}`);
  }
});

test("the quality ladder only ever goes down", () => {
  assert.ok(THUMB_QUALITIES.length >= 2);
  for (let i = 1; i < THUMB_QUALITIES.length; i += 1) {
    assert.ok(THUMB_QUALITIES[i] < THUMB_QUALITIES[i - 1], "the ladder must descend or the retry is pointless");
  }
  for (const q of THUMB_QUALITIES) assert.ok(q > 0 && q <= 1, `quality ${q} is not a fraction`);
  assert.ok(THUMB_MAX_EDGE >= 160 && THUMB_MAX_EDGE <= 640);
});

test("the thumbnail never reaches the server", () => {
  // The checkout payload is built from an explicit list of fields, so
  // this holds by construction — but it holds by construction only while
  // nobody replaces that list with a spread. A 40 KB data URL per row
  // has no business in a Stripe session, and the cart-ID shape that
  // create-checkout-session trusts is built from `id`, not from whatever
  // else a row happens to carry.
  const src = readFileSync(root("src/components/CheckoutView.jsx"), "utf8");
  const block = src.slice(src.indexOf("const safeCart"), src.indexOf("const headers"));
  assert.ok(block.length > 100, "the checkout payload is no longer built where this test looks");
  assert.ok(!/\bthumb\b/.test(block), "the checkout payload now carries `thumb`");
  assert.ok(!/\.\.\.item\b/.test(block), "the checkout payload spreads the whole cart row, so `thumb` goes with it");
});
