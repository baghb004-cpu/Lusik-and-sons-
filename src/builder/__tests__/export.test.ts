import { test } from "node:test";
import assert from "node:assert/strict";

import { layerToMediaCss, layersToMediaCss } from "../export/css.ts";
import { assembleHtmlDocument, pageFileName, escapeHtml } from "../export/static.ts";
import { buildManifest, collectBlockTypes, sha256 } from "../export/manifest.ts";
import { materializeMobileOnly } from "../engine/overrides.ts";
import { newId, type Block } from "../schema/index.ts";
import { textDoc } from "../schema/richtext.ts";
import { makePage, makeMobileLayer } from "./fixtures.ts";
import { CURRENT_SCHEMA_VERSION } from "../schema/migrate.ts";

test("layerToMediaCss: style patches + hidden become @media rules with token vars", () => {
  const css = layerToMediaCss(
    makeMobileLayer({
      patches: {
        b_hero00000001: { style: { textAlign: "center", maxWidth: "spacing.lg" } },
        b_img000000001: { visibility: false },
        b_noop00000001: {},
      },
    })
  );
  assert.match(css, /@media \(max-width: 767\.98px\)/);
  const heroRule = css.split("\n").find((l) => l.includes("b_hero00000001"))!;
  assert.match(heroRule, /text-align: center;/);
  assert.match(heroRule, /max-width: var\(--bt-spacing-lg\);/);
  assert.match(css, /\[data-block-id="b_img000000001"\] \{ display: none; \}/);
  assert.ok(!css.includes("b_noop00000001"), "empty patches emit nothing");
});

test("layersToMediaCss: tablet rules precede mobile so phones win on conflict", () => {
  const tablet = makeMobileLayer({ breakpoint: "tablet", patches: { b_hero00000001: { style: { textAlign: "left" } } } });
  const mobile = makeMobileLayer({ patches: { b_hero00000001: { style: { textAlign: "center" } } } });
  const css = layersToMediaCss([mobile, tablet]); // input order shouldn't matter
  assert.ok(css.indexOf("1023.98px") < css.indexOf("767.98px"));
});

test("materializeMobileOnly: bakes blocks as desktop+tablet-hidden markup; stale anchors skipped", () => {
  const page = makePage();
  const extra: Block = { id: newId(), type: "richText", props: { doc: textDoc("mobile note") } };
  const layer = makeMobileLayer({
    patches: {},
    mobileOnlyBlocks: [
      { anchorBlockId: "b_card00000001", position: "after", block: extra },
      { anchorBlockId: "b_gone00000001", position: "after", block: { ...extra, id: newId() } },
    ],
  });
  const out = materializeMobileOnly(page.sections, layer);
  assert.equal(out.length, page.sections.length + 1);
  const baked = out.find((b) => b.id === extra.id)!;
  assert.equal(baked.visibility?.desktop, false);
  assert.equal(baked.visibility?.tablet, false);
  assert.notEqual(baked.visibility?.mobile, false);
});

test("assembleHtmlDocument: real title/meta, theme vars, media css, zero <script>", () => {
  const page = makePage({ seo: { title: "Welcome — Lusik", description: 'Hand "stitched" & warm' } });
  const html = assembleHtmlDocument({
    page,
    bodyHtml: '<section data-block-id="b_sect00000001">hi</section>',
    layers: [makeMobileLayer()],
    theme: null,
    stylesheetHref: "styles.css",
    siteName: "Lusik & Sons",
  });
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<title>Welcome — Lusik<\/title>/);
  assert.match(html, /content="Hand &quot;stitched&quot; &amp; warm"/);
  assert.match(html, /@media \(max-width: 767\.98px\)/);
  assert.ok(!html.includes("<script"), "static export ships zero JavaScript");
  assert.ok(html.includes('data-block-id="b_sect00000001"'));
});

test("pageFileName + escapeHtml basics", () => {
  assert.equal(pageFileName(makePage({ slug: "index" })), "index.html");
  assert.equal(pageFileName(makePage({ slug: "gift-guide" })), "gift-guide/index.html");
  assert.equal(escapeHtml('<a b="c">&'), "&lt;a b=&quot;c&quot;&gt;&amp;");
});

test("manifest: checksums, block inventory, format contract", () => {
  const page = makePage();
  const manifest = buildManifest("static", [page], [
    { path: "index.html", content: "hello" },
    { path: "styles.css", content: "body{}" },
  ]);
  assert.equal(manifest.format, "lusik-builder-export");
  assert.equal(manifest.formatVersion, 1);
  assert.equal(manifest.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(manifest.pages, 1);
  assert.deepEqual(manifest.blockTypesUsed, ["card", "image", "richText", "section"]);
  assert.equal(manifest.files[0].sha256, sha256("hello"));
  assert.equal(manifest.files[0].bytes, 5);
  assert.deepEqual(
    [...collectBlockTypes(page.sections)].sort(),
    ["card", "image", "richText", "section"]
  );
});
