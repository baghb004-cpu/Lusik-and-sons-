// ============================================================
// Unit tests — _lib/email.mjs headerSafe()
// ============================================================
// Strips CR/LF and other control characters before a user-
// controlled string lands in a Resend `subject` (or any other
// SMTP-header-shaped) field. SMTP-injection defense.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";

// REMINDER_SECRET must be set to avoid the warn-on-import side
// effect in email.mjs; the warning is harmless but pollutes test
// output.
process.env.REMINDER_SECRET ||= "x".repeat(40);

const { headerSafe } = await import("../email.mjs");

test("null / undefined return empty string", () => {
  assert.equal(headerSafe(null), "");
  assert.equal(headerSafe(undefined), "");
});

test("trims surrounding whitespace", () => {
  assert.equal(headerSafe("  hello  "), "hello");
});

test("preserves normal printable ASCII", () => {
  assert.equal(headerSafe("Hand-stitched bib (2024)"), "Hand-stitched bib (2024)");
});

test("preserves non-ASCII letters (Unicode brand names, Armenian)", () => {
  // Decap CMS lets admins type unicode names. Those are fine in
  // SMTP subjects (with proper transfer encoding by Resend).
  assert.equal(headerSafe("Ա Բ Գ blanket"), "Ա Բ Գ blanket");
});

test("strips CR/LF (SMTP-injection vector)", () => {
  const malicious = "Real product\r\nBcc: attacker@evil.com";
  const out = headerSafe(malicious);
  assert.equal(out.includes("\r"), false);
  assert.equal(out.includes("\n"), false);
  assert.equal(out.includes("Bcc:"), true); // text preserved, just newlines collapsed
});

test("strips all C0 control chars", () => {
  // \x00..\x1f covers NUL through Unit Separator. \x7f is DEL.
  const dirty = "ok\x00\x01\x02\x07\x1f\x7fclean";
  assert.equal(headerSafe(dirty), "ok clean");
});

test("collapses adjacent control chars into a single space", () => {
  assert.equal(headerSafe("a\r\n\r\nb"), "a b");
});

test("caps length at 200 by default", () => {
  const long = "x".repeat(500);
  assert.equal(headerSafe(long).length, 200);
});

test("respects custom max parameter", () => {
  assert.equal(headerSafe("hello world", 5), "hello");
});

test("coerces non-string inputs", () => {
  assert.equal(headerSafe(42), "42");
  assert.equal(headerSafe(true), "true");
});

test("an attacker-supplied 50KB string is bounded immediately", () => {
  const huge = "A\r\nX-Spoof: evil\r\n".repeat(5000);
  const out = headerSafe(huge);
  assert.ok(out.length <= 200);
  assert.equal(out.includes("\r"), false);
  assert.equal(out.includes("\n"), false);
});
