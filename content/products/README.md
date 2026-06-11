# Product content (`content/products/`)

CMS-managed products. One `.json` file per product, edited either by hand or via
the **Content Studio** (Decap CMS at `/studio` → "Products" collection).

At build time `scripts/gen-products.mjs` reads every file here, **validates** it,
and compiles `src/data/cmsProductsData.generated.js`, which `src/data/catalog.js`
merges into `CATALOG`. The storefront stays **fully static** — no runtime database,
no extra JavaScript for shoppers. A file that fails validation **fails the build**
(it can never silently ship broken data).

## Schema

| Field | Required | Type | Notes |
|---|---|---|---|
| `category` | ✅ | string | Must be an existing `CATALOG` category slug (`blankets`, `bibs`, `towels`, `baby`). Unknown category fails the build. |
| `key` | ✅ | string | Internal product key. |
| `slug` | ✅ | string | URL slug, lowercase kebab-case. Route: `/shop/<category>/<slug>`. **Never change once shared** (old links 404). |
| `name` | ✅ | string | Display name. |
| `status` | ✅ | enum | `draft` (excluded from the site entirely), `placeholder` (coming-soon / commission page), or `live` (buyable — **requires the reconciliation below**). |
| `trustedKey` | live only | string | The `netlify/functions/_lib/trusted-products.mjs` key that vouches for this product's price (e.g. `bib` for the name bib, `blanket-double_diag_br` for the alphabet blanket). The build fails if it's missing/unknown for a live product. |
| `priceFrom` | ✅ | number \| null | **Display only.** `null` → "price coming soon". A number → "From $N". For **live** products it must equal `trustedKey`'s `priceCents` to the cent or the build fails. |
| `tagline` | ✅ | string | One-line hook. |
| `description` | placeholder | string | Full product story. Required for `placeholder` (the coming-soon page renders it); optional for `live` (their own page + the tagline carry it). |
| `name_hy` / `tagline_hy` / `description_hy` | – | string | Optional Armenian translations (rendered via `loc()`). |
| `coverImage` | – | string | Absolute path (`/img/...`). Category-card thumbnail. |
| `images` | – | string[] | Gallery paths, in display order. |
| `colorways` | – | object[] | Gallery color filter: `{ label, indices: number[], swatch }` where `swatch` is one of `{ color }`, `{ dual: [a, b] }`, `{ gradient: [...] }`. Indices point into `images` (0-based; validated). |
| `details` | – | object[] | `{ label, value }` rows (Materials / Size / Care / Made…) on the product page. |
| `stripePriceId` | – | string | **Reserved / unused.** |
| `displayOrder` | – | number | Sort order within the category (ascending; missing = last, tie-broken by slug). Sort-only — not stored on the product object. |

## Important guardrails

- **Prices here never reach checkout.** The trusted checkout price stays server-side
  in `netlify/functions/_lib/trusted-products.mjs` — that map is the entire price
  contract. What the reconciliation adds: a **live** CMS product must name its
  `trustedKey` and display the exact same price, so the customer can never be shown
  a number different from what Stripe charges.
- **Going live is a two-step, deliberately:** (1) a developer prices the product in
  `trusted-products.mjs` (and wires its product view); (2) the CMS entry flips to
  `live` with the matching `trustedKey` + `priceFrom`. Either half alone fails the
  build or the checkout — never silently.
- **All products are CMS-managed now** — the seven live ones included. The
  CONFIGURATOR specs (the blanket's layouts/colors, the bibs' options and cap
  variants) still live in code (`src/data/product.js`, `src/data/customProducts.js`)
  keyed by the product `key`; the CMS owns the catalog presence: names, copy,
  translations, photos, colorways, details, ordering, status.

## Adding / editing a product
1. Add or edit a `.json` file here (or use `/studio`).
2. `npm run gen:products` (runs automatically on build/dev/typecheck).
3. The build fails with a clear message if anything is invalid.
