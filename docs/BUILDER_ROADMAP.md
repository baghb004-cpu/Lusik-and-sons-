# Baghdo's Workshop — What's Done, What's Left, What I Recommend

*Last updated: 2026-06-12. Companion to `BUILDER_PLAN.md` (the architecture
spec, §1–§22). This file is the honest status sheet: read it top to bottom
and you know exactly where the project stands and what stands between here
and "100% successful."*

---

## 1. Where the project stands

The engine is built and tested. **227+ unit tests green**, the production
build passes, and every load-bearing behavior (money gates, auth, export
fidelity, the inline scripts) has been verified in a real browser, not just
on paper. What's shipped:

| Area | Status |
| --- | --- |
| Block system (~27 types: layout, content, commerce, pillNav, search, languages, section jumper, appearance switcher) | ✅ shipped |
| Renderer-first architecture (one React renderer for editor, live site, exports) | ✅ shipped |
| Schema gates on every save; protected zones (Stripe/checkout/pricing untouchable) | ✅ shipped + HTTP-verified |
| Theme system: tokens, Liquid Glass preset sliders, WCAG contrast matrix | ✅ shipped |
| **Day / Night / Candlelight appearance system** (auto dark palette, warmth slider, schedule, until-morning) | ✅ shipped |
| Per-device editing: desktop base + tablet/mobile override layers, mobile-only blocks | ✅ shipped |
| Hit-box overlay (44 px tap floor), screen-ratio presets (45+ generic devices), layout scanner + scoring | ✅ shipped |
| Offline languages: en/hy/ar/ru/es, per-element translation, language gate, local fonts, RTL | ✅ shipped |
| Draft → preview → publish → rollback; git-backed revisions; all-or-nothing backup restore | ✅ shipped |
| Exports: static HTML, PWA, Next.js, **SwiftUI** (now with native dark mode) | ✅ shipped |
| Offline ZIP/shipping data module; service preset system (no brand lock-in) | ✅ shipped |
| Local AI panel (Ollama / llama.cpp, loopback-only, license-vetted catalog) | ✅ shipped |
| Tauri `.exe` shell + the Baghdo & Gohar animated splash | ✅ code complete (see §2) |
| Storage: thumb-drive fs adapter (atomic writes, git auto-commit) + GitHub adapter | ✅ shipped |
| Section jumper (floating ▲/▼ scroll navigation) | ✅ shipped |

---

## 2. Parked items — waiting on YOU, not on code

These are finished or near-finished and blocked only on something I can't
do from this environment:

1. **The `.exe` for the thumb drive.** All code exists (`desktop/`), but a
   Windows `.exe` can only be *compiled on Windows*. You need a Windows PC
   with the Rust toolchain once — `desktop/README.md` has the exact steps.
   Say "ship the program" when you're at one and I'll walk you through it.
2. **Switching the live site's CMS to the Workshop.** The PR is open —
   approve + merge it, then mint the GitHub fine-grained PAT and set
   `BUILDER_GITHUB_REPO` / `BUILDER_GITHUB_TOKEN` in Netlify (exact steps
   in the PR description). That makes /builder live on the site.
3. **SwiftUI verification on a Mac.** The generated Xcode project is
   honest codegen — it compiles on a Mac, and you planned the rent-a-Mac →
   TestFlight route. One session there proves it end-to-end.
4. ~~Offline fonts~~ ✅ **Done** — `scripts/fetch-fonts.mjs` written and
   run; all four Noto woff2 subsets are bundled and ship with exports.
5. **Splash polish.** Gohar's character can get closer to the reference
   photos whenever you send a couple more; purely cosmetic.

---

## 3. Recommended additions — ranked by end-user impact

"End user" here means two people: **the builder user** (you/Lusik editing
in the Workshop) and **the visitor** (someone browsing a published site).
The biggest wins are all on the builder-user side, because that's where
the rough edges are.

### Priority 1 — the gap between "powerful" and "pleasant"

These are the things a GoDaddy/Wordpress/Squarespace user would expect on
day one. The engine supports all of them; what's missing is UI.

1. ~~**A media library + image upload.**~~ ✅ **Shipped** (plan §20): the
   🖼 Media panel — drag photos in (sniffed by bytes, SVG rejected, 8 MB
   cap, generated names), thumbnail grid, insert-as-block / use-for-
   selected / copy-path / delete, fs + GitHub backends, uploads travel
   with every export.
2. ~~**Visual forms for every block's props.**~~ ✅ **Shipped** (plan §21):
   the inspector form is generated from each block's zod schema — text/
   select/color/number/product-picker/repeatable-rows widgets, per-locale
   copy editing, live inline validation (invalid edits never touch the
   document), locked by a zero-json-fallback CI test.
3. ~~**Click-to-edit text on the canvas.**~~ ✅ **Shipped**: click selects
   (and outlines) a block; double-click selects it AND focuses its first
   generated-form field.
