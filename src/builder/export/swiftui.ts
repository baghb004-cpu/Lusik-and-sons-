// ============================================================
// Export — SwiftUI code generator (App Developer Mode, native)
// ============================================================
// Translates builder block documents into a real, Xcode-openable
// SwiftUI project. This is the native counterpart to the static/
// Next adapters — but SwiftUI is a different paradigm (declarative
// Swift Views, no shared React renderer), so this is a faithful
// TRANSLATION and starting scaffold, not a pixel clone of the web.
//
// Honest boundaries:
//   - Pure string generation: runs anywhere (Windows/Linux). The
//     emitted project COMPILES ON A MAC with Xcode — verified
//     there, not here.
//   - Protected zones hold: NO payment/checkout/IAP code is ever
//     generated. A buyBox becomes a labeled link to the web
//     product page, never an in-app purchase flow.
//   - Blocks with no native mapping render a visible, labeled
//     placeholder View — never silently dropped, never raw data.
//
// Theme tokens → a Swift `Theme` enum; rich text → Text/stacks.
// ============================================================

import type { Block, Page, RichTextDoc, RichTextNode, Theme } from "../schema/index.ts";
import { nightPalette } from "../theme/appearance.ts";

/** Swift string literal escaping (\ and " and newlines). */
export function escapeSwift(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\t/g, "\\t");
}

/** "gift-guide" / "index" → a valid PascalCase Swift type name. */
export function swiftTypeName(slug: string, suffix = "View"): string {
  const pascal = slug
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join("");
  const safe = /^[A-Za-z]/.test(pascal) ? pascal : `Page${pascal}`;
  return `${safe || "Home"}${suffix}`;
}

function indent(code: string, level: number): string {
  const pad = "    ".repeat(level);
  return code
    .split("\n")
    .map((l) => (l ? pad + l : l))
    .join("\n");
}

// ── rich text → SwiftUI ─────────────────────────────────────
// Concatenate inline runs into a single Text with modifiers; block
// nodes become stacked Views.
function inlineText(node: RichTextNode): string | null {
  if (node.type !== "text") return null;
  let expr = `Text("${escapeSwift(node.text ?? "")}")`;
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") expr += ".bold()";
    else if (mark.type === "italic") expr += ".italic()";
    else if (mark.type === "underline") expr += ".underline()";
    // links inside paragraphs: keep the text, drop the nav (honest — a
    // tappable inline link needs AttributedString; v1 shows the words).
  }
  return expr;
}

function richNodeToSwift(node: RichTextNode): string[] {
  switch (node.type) {
    case "heading": {
      const level = Number(node.attrs?.level ?? 2);
      const font = level <= 1 ? ".largeTitle" : level === 2 ? ".title" : level === 3 ? ".title2" : ".title3";
      const text = (node.content ?? []).map(inlineText).filter(Boolean).join(" + ");
      return [`(${text || 'Text("")'}).font(${font}).fontWeight(.semibold)`];
    }
    case "paragraph": {
      const runs = (node.content ?? []).map(inlineText).filter(Boolean);
      return runs.length ? [`(${runs.join(" + ")}).font(.body)`] : [];
    }
    case "bulletList":
    case "orderedList":
      return (node.content ?? []).flatMap((li, i) =>
        (li.content ?? []).flatMap(inlineText).filter(Boolean).map((t) => `HStack(alignment: .top) { Text("${node.type === "orderedList" ? `${i + 1}.` : "•"}"); ${t} }`)
      );
    case "blockquote":
      return (node.content ?? [])
        .flatMap(richNodeToSwift)
        .map((v) => `${v}.italic().padding(.leading, 12).overlay(Rectangle().frame(width: 2).foregroundColor(Theme.accent), alignment: .leading)`);
    case "image":
      return [`RemoteImage(url: "${escapeSwift(String(node.attrs?.src ?? ""))}")`];
    default:
      return [];
  }
}

function richTextToSwift(doc: RichTextDoc): string {
  const views = doc.content.flatMap(richNodeToSwift);
  if (views.length === 0) return 'EmptyView()';
  return `VStack(alignment: .leading, spacing: 10) {\n${views.map((v) => indent(v, 1)).join("\n")}\n}`;
}

// ── blocks → SwiftUI ────────────────────────────────────────
function placeholder(type: string): string {
  return `BuilderPlaceholder(label: "${escapeSwift(type)} — not yet available natively")`;
}

