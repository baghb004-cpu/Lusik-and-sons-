// Media library (plan §20) — the sniffing wall, name generation,
// path gates, and the fs store's roundtrip + containment.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  sniffImage,
  MAX_MEDIA_BYTES,
  sanitizeMediaBase,
  newMediaFileName,
  assertMediaFileName,
  mediaWebPath,
  MediaPathError,
  MEDIA_DIR,
  createFsMediaStore,
  createGithubMediaStore,
} from "../media/index.ts";

// Tiny real headers (the sniffer only needs the magic bytes + length ≥ 12).
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1]);
const GIF = Uint8Array.from([...new TextEncoder().encode("GIF89a"), 0, 0, 0, 0, 0, 0]);
const WEBP = Uint8Array.from([...new TextEncoder().encode("RIFF"), 0, 0, 0, 0, ...new TextEncoder().encode("WEBP")]);

// ── sniffing ────────────────────────────────────────────────
test("sniff: the four browser-safe formats identify by BYTES", () => {
  assert.equal(sniffImage(PNG)?.ext, "png");
  assert.equal(sniffImage(JPEG)?.ext, "jpg");
  assert.equal(sniffImage(GIF)?.ext, "gif");
  assert.equal(sniffImage(WEBP)?.ext, "webp");
});

test("sniff: SVG, HTML, junk and empty are all rejected", () => {
  const enc = (s: string) => new TextEncoder().encode(s);
  assert.equal(sniffImage(enc('<svg xmlns="http://www.w3.org/2000/svg" onload="x()">')), null); // script container
  assert.equal(sniffImage(enc("<!doctype html><script>alert(1)</script>")), null);
  assert.equal(sniffImage(enc("RIFFxxxxWAVE")), null); // RIFF but not WebP
  assert.equal(sniffImage(new Uint8Array(0)), null);
  assert.equal(sniffImage(new Uint8Array([1, 2, 3])), null);
});

// ── naming ──────────────────────────────────────────────────
test("sanitizeMediaBase: messy human filenames become safe slugs", () => {
  assert.equal(sanitizeMediaBase("Mom's Photo (1).JPG"), "mom-s-photo-1");
  assert.equal(sanitizeMediaBase("../../etc/passwd"), "etc-passwd");
  assert.equal(sanitizeMediaBase("Çök Güzel Fotoğraf.png"), "cok-guzel-fotograf");
  assert.equal(sanitizeMediaBase("....."), "image"); // nothing left → fallback
  assert.ok(sanitizeMediaBase("x".repeat(200)).length <= 48);
});

test("newMediaFileName: extension comes from the SNIFF, names never collide", () => {
  const a = newMediaFileName("photo.png", "jpg"); // lying .png that sniffed as JPEG
  assert.match(a, /^photo-[a-z0-9]+\.jpg$/);
  assert.notEqual(newMediaFileName("photo.png", "jpg"), newMediaFileName("photo.png", "jpg"));
  assert.doesNotThrow(() => assertMediaFileName(a)); // generated names pass their own gate
});

test("assertMediaFileName: traversal, nesting, wrong extensions all refuse", () => {
  for (const bad of ["../x.jpg", "a/b.jpg", "x.svg", "x.html", "x.jpg.exe", ".jpg", "UPPER.jpg", "x.JPG", ""]) {
    assert.throws(() => assertMediaFileName(bad), MediaPathError, bad);
  }
  assert.equal(mediaWebPath("hero-abc123.webp"), "/img/uploads/hero-abc123.webp");
});

// ── fs store ────────────────────────────────────────────────
test("fs store: save → list → bytes intact → remove; stray files never listed", async () => {
  const root = await mkdtemp(join(tmpdir(), "media-"));
  const store = createFsMediaStore(root);

  assert.deepEqual(await store.list(), []); // missing dir = empty, not an error

  const name = newMediaFileName("blanket.jpg", "png");
  const saved = await store.save(name, PNG);
  assert.equal(saved.path, `/img/uploads/${name}`);

  // a stray non-media file in the folder is not ours to list
  await writeFile(join(root, MEDIA_DIR, "notes.txt"), "hi");

  const listed = await store.list();
  assert.equal(listed.length, 1);
  assert.equal(listed[0].name, name);
  assert.equal(listed[0].size, PNG.byteLength);

  const bytes = await readFile(join(root, MEDIA_DIR, name));
  assert.deepEqual(new Uint8Array(bytes), PNG); // byte-identical roundtrip

  await store.remove(name);
  assert.deepEqual((await store.list()).map((f) => f.name), []);
  await store.remove(name); // absent → no-op, same contract as documents
});

test("fs store: bad names refuse before any I/O", async () => {
  const root = await mkdtemp(join(tmpdir(), "media-"));
  await mkdir(join(root, MEDIA_DIR), { recursive: true });
  const store = createFsMediaStore(root);
  await assert.rejects(store.save("../escape.jpg", PNG), MediaPathError);
  await assert.rejects(store.save("x.svg", PNG), MediaPathError);
  await assert.rejects(store.remove("../../etc/passwd.jpg"), MediaPathError);
});

// ── github store (fetch injected — no network) ──────────────
test("github store: uploads PUT base64 to the media dir on the configured branch", async () => {
  const calls: Array<{ url: string; method: string; body?: string }> = [];
  const fakeFetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), method: init?.method ?? "GET", body: init?.body as string | undefined });
    if (!init?.method) return new Response(null, { status: 404 }); // no existing file
    return new Response(JSON.stringify({ content: { sha: "x" } }), { status: 201 });
  }) as typeof fetch;

  const store = createGithubMediaStore({ repo: "baghdo/site", token: "t", branch: "main" }, fakeFetch);
  const name = "hero-abc123.png";
  await store.save(name, PNG);
  const put = calls.find((c) => c.method === "PUT")!;
  assert.match(put.url, /repos\/baghdo\/site\/contents\/public\/img\/uploads\/hero-abc123\.png$/);
  const body = JSON.parse(put.body!);
  assert.equal(body.branch, "main");
  assert.equal(body.content, Buffer.from(PNG).toString("base64"));

  await assert.rejects(store.save("../x.png", PNG), MediaPathError); // gate holds over the API too
});

// ── the cap is real ─────────────────────────────────────────
test("MAX_MEDIA_BYTES is 8 MB — the API route and panel both key off it", () => {
  assert.equal(MAX_MEDIA_BYTES, 8 * 1024 * 1024);
});