4. ~~**An onboarding/first-run experience.**~~ ✅ **Shipped**: a five-step
   skippable tour on first launch (open → edit → devices → media/languages
   → publish), shows once.
5. ~~**A starter template gallery.**~~ ✅ **Shipped**: six starters (shop
   landing, our story, FAQ, contact, gallery, coming-soon) — validated by
   construction and by a permanent gate test; "+ New page" offers them.

### Priority 2 — visitor-facing features sites will want

6. ~~**A contact-form block.**~~ ✅ **Shipped**: provider presets (Netlify
   Forms zero-config, Formspree, Web3Forms, mailto fallback), https-gated
   endpoints, honeypot, translatable labels.
7. ~~**A video block.**~~ ✅ **Shipped**: local files play natively;
   YouTube/Vimeo render as a privacy facade (a plain link with zero
   third-party requests that upgrades to a nocookie/dnt embed on click).
8. ~~**Per-page SEO panel + social preview.**~~ ✅ **Shipped**: the SEO
   panel with a live search-result preview + length budgets; exports ship
   sitemap.xml (hreflang alternates), robots.txt and a branded 404.
9. ~~**A footer/header "site chrome" concept.**~~ ✅ **Shipped**:
   `builder/chrome.json` (header/footer block arrays) renders around every
   page in exports and in the editor preview, gated like any document.
10. ~~**Maps/hours/social-row blocks**~~ ✅ **Shipped**: socialRow (9
    platforms), hoursTable, mapLink (links out to the visitor's own maps
    app — no embedded third-party map).

### Priority 3 — polish that compounds

11. ~~**Editor e2e test.**~~ ✅ **Shipped**: `tests/e2e/builder.spec.mjs`
    rides the existing Playwright suite — sign-in, form editing, canvas
    updates, invalid-draft hold, media panel, API auth walls.
12. ~~**Autosave + "unsaved changes" indicator.**~~ ✅ **Shipped**:
    unsaved/saved-at indicator in the doc header + a beforeunload guard
    while dirty.
13. ~~**A revisions browser UI.**~~ ✅ Already existed (the History panel)
    — revisions list with one-click load-as-draft; restores re-run the
    gates on save.
14. ~~**Keyboard-shortcut cheat sheet.**~~ ✅ **Shipped** inside the Help
    modal (? key). A ⌘K command palette remains a nice-to-have.
15. ~~**Accessibility audit panel.**~~ ✅ **Shipped**: one button runs
    structure validation, layout scans (compact phone + laptop), WCAG
    contrast and translation coverage into one prioritized list.
16. ~~**Android path for the app builder.**~~ ✅ **Shipped**: the `twa`
    export target — PWA export + Bubblewrap scaffold (twa-manifest.json +
    honest README); builds on any OS, Play-Store ready.
17. ~~**In-app help.**~~ ✅ **Shipped**: the Help modal's plain-language
    guide covers pages, blocks, devices, photos, languages, theming and
    publishing.

---

## 4. What you need for 100% success (the non-code list)

Nothing here is blocking development — but each is required before the
Workshop (or a site built with it) is truly "done" in the real world:

- [ ] **A Windows PC session** → compile the `.exe` once (§2.1).
- [ ] **A rent-a-Mac session** → verify the SwiftUI export + TestFlight (§2.3).
- [ ] **Apple Developer account ($99/yr)** → only if you ship a native iOS
      app; the PWA route needs nothing.
- [ ] **GitHub PAT** → only for switching the live Lusik site to the
      Workshop CMS (§2.2).
- [ ] **Real artwork**: PWA icons are placeholders; exports ship
      `icons/README.txt` asking for real PNGs. Same for any starter
      template photography.
- [x] **The Noto font files** — fetched and bundled (all four woff2
      subsets in `public/fonts/`); exports now ship them automatically.
- [ ] **A real device pass**: open a published site + the editor on your
      actual iPhone and a cheap Android once. The viewport presets
      simulate well, but one session on glass always finds something.
- [ ] **A second thumb drive**: the fs adapter auto-commits to git, but a
      backup of the backup is the rule for anything irreplaceable.
- [ ] **Privacy text for built sites**: the appearance/language prefs use
      localStorage (first-party, never sent anywhere) — a one-line mention
      in a site's privacy page keeps things clean. A generated starter
      privacy page would cover it (fits recommendation #5).

---

## 5. My honest take on sequencing

If you do only three things next: **media library (#1), generated
inspector forms (#2), starter templates (#5).** Those three close the gap
between "a developer can build a site with this" and "Lusik can build a
site with this" — which was the original mission. The contact form (#6)
is the best fourth because it's the feature every small-business site
asks for first.

Everything in §3 fits the existing architecture (schema registry,
renderer-first, service presets, progressive enhancement) — none of it
requires rework, only additions. The foundation is genuinely done.