export function blockToSwift(block: Block): string {
  const p = block.props as Record<string, unknown>;
  switch (block.type) {
    case "section": {
      const kids = (block.children ?? []).map(blockToSwift);
      const head: string[] = [];
      if (typeof p.eyebrow === "string") head.push(`Text("${escapeSwift(p.eyebrow)}").font(.caption).foregroundColor(Theme.accent).textCase(.uppercase)`);
      if (typeof p.heading === "string") head.push(`Text("${escapeSwift(p.heading)}").font(.title).fontWeight(.semibold)`);
      const all = [...head, ...kids];
      return `VStack(alignment: .leading, spacing: 16) {\n${all.map((v) => indent(v, 1)).join("\n")}\n}.padding(.vertical, 8)`;
    }
    case "columns": {
      const kids = (block.children ?? []).map(blockToSwift);
      // Native phones are narrow → stack vertically (the web's stackOnMobile default).
      return `VStack(alignment: .leading, spacing: 16) {\n${kids.map((v) => indent(v, 1)).join("\n")}\n}`;
    }
    case "richText":
      return richTextToSwift(p.doc as RichTextDoc);
    case "image":
      return `RemoteImage(url: "${escapeSwift(String(p.src ?? ""))}")${p.caption ? `.overlay(Text("${escapeSwift(String(p.caption))}").font(.caption).foregroundColor(Theme.muted), alignment: .bottom)` : ""}`;
    case "button": {
      const href = String(p.href ?? "/");
      const label = escapeSwift(String(p.label ?? "Button"));
      return href.startsWith("http")
        ? `Link("${label}", destination: URL(string: "${escapeSwift(href)}")!).buttonStyle(.borderedProminent).tint(Theme.ink)`
        : `Text("${label}").fontWeight(.medium).padding(.horizontal, 20).padding(.vertical, 10).background(Theme.ink).foregroundColor(Theme.cream).clipShape(Capsule())`;
    }
    case "spacer":
      return `Spacer().frame(height: 24)`;
    case "card": {
      const title = escapeSwift(String(p.title ?? ""));
      const body = p.body ? richTextToSwift(p.body as RichTextDoc) : 'EmptyView()';
      const cta = p.ctaLabel ? `\n${indent(`Text("${escapeSwift(String(p.ctaLabel))} →").font(.subheadline).foregroundColor(Theme.accent)`, 1)}` : "";
      return `VStack(alignment: .leading, spacing: 8) {\n${indent(`Text("${title}").font(.headline)`, 1)}\n${indent(body, 1)}${cta}\n}.padding(16).background(Theme.paper).clipShape(RoundedRectangle(cornerRadius: 16)).shadow(radius: 2)`;
    }
    case "accordion": {
      const items = (p.items as Array<{ id: string; title: string; body: RichTextDoc }>) ?? [];
      const groups = items.map(
        (it) => `DisclosureGroup("${escapeSwift(it.title)}") {\n${indent(richTextToSwift(it.body), 1)}\n}`
      );
      return `VStack(spacing: 8) {\n${groups.map((g) => indent(g, 1)).join("\n")}\n}`;
    }
    case "tabs": {
      const items = (p.items as Array<{ id: string; label: string; body: RichTextDoc }>) ?? [];
      const tabs = items.map(
        (it, i) => `${richTextToSwift(it.body)}.tabItem { Text("${escapeSwift(it.label)}") }.tag(${i})`
      );
      return `TabView {\n${tabs.map((t) => indent(t, 1)).join("\n")}\n}.frame(minHeight: 200)`;
    }
    case "breadcrumbs": {
      const items = (p.items as Array<{ label: string }>) ?? [];
      const labels = items.map((it) => `Text("${escapeSwift(it.label)}")`).join(` + Text(" › ").foregroundColor(Theme.muted) + `);
      return `(${labels || 'Text("")'}).font(.caption).foregroundColor(Theme.muted)`;
    }
    // Commerce: present the product, link to the web page for purchase.
    // Checkout/IAP is a protected zone — never generated here.
    case "productCard":
    case "buyBox":
    case "featuredProduct":
      return `ProductLink(ref: "${escapeSwift(String(p.product ?? p.binding ?? ""))}")`;
    // Small-business blocks (plan §22): native-honest translations.
    case "contactForm": {
      const endpoint = escapeSwift(String(p.endpoint ?? ""));
      if (p.provider === "mailto" && endpoint) {
        return `Link("${escapeSwift(String(p.submitLabel ?? "Email us"))}", destination: URL(string: "mailto:${endpoint}")!).buttonStyle(.borderedProminent).tint(Theme.ink)`;
      }
      return placeholder("contactForm (web form — link out or use mailto natively)");
    }
    case "video": {
      const src = String(p.src ?? "");
      const url =
        p.kind === "youtube" ? `https://www.youtube.com/watch?v=${src}` : p.kind === "vimeo" ? `https://vimeo.com/${src}` : "";
      if (!url) return placeholder("video (local file — bundle it in the Xcode project)");
      return `Link(destination: URL(string: "${escapeSwift(url)}")!) { HStack { Image(systemName: "play.circle.fill"); Text("${escapeSwift(String(p.caption ?? "Watch the video"))}") }.padding(14).background(Theme.paper).clipShape(RoundedRectangle(cornerRadius: 14)) }.tint(Theme.ink)`;
    }
    case "socialRow": {
      const links = (p.links as Array<{ platform: string; href: string }>) ?? [];
      const items = links
        .filter((l) => /^https?:|^mailto:|^tel:/.test(l.href))
        .map((l) => `Link("${escapeSwift(l.platform)}", destination: URL(string: "${escapeSwift(l.href)}")!)`);
      return `HStack(spacing: 14) {\n${items.map((v) => indent(v, 1)).join("\n")}\n}.font(.subheadline).tint(Theme.accent)`;
    }
    case "hoursTable": {
      const rows = (p.rows as Array<{ days: string; hours: string }>) ?? [];
      const lines = rows.map(
        (r) => `HStack { Text("${escapeSwift(String(r.days))}").fontWeight(.medium); Spacer(); Text("${escapeSwift(String(r.hours))}").foregroundColor(Theme.muted) }`
      );
      const head = typeof p.heading === "string" && p.heading ? [`Text("${escapeSwift(p.heading)}").font(.headline)`] : [];
      return `VStack(alignment: .leading, spacing: 8) {\n${[...head, ...lines].map((v) => indent(v, 1)).join("\n")}\n}.padding(16).background(Theme.paper).clipShape(RoundedRectangle(cornerRadius: 16))`;
    }
    case "csvTable":
      return placeholder("csvTable (tabular data — view on the website)");
    case "specTable": {
      const rows = (p.rows as Array<{ label: string; value: string }>) ?? [];
      const lines = rows.map(
        (r) => `HStack { Text("${escapeSwift(String(r.label))}").fontWeight(.medium); Spacer(); Text("${escapeSwift(String(r.value))}").foregroundColor(Theme.muted) }`
      );
      const head = typeof p.heading === "string" && p.heading ? [`Text("${escapeSwift(p.heading)}").font(.headline)`] : [];
      return `VStack(alignment: .leading, spacing: 8) {\n${[...head, ...lines].map((v) => indent(v, 1)).join("\n")}\n}.padding(16).background(Theme.paper).clipShape(RoundedRectangle(cornerRadius: 16))`;
    }
    case "mapLink": {
      const address = escapeSwift(String(p.address ?? ""));
      return `Link(destination: URL(string: "https://maps.apple.com/?q=${escapeSwift(encodeURIComponent(String(p.address ?? "")))}")!) { HStack { Image(systemName: "mappin.and.ellipse"); VStack(alignment: .leading) { Text("${escapeSwift(String(p.label ?? "Find us"))}").fontWeight(.medium); Text("${address}").font(.caption).foregroundColor(Theme.muted) } }.padding(14).background(Theme.paper).clipShape(RoundedRectangle(cornerRadius: 14)) }.tint(Theme.ink)`;
    }
    // The floating ▲/▼ navigator is wired at the PAGE level (it needs the
    // ScrollViewReader proxy) — pageToSwiftView lifts it out. A nested one
    // is a validation error on the web side; render nothing rather than a
    // confusing placeholder.
    case "sectionJumper":
      return `EmptyView()`;
    // iOS owns appearance: the app's Theme colors are dynamic (see
    // Theme.swift when dark mode is enabled), so the system Settings
    // toggle IS the switcher. An in-app override control would fight it.
    case "appearanceSwitcher":
      return `EmptyView()`;
    default:
      return placeholder(block.type);
  }
}

