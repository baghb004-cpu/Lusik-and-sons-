// Tax Assistant browser helpers (§25): the OCR amount extractor is pure,
// and the WebCrypto save/load must round-trip and fail closed on a wrong
// passphrase or a tampered/unrecognized file. Runs in Node (WebCrypto +
// btoa/atob are globals there too).
import { test } from "node:test";
import assert from "node:assert/strict";

import { extractAmounts } from "../tax/ui/ocr.ts";
import { encryptSession, decryptSession } from "../tax/ui/sessionCrypto.ts";

test("extractAmounts pulls plausible dollar figures and strips commas", () => {
  const text = "Wages 52,310.00\nFederal tax withheld $7,004.12\nBox 12: D 1200.00\nnot money: 2024 form";
  const amounts = extractAmounts(text);
  assert.ok(amounts.includes("52310.00"));
  assert.ok(amounts.includes("7004.12"));
  assert.ok(amounts.includes("1200.00"));
  // a bare year with no decimals isn't treated as money
  assert.ok(!amounts.includes("2024"));
});

test("extractAmounts de-dupes and caps the list", () => {
  const text = Array.from({ length: 30 }, (_, i) => `${i}.00`).join(" ") + " 5.00 5.00";
  const amounts = extractAmounts(text);
  assert.ok(amounts.length <= 12);
  assert.equal(amounts.filter((a) => a === "5.00").length, 1);
});

test("encrypt → decrypt round-trips the session", async () => {
  const session = { v: 1, filingStatus: "single", answers: { hasW2: true }, itemized: "12000.00", stdDeduction: "", stdVerified: false };
  const blob = await encryptSession(session, "correct horse battery");
  const back = await decryptSession<typeof session>(blob, "correct horse battery");
  assert.deepEqual(back, session);
});

test("a wrong passphrase fails closed", async () => {
  const blob = await encryptSession({ a: 1 }, "the-right-one");
  await assert.rejects(() => decryptSession(blob, "the-wrong-one"), /Wrong passphrase|corrupted/);
});

test("a short passphrase is refused on encrypt", async () => {
  await assert.rejects(() => encryptSession({ a: 1 }, "short"), /at least 8/);
});

test("garbage and tampered files are rejected", async () => {
  await assert.rejects(() => decryptSession("not base64!!!", "whatever12"), /saved tax file|recognized/);
  const blob = await encryptSession({ a: 1 }, "passphrase1");
  // flip a chunk in the middle (after the magic header) → GCM auth fails
  const mangled = blob.slice(0, 20) + (blob[20] === "A" ? "B" : "A") + blob.slice(21);
  await assert.rejects(() => decryptSession(mangled, "passphrase1"), /Wrong passphrase|corrupted|recognized/);
});
