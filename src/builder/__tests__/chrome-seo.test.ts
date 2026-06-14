// Site chrome (shared header/footer) + export SEO files (plan §22).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { chromeSchema, CHROME_PATH } from "../schema/index.ts";
import { validateDocument } from "../server/validateDoc.ts";
import { sitemapXml, robotsTxt } from "../export/seoFiles.ts";

test("chrome schema: block arrays gated like any document; seed file is valid", () => {
  assert.equal(chromeSchema.safeParse({ schemaVersion: 1, header: [], footer: [] }).success, true);
  assert.equal(
    chromeSchema.safeParse({
      schemaVersion: 1,
      header: [],
      footer: [{ id: "b_f0000000001", type: "richText", props: { doc: { type: "doc", content: [] } } }],
    }).success,
    true
  );
  // a javascript: link in chrome refuses exactly like in a page
  assert.equal(
    chromeSchema.safeParse({
      schemaVersion: 1,
      header: [{ id: "b_h0000000001", type: "button", props: { label: "x", href: "javascript:alert(1)" } }],
      footer: [],
    }).success,
    false
  );
  const seed = JSON.parse(readFileSync("builder/chrome.json", "utf8"));
  assert.equal(chromeSchema.safeParse(seed).success, true, "the seed chrome must stay valid");
  assert.equal(CHROME_PATH, "builder/chrome.json");
});

test("validateDocument routes builder/chrome.json; near-misses stay fail-closed", async () => {
  assert.deepEqual(await validateDocument("builder/chrome.json", { schemaVersion: 1, header: [], footer: [] }), []);
  assert.ok((await validateDocument("builder/chrome.json", { header: "nope" })).length > 0);
  assert.ok((await validateDocument("builder/chrome2.json", {})).some((i) => i.code === "unknown_family"));
});

test("sitemap: per-locale URLs with hreflang alternates; robots points at it", () => {
  const xml = sitemapXml(
    [
      { path: "/", locale: "en", slug: "index" },
      { path: "/hy/", locale: "hy", slug: "index" },
      { path: "/contact/", locale: "en", slug: "contact" },
    ],
    "https://lusikandsons.com/"
  );
  assert.match(xml, /<loc>https:\/\/lusikandsons\.com\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/lusikandsons\.com\/hy\/<\/loc>/);
  assert.match(xml, /hreflang="hy" href="https:\/\/lusikandsons\.com\/hy\/"/);
  // single-locale pages get no alternates block
  const contact = xml.split("<url>").find((u) => u.includes("/contact/"))!;
  assert.ok(!contact.includes("hreflang"));

  const robots = robotsTxt("https://lusikandsons.com");
  assert.match(robots, /Allow: \//);
  assert.match(robots, /Sitemap: https:\/\/lusikandsons\.com\/sitemap\.xml/);
});