export function pageToSwiftView(page: Page): string {
  const typeName = swiftTypeName(page.slug);
  // A top-level sectionJumper becomes the native pattern: ScrollViewReader
  // + a floating SectionJumperControl overlay that hops `.id()`-tagged
  // sections. Pages without one keep the original (simpler) shape.
  const jumper = page.sections.find((b) => b.type === "sectionJumper");
  const content = jumper ? page.sections.filter((b) => b.type !== "sectionJumper") : page.sections;
  const body = content.map(blockToSwift);

  if (jumper) {
    const jp = jumper.props as { edge?: string };
    const edge = jp.edge === "left" ? ".leading" : ".trailing";
    const padEdge = jp.edge === "left" ? ".leading" : ".trailing";
    const inner = body.length
      ? body.map((v, i) => indent(`${v}.id(${i})`, 5)).join("\n")
      : indent('Text("This page is empty.").id(0)', 5);
    return `struct ${typeName}: View {
    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
${inner}
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
            }
            .overlay(alignment: ${edge}) {
                SectionJumperControl(proxy: proxy, count: ${Math.max(body.length, 1)})
                    .padding(${padEdge}, 12)
            }
        }
        .navigationTitle("${escapeSwift(page.title)}")
        .background(Theme.cream.ignoresSafeArea())
    }
}`;
  }

  const inner = body.length
    ? body.map((v) => indent(v, 4)).join("\n")
    : indent('Text("This page is empty.")', 4);
  return `struct ${typeName}: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
${inner}
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
        }
        .navigationTitle("${escapeSwift(page.title)}")
        .background(Theme.cream.ignoresSafeArea())
    }
}`;
}

