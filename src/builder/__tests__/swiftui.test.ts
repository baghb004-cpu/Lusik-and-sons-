import { test } from "node:test";
import assert from "node:assert/strict";

import { escapeSwift, swiftTypeName, blockToSwift, pageToSwiftView, buildSwiftUIProject } from "../export/swiftui.ts";
import { themeSchema, type Block } from "../schema/index.ts";
import { textDoc } from "../schema/richtext.ts";
import { makePage } from "./fixtures.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const seedTheme = () => themeSchema.parse(JSON.parse(readFileSync(join(process.cwd(), "builder/theme.json"), "utf8")));

test("escapeSwift handles quotes, backslashes, newlines", () => {
  assert.equal(escapeSwift('say "hi"'), 'say \\"hi\\"');
  assert.equal(escapeSwift("a\\b"), "a\\\\b");
  assert.equal(escapeSwift("line1\nline2"), "line1\\nline2");
});

test("swiftTypeName produces valid PascalCase types", () => {
  assert.equal(swiftTypeName("gift-guide"), "GiftGuideView");
  assert.equal(swiftTypeName("index"), "IndexView");
  assert.equal(swiftTypeName("2026-sale"), "Page2026SaleView"); // can't start with a digit
});

test("blocks translate to plausible SwiftUI", () => {
  assert.match(blockToSwift({ id: "b_x1", type: "richText", props: { doc: textDoc("Hello") } } as Block), /Text\("Hello"\)/);
  assert.match(blockToSwift({ id: "b_x2", type: "button", props: { label: "Shop", href: "/shop" } } as Block), /Capsule\(\)/);
  assert.match(blockToSwift({ id: "b_x3", type: "button", props: { label: "Site", href: "https://x.com" } } as Block), /Link\("Site"/);
  assert.match(blockToSwift({ id: "b_x4", type: "accordion", props: { items: [{ id: "b_i1", title: "Q", body: textDoc("A") }] } } as Block), /DisclosureGroup\("Q"\)/);
  assert.match(blockToSwift({ id: "b_x5", type: "image", props: { src: "/img/a.jpg", alt: "a" } } as Block), /RemoteImage\(url: "\/img\/a.jpg"\)/);
});

test("PROTECTED ZONE: commerce blocks link out, never generate purchase code", () => {
  const buy = blockToSwift({ id: "b_buy", type: "buyBox", props: { product: "bibs/baby-bib" } } as Block);
  assert.match(buy, /ProductLink\(ref: "bibs\/baby-bib"\)/);
  // no IAP / StoreKit / payment symbols anywhere in the generated block
  assert.ok(!/StoreKit|SKProduct|purchase|IAP|PaymentQueue/i.test(buy));
});

test("unknown block types become a labeled placeholder, never dropped or raw", () => {
  const out = blockToSwift({ id: "b_z", type: "marquee3000", props: {} } as Block);
  assert.match(out, /BuilderPlaceholder\(label: "marquee3000/);
});

test("pageToSwiftView wraps sections in a View with a ScrollView + nav title", () => {
  const swift = pageToSwiftView(makePage({ slug: "welcome", title: "Welcome" }));
  assert.match(swift, /struct WelcomeView: View/);
  assert.match(swift, /var body: some View/);
  assert.match(swift, /ScrollView/);
  assert.match(swift, /\.navigationTitle\("Welcome"\)/);
});

test("buildSwiftUIProject emits a compilable-shaped project with theme + support files", () => {
  const project = buildSwiftUIProject([makePage({ slug: "index", title: "Home" })], seedTheme(), "Baghdo's Workshop", "https://lusikandsons.com");
  const paths = Object.keys(project);
  assert.ok(paths.includes("Package.swift"));
  assert.ok(paths.some((p) => /App\.swift$/.test(p)), "an @main App entry");
  assert.ok(paths.some((p) => /Theme\.swift$/.test(p)));
  assert.ok(paths.some((p) => /SupportViews\.swift$/.test(p)));
  assert.ok(paths.some((p) => /Views\/IndexView\.swift$/.test(p)));
  assert.ok(paths.includes("README.md"));

  // theme tokens became real Color values
  const theme = project[paths.find((p) => /Theme\.swift$/.test(p))!];
  assert.match(theme, /static let ink = Color\(red:/);

  // @main app launches the home view in a NavigationStack
  const app = project[paths.find((p) => /App\.swift$/.test(p))!];
  assert.match(app, /@main/);
  assert.match(app, /NavigationStack \{ IndexView\(\) \}/);

  // commerce links target the real web shop, IAP nowhere in the project
  const all = Object.values(project).join("\n");
  assert.match(all, /lusikandsons\.com/);
  assert.ok(!/StoreKit|in-app purchase code/i.test(all));
  // the README is honest about the Mac requirement + scaffold status
  assert.match(project["README.md"], /starting point, not a finished App Store build/);
  assert.match(project["README.md"], /Mac/);
});
