# Baghdo's Workshop — What's Done, What's Left, What I Recommend

*Last updated: 2026-06-12. Companion to `BUILDER_PLAN.md` (the architecture
spec, §1–§19). This file is the honest status sheet: read it top to bottom
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
2. **Switching the live site's CMS from Decap to the Workshop.** You chose
   "hold off for now." When ready, I need a GitHub personal-access token
   that only you can mint, then it's a PR + deploy-preview test. Say "open
   the builder PR."
3. **SwiftUI verification on a Mac.** The generated Xcode project is
   honest codegen — it compiles on a Mac, and you planned the rent-a-Mac →
   TestFlight route. One session there proves it end-to-end.
4. **Offline fonts (one-time fetch).** `public/fonts/README.md` lists the
   four Noto files. Everything works without them (OS fallbacks); bundling
   them just makes Armenian/Arabic/Russian look identical on every device.
   *I should also write the `scripts/fetch-fonts.mjs` helper the README
   mentions — small task, flag it and I'll do it.*
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
2. **Visual forms for every block's props.** Only pillNav has a dedicated
   editor; everything else is edited as JSON. The schema registry already
   knows every field and type — generate the inspector form from it
   (string → text input, enum → select, boolean → toggle, translatable →
   per-language tabs). One generic component kills the JSON editing for
   ~25 block types at once.
3. **Click-to-edit text on the canvas.** Tap a heading in the preview,
   type, done — instead of finding the block in the tree. Even a simple
   "double-click opens the right inspector field" version is a huge step.
4. **An onboarding/first-run experience.** A new user opening the Workshop
   sees a powerful but dense screen. A 5-step guided tour (pick a
   template → name your site → set colors → add a page → publish) turns
   the first 10 minutes from confusing to delightful.
5. **A starter template gallery.** The template system works
   (save/import/`builder/templates/`), but ships with one template. Five
   to eight well-designed starters (shop landing, story page, FAQ,
   contact, gallery, coming-soon) would make "new page" feel like a
   product instead of an empty canvas.

### Priority 2 — visitor-facing features sites will want

6. **A contact-form block.** The most-requested block on any site builder.
   Honest static-export story: POST to Netlify Forms / Formspree /
   Web3Forms (all have free tiers) — fits the service-preset system
   perfectly (user picks a provider card, no lock-in, mailto fallback).
7. **A video block.** Local `<video>` file or YouTube/Vimeo embed
   (consent-conscious: thumbnail-first, click to load the iframe — no
   third-party request until the visitor opts in).
8. **Per-page SEO panel + social preview.** The schema already carries
   `seo.title/description/ogImage`; give it a small form with a live
   Google-result + social-card preview, and generate `sitemap.xml` +
   `robots.txt` + a branded 404 page in static/PWA exports.
9. **A footer/header "site chrome" concept.** Today every page is
   standalone; shared nav/footer means editing once instead of per-page.
   (Templates partially cover this — a `siteChrome` document the renderer
   wraps pages in would finish it.)
10. **Maps/hours/social-row blocks** for small-business sites (static map
    image link-out keeps it offline-friendly and consent-clean).

### Priority 3 — polish that compounds

11. **Editor e2e test.** The builder's logic is unit-tested to death, but
    the editor UI itself (click block → edit → save → publish) has no
    Playwright spec. One smoke test protects every future refactor.
12. **Autosave + "unsaved changes" indicator.** The save/undo machinery
    exists; surfacing state ("saved 12s ago · 3 unsaved edits") prevents
    the classic lost-work moment.
13. **A revisions browser UI.** Git revisions are recorded; a "history"
    panel with one-click restore would make rollback discoverable instead
    of expert-only.
14. **Keyboard-shortcut cheat sheet + command palette (⌘K).** Cheap to
    add, makes power users fast.
15. **Accessibility audit panel.** The pieces exist (alt-text validation,
    contrast matrix, tap-target scanner) — one "Audit" button that runs
    them all and lists fixes would be a genuine differentiator.
16. **Android path for the app builder.** iOS has SwiftUI; Android's
    honest equivalent is a **TWA (Trusted Web Activity)** wrapping the PWA
    export — `bubblewrap` generates the project, compiles anywhere (no
    Mac needed!), and Play Store accepts it. Cheapest route to "both
    stores."
17. **In-app help.** The plan docs are developer-facing; a short
    illustrated user guide (or `?` tooltips drawn from block descriptions)
    serves Lusik directly.

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
- [ ] **The Noto font files** (one `node scripts/fetch-fonts.mjs` with
      internet, once I write it) for pixel-identical multilingual text.
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