// ── the project ─────────────────────────────────────────────
function hexToSwiftColor(hex: string): string {
  const h = hex.replace(/^#/, "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h.slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  return `Color(red: ${r.toFixed(3)}, green: ${g.toFixed(3)}, blue: ${b.toFixed(3)})`;
}

export function themeSwift(theme: Theme | null): string {
  const c = theme?.tokens.colors ?? {};
  // Appearance enabled → native dark mode: every Theme color becomes a
  // dynamic UIColor that follows the system light/dark setting, using the
  // same Night palette (explicit darkColors over the derived flip) as the
  // web export. Candlelight stays a web feature (noted in the README).
  if (theme?.appearance?.enabled) {
    const dark = nightPalette(theme);
    const adaptive = (name: string, fallback: string, darkFallback: string) =>
      `adaptive(${hexToSwiftColor(c[name] ?? fallback)}, ${hexToSwiftColor(dark[name] ?? darkFallback)})`;
    return `import SwiftUI
import UIKit

// Generated from your builder theme tokens — WITH dark mode. Each color
// is dynamic: it follows the device's light/dark appearance using the
// same Night palette as your website export.
enum Theme {
    static let ink = ${adaptive("ink", "#1A1612", "#F0E9DC")}
    static let cream = ${adaptive("cream", "#F5EFE3", "#171310")}
    static let accent = ${adaptive("accent", "#B08842", "#C49A52")}
    static let muted = ${adaptive("muted", "#6B655D", "#A39C92")}
    static let paper = ${adaptive("paper", "#FFFFFF", "#262119")}

    private static func adaptive(_ light: Color, _ dark: Color) -> Color {
        Color(UIColor { traits in
            traits.userInterfaceStyle == .dark ? UIColor(dark) : UIColor(light)
        })
    }
}
`;
  }
  const color = (name: string, fallback: string) => hexToSwiftColor(c[name] ?? fallback);
  return `import SwiftUI

// Generated from your builder theme tokens. Edit here to restyle the app.
enum Theme {
    static let ink = ${color("ink", "#1A1612")}
    static let cream = ${color("cream", "#F5EFE3")}
    static let accent = ${color("accent", "#B08842")}
    static let muted = ${color("muted", "#6B655D")}
    static let paper = ${color("paper", "#FFFFFF")}
}
`;
}

const SUPPORT_VIEWS = `import SwiftUI

// Async image loader with a calm placeholder.
struct RemoteImage: View {
    let url: String
    var body: some View {
        AsyncImage(url: URL(string: url)) { phase in
            switch phase {
            case .success(let image): image.resizable().scaledToFit()
            case .failure: Color.gray.opacity(0.15).frame(height: 160)
            default: Color.gray.opacity(0.08).frame(height: 160)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// A block type with no native mapping yet — visible, never silent.
struct BuilderPlaceholder: View {
    let label: String
    var body: some View {
        Text(label)
            .font(.footnote)
            .foregroundColor(Theme.muted)
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.accent.opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

// Floating ▲/▼ section navigator — the native counterpart of the web
// sectionJumper block. Hops the ScrollView between .id()-tagged
// sections; the useful direction gets the accent fill, dead ends dim.
struct SectionJumperControl: View {
    let proxy: ScrollViewProxy
    let count: Int
    @State private var current = 0
    var body: some View {
        VStack(spacing: 10) {
            jumpButton(up: true, enabled: current > 0)
            jumpButton(up: false, enabled: current < count - 1)
        }
    }
    private func step(_ delta: Int) {
        current = min(max(current + delta, 0), max(count - 1, 0))
        withAnimation(.easeInOut) { proxy.scrollTo(current, anchor: .top) }
    }
    private func jumpButton(up: Bool, enabled: Bool) -> some View {
        Button { step(up ? -1 : 1) } label: {
            Image(systemName: up ? "chevron.up" : "chevron.down")
                .font(.system(size: 16, weight: .semibold))
                .frame(width: 48, height: 48)
                .background(enabled ? Theme.accent : Theme.paper.opacity(0.85))
                .foregroundColor(enabled ? Theme.cream : Theme.muted)
                .clipShape(Circle())
                .shadow(radius: 3)
        }
        .disabled(!enabled)
        .accessibilityLabel(up ? "Previous section" : "Next section")
    }
}

// Commerce is view-only in the app: link out to the web product page.
// Checkout / in-app purchase is intentionally NOT generated.
struct ProductLink: View {
    let ref: String
    var body: some View {
        Link(destination: URL(string: "\\(AppConfig.webBaseURL)/shop/\\(ref)")!) {
            HStack {
                Text("View product").fontWeight(.medium)
                Spacer()
                Image(systemName: "arrow.up.right")
            }
            .padding(16)
            .background(Theme.paper)
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
        .tint(Theme.ink)
    }
}
`;

/** Returns relative-path → file-content for a complete SwiftUI project. */
export function buildSwiftUIProject(
  pages: Page[],
  theme: Theme | null,
  siteName: string,
  webBaseURL = "https://example.com"
): Record<string, string> {
  // Module/base name (no suffix); the @main struct appends "App" → e.g.
  // "LusikSons" → struct LusikSonsApp. Avoids a doubled "AppApp".
  const appName = swiftTypeName(siteName, "");
  const homeSlug = pages.find((p) => p.slug === "index")?.slug ?? pages[0]?.slug ?? "home";
  const home = swiftTypeName(homeSlug);
  const files: Record<string, string> = {};

  files["Package.swift"] = `// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "${appName}",
    platforms: [.iOS(.v16)],
    targets: [.executableTarget(name: "${appName}", path: "Sources/${appName}")]
)
`;

  files[`Sources/${appName}/AppConfig.swift`] = `import Foundation\n\nenum AppConfig {\n    static let webBaseURL = "${escapeSwift(webBaseURL)}"\n}\n`;
  files[`Sources/${appName}/Theme.swift`] = themeSwift(theme);
  files[`Sources/${appName}/SupportViews.swift`] = SUPPORT_VIEWS;

  files[`Sources/${appName}/${appName}App.swift`] = `import SwiftUI

@main
struct ${appName}App: App {
    var body: some Scene {
        WindowGroup {
            NavigationStack { ${home}() }
        }
    }
}
`;

  for (const page of pages) {
    files[`Sources/${appName}/Views/${swiftTypeName(page.slug)}.swift`] = `import SwiftUI\n\n${pageToSwiftView(page)}\n`;
  }

  files["README.md"] = `# ${siteName} — SwiftUI app (generated)

A native iOS app scaffold generated from your builder pages. **This is a
starting point, not a finished App Store build** — open it on a Mac and
expect to iterate.

## Run it
1. Get this folder onto a **Mac** (your own, or a cloud Mac: MacinCloud,
   MacStadium, AWS EC2 Mac, Scaleway).
2. Open the folder in **Xcode** (it reads Package.swift), or drag the
   Sources into a new iOS App project.
3. Build & run in the **iOS Simulator** — free, no account needed.

## Onto a real iPhone / TestFlight
- Needs an **Apple Developer account** ($99/yr) and code signing
  (Xcode → Signing & Capabilities → enable automatic signing).
- Archive → upload to App Store Connect → TestFlight.
- The App Developer Mode checklist in the builder covers every step.

## Honest notes
- Pages render as SwiftUI Views translated from your blocks — faithful,
  not pixel-identical to the website.
- **Commerce is view-only:** products link out to your website for
  purchase. No in-app purchase / checkout code is generated (Apple's
  rules + your safety gates both apply).
- Blocks with no native mapping show a labeled placeholder — search the
  project for "not yet available natively" to find them.
- Theme colors live in Theme.swift; edit there to restyle everything.
- **Dark mode:** if your builder theme has appearance enabled, Theme.swift
  ships dynamic colors that follow the iPhone's light/dark setting — same
  Night palette as the website. The web appearanceSwitcher block renders
  nothing natively (iOS Settings is the switcher), and Candlelight is a
  web-only effect.
`;

  return files;
}
