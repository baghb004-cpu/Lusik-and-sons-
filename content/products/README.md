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
| `status` | ✅ | enum | `draft` (excluded from the site entirely) or `placeholder` (shows the coming-soon / commission page). **`live` is not allowed yet** — see below. |
| `priceFrom` | ✅ | number \| null | **Display only.** `null` → "price coming soon". A number → "From $N". **Not** the checkout price. |
| `tagline` | ✅ | string | One-line hook. |
| `description` | ✅ | string | Full product story. |
| `coverImage` | – | string | Absolute path (`/img/...`). Category-card thumbnail. |
| `images` | – | string[] | Gallery paths. |
| `stripePriceId` | – | string | **Reserved / unused today.** Placeholder for the future Stripe reconciliation phase. |
| `displayOrder` | – | number | Sort order within the category (ascending; missing = last, tie-broken by slug). Sort-only — not stored on the product object. |

## Important guardrails

- **Prices here never reach checkout.** The trusted checkout price stays server-side
  in `netlify/functions/_lib/trusted-products.mjs`. `priceFrom`/`stripePriceId` are
  display/metadata only.
- **`status: "live"` is intentionally rejected by the generator.** Making a CMS
  product buyable requires a deliberate reconciliation phase (a matching
  `trusted-products.mjs` entry + a product view). Keep new products `placeholder`.
- The live, configurable products (the Armenian Alphabet Blanket and the bib) stay
  hardcoded in `src/data/catalog.js` / `product.js` for now — they are **not** managed
  here yet.

## Adding / editing a product
1. Add or edit a `.json` file here (or use `/studio`).
2. `npm run gen:products` (runs automatically on build/dev/typecheck).
3. The build fails with a clear message if anything is invalid.
