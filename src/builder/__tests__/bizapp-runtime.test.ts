// Business App runtime (§30): the generic record store, optional at-rest
// encryption, and the official-only payment connector. Pure + local.
import { test } from "node:test";
import assert from "node:assert/strict";

import { makeAppTemplate } from "../studio/bizapp/templates.ts";
import { emptyData, addRecord, updateRecord, deleteRecord, searchRecords, recordLabel, tableCsv, serializeData, parseDataBackup } from "../studio/bizapp/runtime.ts";
import { encryptData, decryptData, isEncrypted } from "../studio/bizapp/secure.ts";
import { checkPaymentConnector } from "../studio/bizapp/payments.ts";

test("runtime: add/update/delete/search records over a blueprint", () => {
  const bp = makeAppTemplate("crm", "a1")!;
  const t = bp.tables[0];
  let data = emptyData(bp);
  data = addRecord(data, t.id, { name: "Ana", phone: "555", email: "ana@x.com" });
  data = addRecord(data, t.id, { name: "Bo", phone: "777", email: "bo@x.com" });
  assert.equal(data[t.id].length, 2);
  const ana = data[t.id].find((r) => r.name === "Ana")!;
  data = updateRecord(data, t.id, ana.id, { phone: "999" });
  assert.equal(data[t.id].find((r) => r.id === ana.id)!.phone, "999");
  assert.equal(searchRecords(data, t, "bo").length, 1);
  assert.equal(searchRecords(data, t, "").length, 2);
  assert.equal(recordLabel(data[t.id].find((r) => r.id === ana.id)!, t), "Ana");
  data = deleteRecord(data, t.id, ana.id);
  assert.equal(data[t.id].length, 1);
});

test("runtime: CSV uses field labels + formats money; backup round-trips + rejects foreign", () => {
  const bp = makeAppTemplate("inventory", "a2")!;
  const t = bp.tables[0];
  let data = emptyData(bp);
  data = addRecord(data, t.id, { name: "Scarf", sku: "S1", price: 2500, stock: 3 });
  const csv = tableCsv(t, data[t.id]);
  assert.ok(csv.includes("Scarf") && csv.includes("25.00")); // money cents → dollars
  const back = parseDataBackup(serializeData("a2", data));
  assert.equal(back.appId, "a2");
  assert.equal(back.data[t.id].length, 1);
  assert.throws(() => parseDataBackup("nope"), /valid JSON/);
  assert.throws(() => parseDataBackup(JSON.stringify({ app: "other" })), /business-app data backup/);
});

test("encrypted DB: round-trips + fails closed on wrong passphrase", async () => {
  const blob = await encryptData({ secret: 42, list: [1, 2] }, "correct horse");
  assert.ok(isEncrypted(blob));
  assert.ok(!isEncrypted("plain text"));
  const back = await decryptData<{ secret: number }>(blob, "correct horse");
  assert.equal(back.secret, 42);
  await assert.rejects(() => decryptData(blob, "wrong one"), /Wrong passphrase|corrupted/);
  await assert.rejects(() => encryptData({}, "short"), /at least 8/);
});

test("payments: official hosted links only, never card data", () => {
  assert.equal(checkPaymentConnector({ provider: "none", checkoutUrl: "", note: "" }).ok, true);
  assert.equal(checkPaymentConnector({ provider: "stripe", checkoutUrl: "https://buy.stripe.com/abc123", note: "" }).ok, true);
  assert.equal(checkPaymentConnector({ provider: "square", checkoutUrl: "https://square.link/u/xyz", note: "" }).ok, true);
  assert.equal(checkPaymentConnector({ provider: "stripe", checkoutUrl: "http://buy.stripe.com/x", note: "" }).ok, false); // not https
  assert.equal(checkPaymentConnector({ provider: "stripe", checkoutUrl: "https://evil.example.com/pay", note: "" }).ok, false); // not official host
  assert.equal(checkPaymentConnector({ provider: "stripe", checkoutUrl: "https://buy.stripe.com/?cardNumber=4111111111111111", note: "" }).ok, false); // card-like
});
