// Tests for the image magic-byte sniffer. Used on every avatar +
// finished-piece upload to reject payloads whose declared
// contentType doesn't match the actual bytes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { sniffImageType } from "../image-sniff.mjs";

// Minimal valid-prefix buffers for each format. We don't need a
// real image — just enough leading bytes for the sniffer.
const PNG_HEADER  = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const WEBP_HEADER = Buffer.from([
  0x52, 0x49, 0x46, 0x46,         // RIFF
  0x00, 0x00, 0x00, 0x00,         // size (don't care)
  0x57, 0x45, 0x42, 0x50,         // WEBP
]);

test("sniffImageType: PNG header → image/png", () => {
  assert.equal(sniffImageType(PNG_HEADER), "image/png");
});

test("sniffImageType: JPEG header → image/jpeg", () => {
  assert.equal(sniffImageType(JPEG_HEADER), "image/jpeg");
});

test("sniffImageType: WEBP header → image/webp", () => {
  assert.equal(sniffImageType(WEBP_HEADER), "image/webp");
});

test("sniffImageType: HTML body labeled as image is rejected", () => {
  const htmlBytes = Buffer.from("<!doctype html><script>alert(1)</script>");
  assert.equal(sniffImageType(htmlBytes), null);
});

test("sniffImageType: empty / too-short buffers return null", () => {
  assert.equal(sniffImageType(Buffer.alloc(0)), null);
  assert.equal(sniffImageType(Buffer.from([0x89, 0x50])), null);
  assert.equal(sniffImageType(null), null);
  assert.equal(sniffImageType(undefined), null);
});

test("sniffImageType: PNG with a wrong byte in the magic is rejected", () => {
  // Flip one byte — must not be accepted as PNG.
  const tampered = Buffer.from(PNG_HEADER);
  tampered[2] = 0x00;
  assert.equal(sniffImageType(tampered), null);
});

test("sniffImageType: WEBP with RIFF but wrong inner tag is rejected", () => {
  // RIFF .... AVI  (animated GIF / AVI / other RIFF container) — not webp
  const aviHeader = Buffer.from([
    0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0,
    0x41, 0x56, 0x49, 0x20, // "AVI "
  ]);
  assert.equal(sniffImageType(aviHeader), null);
});
