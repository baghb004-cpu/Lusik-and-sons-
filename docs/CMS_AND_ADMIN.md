# CMS & Admin architecture

Handoff reference for the two private surfaces and the content/product pipeline.
Written during the CMS handoff (Phases 1–2 shipped). Pairs with the
`/admin` vs `/studio` note in `CLAUDE.md`.

---

## 1. Two private surfaces (do not confuse them)

| Surface | URL | What it is | Auth |
|---|---|---|---|
| **Order dashboard** | `/admin` | Next.js route (`app/admin/page.tsx` → `AdminRoute` → `AdminView`). Orders, fulfillment, tracking, finished-photo upload, waitlist notify. | Identity login **+ admin role**; client renders nothing for non-admins; data comes only from `admin-*` Functions that enforce `requireAdmin`. |
| **Content Studio** | `/studio` | Static Decap CMS SPA (`public/studio/`), Git-Gateway backed. Edits **journal** + **products** (+ categories & site content). Stock, out-of-the-box setup since July 2026: **direct publish** — saving commits to `main`; no editorial workflow. | Identity login **+ Git Gateway** + invited editor. Scoped looser CSP (`netlify.toml` `for = "/studio/*"`). |

They used to collide at `/admin` (the Next route shadowed the static CMS); the CMS
was moved to `/studio` so both work.

---

## 2. Product CMS pipeline (Phases 1–2)

**Goal:** edit products without code, while the storefront stays fully static/SSG
(no runtime DB, no extra JS for shoppers).

```
content/products/*.json          (one file per product; edited by hand or in /studio → "Products")
      │
      ▼  scripts/gen-products.mjs   (prebuild step: VALIDATES, then compiles)
src/data/cmsProductsData.generated.js   (gitignored; CMS_PRODUCTS grouped by category)
      │
      ▼  merged in src/data/catalog.js  (into CATALOG, by category)
storefront (static /shop/* pages, SSG)   + schema.org/Product JSON-LD for free
```

- **Schema:** `content/products/README.md` (category, key, slug, name, status,
  priceFrom, tagline, description, optional coverImage/images/stripePriceId,
  sort-only displayOrder).
- **Build safety:** the generator THROWS — failing the build/deploy — on invalid
  JSON, missing/empty required fields, bad slug, bad status, or bad price. Bad CMS
  data can never silently ship.
- **Status:** `draft` (hidden everywhere) or `placeholder` (coming-soon page).
  **`live` is intentionally rejected by the generator** (see §4).
- **What's CMS-managed today:** the simple placeholders — `towels/embroidered-hand-towel`,
  `towels/armenian-baptism-towel`, `baby/baby-swaddle`, `baby/baby-bathrobe`.
- **What's still hardcoded (on purpose):** the live, configurable products
  (Armenian Alphabet Blanket, baby bib) and the **complex placeholders**
  (full-alphabet crib blanket + the 4 bib placeholders). The complex ones carry
  staged `images`/`colorways`/`details` for their future live view — that data
  isn't shown on a placeholder page, and moving it into Decap risks data loss
  (Decap drops undeclared fields on save). They migrate at their **live-flip**
  (see §4), not before.

To add/edit: edit a file in `content/products/` (or use `/studio`) → push/save →
Netlify rebuild → live. A bad file shows up as a **failed deploy**, never a broken
storefront.

---

## 3. Orders & admin visibility (Phase 5 — already built)

Order data **is persisted** (it is not Stripe-only):

```
Browser ─▶ create-checkout-session.mjs ─▶ Stripe Checkout ─▶ (customer pays)
                                                   │
Stripe ─ webhook ─▶ stripe-webhook.mjs ─┬─ verifies signature
                                        ├─ inserts orders + order_items (Neon Postgres)
                                        └─ fires admin + customer emails (Resend)
```

- **Storage:** Neon Postgres — `orders`, `order_items`, `profiles`, `addresses`,
  `saved_carts` (`netlify/schema.sql`). Stripe remains the source of truth for
  *payment*; the DB is the queryable order store.
- **Dashboard:** `AdminView` reads/writes via `admin-orders.mjs` (and
  `admin-order-photo.mjs`), all behind `requireAdmin`.
- **Security:** no Row-Level Security — every Function checks the Identity JWT and
  filters by `user_id`. Admin = `app_metadata.roles` contains `admin`, or
  `ADMIN_EMAILS` env fallback. **Customer/order data is never exposed publicly.**

**Conclusion:** the secure order architecture already exists. No rebuild needed —
design future order tooling *around Stripe + this DB*, not a duplicate store.

---

## 4. The checkout-price boundary (never violate)

The trusted checkout price lives **only** in
`netlify/functions/_lib/trusted-products.mjs`, keyed by the cart-ID/`productKey`
shape (`src/lib/cartId.ts` `mapLegacyId`). The browser may send anything; Stripe
gets what that file says. The e2e "Pay with Stripe" test guards the contract.

Therefore:
- CMS `priceFrom` / `stripePriceId` are **display/metadata only** — they can never
  become a checkout price.
- The generator **rejects `status: "live"`** so a CMS product can't be made buyable
  without the deliberate reconciliation below.

**Live-flip / Stripe reconciliation phase (future):** to make a CMS product buyable,
(1) add its matching `trusted-products.mjs` entry, (2) add its product view branch,
(3) only then allow `status: "live"`. This is also when the complex placeholders'
staged gallery/colorway data gets used and migrated.

---

## 5. Roadmap status

| Phase | Status |
|---|---|
| 1 — Foundation | ✅ shipped |
| 2 — Product manager (simple placeholders) | ✅ shipped; complex placeholders deferred to live-flip (§2/§4) |
| 3 — Media | ✅ Decap image/gallery widgets wired; deeper tooling when a CMS product uses a real gallery |
| 4 — Content/story | Journal ✅ CMS. Homepage/FAQ/shipping/about copy = **pending a design decision** (it lives in components/i18n; making it CMS-editable is the next feature PR) |
| 5 — Order visibility | ✅ already built (§3) |
| 6 — SEO/structured data | ✅ per-product metadata + schema.org/Product JSON-LD already implemented; CMS products inherit it |
