# The Builder — user guide

The visual builder/CMS at **`/builder`**. Edits the live site's content,
builds new pages from blocks, themes everything, polishes mobile
separately, and exports whole sites. Every save passes the same
validation gates as the production build — you cannot save something
that would break the site, drift a price from Stripe, or smuggle in a
script. (Architecture: `docs/BUILDER_PLAN.md`.)

## Getting in

| Mode | How |
| --- | --- |
| Hosted (lusikandsons.com/builder) | Sign in with an admin account (Netlify Identity) |
| Local / home server / thumb drive | Set `BUILDER_LOCAL_TOKEN` (≥16 chars) in the environment, run `npm run next:dev` (or `next start`), enter the token on the access screen |

Hosted saves commit to GitHub (set `BUILDER_GITHUB_REPO` + a fine-grained
`BUILDER_GITHUB_TOKEN`, contents-only, one repo). Local saves are plain
files — commit them with git whenever you like.

## The three panels

**Left — documents.** Site content grouped by collection (Products,
Categories, Page surfaces), plus your builder Pages and Templates.
Buttons: **+ New page**, **Export site ↓**, **Backup ↓ / Restore ↑**,
**Import template**.

**Middle — preview.** Renders the open page with the real block
renderer. Toolbar: **desktop / tablet / mobile** widths, **◎ Hit boxes**
(tap-target overlay — red means under 44px or overlapping), **▭ Safe
areas** (notch/home-indicator simulation on mobile), **Undo/Redo**.
Click any block in the preview to select it.

**Right — editing.** Content collections get forms; the theme gets the
theme panel; builder pages get the block inspector. Below it: the
validation panel (errors block saving; warnings don't) and **History**.

## Editing site content

Open anything under Products/Categories/Page surfaces and edit the form.
Money fields (price, status, trusted key) carry warnings — a live
product's price must match the server's Stripe price to the cent or the
save is refused with the exact reason. The JSON toggle is always there
for power edits; it runs the same gates.

## Pages & templates

**+ New page** → title (slug auto-fills) → optionally start from a
template. Per-page actions: Duplicate, Rename/slug (old links break —
add a redirect if it was shared), Save as template, Export ↓ (the JSON),
Delete. Templates import/export as plain JSON files.

Add blocks with the **+ Add block…** menu (19 types: layout, text,
images, navigation, commerce). Select a block to get the floating
toolbar — move, duplicate, delete, lock, rotate (images) — drag the
right-edge handle to resize (snaps to a 5% grid), drag rows in the
inspector tree to reorder. Ctrl/Cmd+Z undoes; typing coalesces into
single undo steps.

## Theme

Open `builder/theme.json`: brand colors (with a live WCAG readability
matrix — keep AA green), fonts, type/spacing/radius/shadow scales, and
the **glass presets** (Liquid Glass / Frosted / Solid) with the full
slider set and a live pill preview. Tokens flow everywhere as CSS
variables; documents never need re-editing after a re-theme.

## Mobile polish

Switch the device toggle to **tablet** or **mobile**, select a block:
your visibility/spacing/alignment/width edits go into a separate
override layer that **desktop never reads** — mobile polish cannot break
desktop, ever. "Reset to desktop" dissolves an override. Mobile-only
blocks exist only on phones. If a block with overrides is deleted, the
validation panel offers one-click pruning of the orphans.

## The pill menu

On a builder page: **+ Add Liquid Glass pill menu** (seeds the live
site's nav, mobile-only). Its panel edits buttons (max 5 — thumb reach),
icons, links, position, labels, height/roundness; its *appearance* is a
theme glass preset. One pill per page, top-level only — the gate
enforces both. Use the hit-box overlay to confirm nothing sits under it.

## Commerce blocks

Product cards/grids/featured/related, swatch rows, inventory badges and
the **buy box** all *reference* the catalog — names, photos and prices
resolve from the same gate-checked data as the live shop, and a buy box
on a non-buyable product is refused at save. Checkout itself is never
editable here, by design.

## Export, backup, history

- **Export site ↓** — static HTML (zero JavaScript, deploy on any
  static host; mobile overrides compile to CSS) or a runnable Next.js
  project. Local mode only for now; output lands in `exports/`.
- **Backup ↓** — a zip of every document (works hosted AND local). Keep
  one on the thumb drive.
- **Restore ↑** — upload a backup zip. All-or-nothing: every file is
  validated first; one bad document and nothing changes.
- **History** — per-document git history. *Load* an old version, review
  it in the editor, then Save — restores pass the same gates as any
  edit.

## Environment variables

| Var | Mode | Purpose |
| --- | --- | --- |
| `BUILDER_LOCAL_TOKEN` | local | access token for the editor (≥16 chars; never set on the hosted site) |
| `BUILDER_GITHUB_REPO` / `BUILDER_GITHUB_TOKEN` / `BUILDER_GITHUB_BRANCH` | hosted | saves-as-commits backend (fine-grained token, one repo, contents-only) |
| `BUILDER_BACKEND` | both | force `fs` or `github` (defaults sensibly) |
| `ADMIN_EMAILS` | hosted | admin allowlist fallback (same as the order dashboard) |
