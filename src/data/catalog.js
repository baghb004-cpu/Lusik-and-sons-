// ============================================================
// CATALOG — full product catalog with status flags + routing slugs
// ============================================================
// Drives the shop mega-menu and the entire /shop/* route hierarchy:
//   /shop                                 → ShopIndexView (4 category cards)
//   /shop/<categorySlug>                  → CategoryView
//   /shop/<categorySlug>/<productSlug>    → ProductView
//
// Each entry's `status` is either:
//   - "live"        : fully buyable; the customer can configure
//                     and pay for it today
//   - "placeholder" : renders a ProductPlaceholderView with the
//                     "image goes here / text goes here" template
//                     and a "Notify me" hook into WaitlistModal
//
// `slug` is the URL fragment and is LOAD-BEARING:
//   - It's saved in inbound shared links + search engine indexes
//   - It must remain stable once a product has been on a public URL
//   - Lowercase, hyphen-separated, ASCII only (no Armenian glyphs)
//
// To add a new product:
//   1. Pick a category (existing or new)
//   2. Give it a `key` (cart-id-shape unchanged from before),
//      a `slug` (URL fragment), `name`, `status`, `tagline`
//   3. For status: "live" — also add the matching entry in
//      PRODUCT (blanket) or CUSTOM_PRODUCTS (bib) AND in
//      netlify/functions/_lib/trusted-products.mjs
//   4. For status: "placeholder" — just the catalog entry is
//      enough. The placeholder page renders automatically.
//
// Most items are currently `placeholder` pending Lusik's photos
// and pricing. DO NOT promote one to `live` without:
//   1. Real photos (uploaded to /img/, removed from
//      CONFIG.ROTATED_GALLERY_INDEXES if it had been there)
//   2. A real `priceFrom`
//   3. A real `description`
//   4. For configurable products: the matching PRODUCT or
//      CUSTOM_PRODUCTS data + trusted-products.mjs entry
// ============================================================

export const CATALOG = {
  blankets: {
    slug: "blankets",
    label: "Blankets",
    // Rewritten to recap WHAT'S inside the category (two distinct
    // pieces, not one) and lead with the heritage angle. Same
    // 2026-voice as the homepage rewrite -- maker + heirloom +
    // search-friendly hooks ("Armenian alphabet", "heritage",
    // "christening", "passed down").
    description: "Lusik's signature work — the pieces she sits with on her kitchen table for thirty hours at a time. Two crib blankets, both Armenian by heritage: a personalized one cross-stitched with the first three letters a child will ever learn, and a full-alphabet one that carries every letter from Ա to Ք. Each one stitched by hand, picked up and checked by Lusik before it ships. Made to order. Made to last for the next baby in the family, and the one after that.",
    eyebrow: "Lusik's signature work",
    products: [
      {
        key: "blanket-alphabet",
        slug: "armenian-alphabet-blanket",
        name: "The Armenian Alphabet Blanket",
        status: "live",                // points to PRODUCT — fully buyable
        // The category-card "From $NN" price. Source of truth for
        // the actual checkout amount is `PRODUCT.layouts[].priceCents`
        // (currently 6500 cents = $65 for the only enabled layout)
        // mirrored on the server in trusted-products.mjs. Keep all
        // three in sync when changing the price.
        priceFrom: 65,
        tagline: "Lusik's signature blanket — Ա Բ Գ, the first three letters a child will learn, stitched corner to corner.",
        // Cover image for the category-grid card thumbnail AND for
        // the second slot of the Blankets category-card hover
        // slideshow. The actual product detail page (ProductShowcase)
        // still uses PRODUCT.gallery[0] as its hero on render -- this
        // is purely the category-level thumbnail.
        coverImage: "/img/abc-blanket/cover.jpg",
      },
      {
        // ============================================================
        // FLIP-TO-LIVE CHECKLIST  (full-alphabet-crib-blanket)
        // ============================================================
        // Pricing confirmed by Lusik (May 2026): $245, about two solid
        // weeks of cross-stitching alone. The initial $165 felt too
        // low for the labor going in -- $245 is the honest heritage
        // price that still reads accessible to a christening-gift
        // buyer. priceFrom is already set below, so this is no
        // longer a "set the price" job -- it's just the live-view +
        // trusted-products wiring left.
        //
        // Until the live view ships, the placeholder page surfaces
        // the $245 number alongside a "write or call to commission"
        // path. Customers see the real price and have a clear
        // way to order; the brand keeps the heritage-maker framing
        // (Hermès made-to-order, Le Labo by-commission) without
        // pretending checkout is coming Real Soon.
        //
        //   1. Below: change `status: "placeholder"` → `status: "live"`
        //      (priceFrom: 245 is already set)
        //   2. In netlify/functions/_lib/trusted-products.mjs:
        //      Uncomment the "blanket-full-alphabet" entry and set
        //      priceCents to 24500 ($245). The server rejects any
        //      cart line item whose productKey isn't in
        //      TRUSTED_PRODUCTS, so this is what makes checkout work.
        //   3. In src/components/shop/ProductView.jsx:
        //      Add a third branch alongside the existing
        //      blanket-alphabet / bib-single cases:
        //          if (product.key === "blanket-full-alphabet") {
        //            return <LiveFullAlphabetView ... />;
        //          }
        //      That component needs to render the same gallery
        //      (already built) + a color radio (one swatch must be
        //      selected before Add-to-Cart enables) + an Add-to-Cart
        //      button that calls onAdd with cart-id "blanket-full-
        //      alphabet" (or per-color if pricing diverges).
        //   4. Confirm the 3-4 week lead time copy in the Made detail
        //      row is acceptable to Lusik before flipping. Customers
        //      who see "3-4 weeks" on a heritage product won't blink;
        //      customers who order, expect 10 days, then wait three
        //      weeks WILL blink. The detail row is the contract.
        //
        // No DB change, no schema migration, no Stripe dashboard
        // work needed — Stripe Checkout sessions are created on the
        // fly per cart, the trusted-products map is the entire
        // server-side price contract.
        // ============================================================
        //
        // Catalog key + slug were renamed to drop the previous fiber
        // reference from the product entirely — Lusik can no longer
        // reliably source that material, so every mention of it has
        // been removed sitewide. The product isn't live yet, so no
        // in-flight cart or trusted-products row depends on the key;
        // the rename is safe.
        key: "blanket-full-alphabet",
        slug: "full-alphabet-crib-blanket",
        // The full-alphabet blanket shows every letter (all 36)
        // rather than the 3-letter personalized layout of the live
        // Armenian Alphabet Blanket. Naming it "The Full Alphabet
        // Crib Blanket" keeps both products in the same "Armenian
        // alphabet blanket" search bucket while making the
        // differentiation explicit:
        //   - The Armenian Alphabet Blanket: 3-letter personalized,
        //     fringed.
        //   - The Full Alphabet Crib Blanket: full alphabet,
        //     satin-backed.
        name: "The Full Alphabet Crib Blanket",
        // Status stays placeholder until the live product view + the
        // trusted-products row are wired (see the flip-to-live
        // checklist near the top of this entry). Price is set so
        // customers can see the actual number and reach Lusik
        // directly to commission one -- the placeholder page now
        // surfaces the price + an email/phone commission path
        // instead of the "price coming soon" framing used for
        // unpriced placeholders. Once the live view ships, this
        // same priceFrom feeds the category card + trusted-products
        // entry without re-editing.
        status: "placeholder",         // ⚠️ TODO_LUSIK: flip to "live" once the live product view + trusted-products entry land
        priceFrom: 245,                // Lusik confirmed $165 felt low for two solid weeks of work; $245 is the honest heritage price (see PR #91 + sitewide pricing analysis)
        // Tagline leads with "Armenian alphabet" -- a high-value
        // search term -- and immediately answers "how much of the
        // alphabet?" (every letter) and "how is it made?" (hand
        // cross-stitched).
        tagline: "Every letter of the Armenian alphabet — all thirty-six, hand cross-stitched by Lusik.",
        // Description sells the heritage angle, the gifting use cases
        // (christening, baby shower, hospital photo), and the
        // longevity. Echoes the homepage voice ("from her home in
        // Cypress, California, Lusik cross-stitches...") and closes
        // with the same "Made to last" beat as the homepage H1.
        description: "The full Armenian alphabet — every letter from Ա to Ք, every one set down by Lusik's own hand. The heritage crib blanket for the christening, the baby shower, the photograph at the front door coming home from the hospital — and then folded into a chest for the next baby in the family, and the one after that. Cross-stitched on soft yarn so the blanket breathes through a California summer, and finished with a satin backing matched to the body color so it lays right in the crib. From Lusik's home in Cypress, California. Made to order, made to last.",
        // Cover image — used by the category-grid card as a static
        // thumbnail. Center-cropped to 4:5 at 1200×1500.
        coverImage: "/img/full-alphabet/cover.jpg",
        // Full gallery — 61 photos, ordered by curatorial arc.
        // The /img/full-alphabet/NN.jpg files are flat-numbered;
        // the colorways array below indexes into this list.
        images: Array.from({ length: 61 }, (_, i) =>
          `/img/full-alphabet/${String(i + 1).padStart(2, "0")}.jpg`,
        ),
        // Color picker — every entry is a button under the gallery
        // thumbnail strip. Clicking it filters the gallery to just
        // the photos identified as that color, and jumps to the
        // first photo of that color. Clicking the active swatch
        // again deselects (returns to all photos).
        //
        // Only ACTUAL COLORWAYS appear here. The previous "All",
        // "The family", and "In the studio" entries were removed
        // because the customer isn't buying "the family" — they're
        // buying one specific color. Those photos still live in
        // the gallery (browseable via thumbnails) but no longer
        // get a dedicated swatch button.
        //
        // Indices are 0-based into `images` above.
        colorways: [
          { label: "Blue",            indices: [5, 6, 7, 8, 9, 10, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 56], swatch: { color: "#93B7D5" } },
          { label: "Pink",            indices: [11, 12, 13, 14, 32, 47, 48, 49],                                swatch: { color: "#E8B5C7" } },
          { label: "Lavender",        indices: [15, 16, 17, 18, 30, 53, 54, 55],                                swatch: { color: "#BBA8D6" } },
          { label: "Mint",            indices: [19, 20, 21, 31, 45, 46],                                        swatch: { color: "#B5D9BC" } },
          { label: "Yellow",          indices: [22, 44],                                                        swatch: { color: "#E8D89B" } },
          { label: "Dusty rose",      indices: [23, 33, 50, 51, 52],                                            swatch: { color: "#D8AFA3" } },
          { label: "Pink + espresso", indices: [24, 25],                                                        swatch: { dual: ["#E8B5C7", "#3A2418"] } },
          { label: "Two-color name",  indices: [26, 27, 28, 29],                                                swatch: { dual: ["#BBA8D6", "#E8B5C7"] } },
        ],
        // Details panel content for the right column. Surfaces
        // materials / size / care up front so the customer doesn't
        // have to ask. TODO_LUSIK markers flag values that still
        // need her confirmation before flipping the product live.
        details: [
          { label: "Materials", value: "Soft yarn body, crochet edging, satin backing." },
          { label: "Size",      value: "Approx. 30 × 36 in (76 × 91 cm). ⚠️ TODO_LUSIK: confirm." },
          { label: "Backing",   value: "Every blanket is finished with a satin backing, matched to the body color (white, lavender, pink, blue, or mint). Not optional — included on every piece." },
          // Care field carries both Lusik & Sons' recommendation
          // AND the yarn manufacturer's literal label so the
          // customer has full information. The two technically
          // conflict (the yarn says "do not dry clean", we say
          // "dry clean") because the finished piece -- with
          // crochet edging and satin backing -- is more delicate
          // than the raw yarn alone. The "we can't guarantee
          // against machine-wash wear" line below puts the
          // responsibility on the customer's chosen method.
          { label: "Care",      value: "Professional dry cleaning recommended to preserve the hand cross-stitch, satin backing, and crochet edging — the dry cleaner gives consistent gentle treatment that a washing machine can't. If you'd rather launder at home, the yarn label reads: machine wash in cool water, do not bleach, do not iron, tumble dry on low / delicate. We can't guarantee against wear from washing-machine cycles." },
          { label: "Made",      value: "By Lusik herself, in Cypress, California. The full Armenian alphabet — all thirty-six letters, plus the satin backing and the crochet edge — is about two solid weeks of cross-stitching for her, working alone. We add a comfortable buffer for life and for the rest of the queue, so please plan on 3–4 weeks from order to ship. If you need it by a specific date — a christening, a baby shower, a flight home — tell us at checkout and we'll write back honestly about whether we can meet it." },
        ],
      },
    ],
  },
  bibs: {
    slug: "bibs",
    label: "Bibs",
    // Recap-the-category copy. Three products, three different gift
    // moments. Names them all in one line so customers landing here
    // from a search ("Armenian baby bib", "personalized name bib",
    // "Hye em yes bib") see all three options.
    description: "The small pieces that hold the biggest hours of a baby's day — first food, first words, first photographs. Five bibs in Lusik's hand: a custom-name bib for the everyday, a seven-day Armenian set for the baby shower, the Հայ եմ ես (\"I am Armenian\") heritage bib stitched in the colors of the flag, a Mama-and-Papa pair that says sweetheart twice in Armenian, and the Bari Akhorzhak meal-time set that carries a grandmother's table blessing on the bib and answers it on the matching burp cloth.",
    eyebrow: "Small pieces, biggest hours",
    products: [
      {
        // Catalog key + slug + trusted-products cart-id all kept stable.
        // The display name and copy are refreshed to lead with the
        // personalization story (which is what makes the bib special)
        // and to fit alongside the two heritage-named siblings below.
        key: "bib-single",
        slug: "baby-bib",
        name: "The Custom Name Bib",
        status: "live",                // points to CUSTOM_PRODUCTS.bib
        priceFrom: 22,
        // Tagline = the value prop in one line. Names both languages
        // ("Armenian or English") since both are real options and the
        // existing live preview supports each one.
        tagline: "Your child's name, embroidered by Lusik — in Armenian or English, the way it'll be said for the rest of their life.",
      },
      {
        // Catalog key kept stable across the pricing flip so the
        // cart-id / Stripe trusted-products map don't get broken
        // when the product goes live. Slug ALSO kept stable for
        // SEO continuity (URL is already in sitemap.xml).
        key: "bib-days-of-week",
        slug: "days-of-the-week-bib-set",
        // Renamed to lead with "Armenian" -- mirrors the rename
        // pattern used on "The Full Alphabet Crib Blanket".
        // Heritage hook + clear product identity in the title.
        name: "The Armenian Days-of-the-Week Bib Set",
        status: "placeholder",         // ⚠️ TODO_LUSIK: flip to "live" per the same checklist pattern used on the full-alphabet blanket
        priceFrom: null,               // ⚠️ TODO_LUSIK: set when going live
        // Tagline leads with the count (seven) + the heritage angle.
        tagline: "Seven bibs for seven days — Monday through Sunday in Armenian, embroidered by Lusik.",
        // Description in the same maker + heirloom voice as the
        // homepage. Names the buying contexts (baby shower,
        // christening) where these sets sell best.
        description: "A bib for every day of the week, the way Armenian families have always counted them: Երկուշաբթի, Երեքշաբթի, Չորեքշաբթի, Հինգշաբթի, Ուրբաթ, Շաբաթ, Կիրակի — Monday through Sunday in Armenian, one word per bib. A baby-shower set that opens like a calendar, a christening gift the family will pull out of the drawer for years, a quiet way to teach an American-born child the names of the days the way their great-grandmother said them. Each bib hand-embroidered by Lusik from her home in Cypress, California. Made to order, made to last.",
        coverImage: "/img/days-bib/cover.jpg",
        // 22-photo gallery. Curatorial arc:
        //   01-04  hero bundle shots + cross-sell with alphabet blanket
        //   05-06  rainbow / pink cascade hero colorways
        //   07-10  Pink family (girl)
        //   11-12  Blue family (boy)
        //   13     Gold (premium, neutral)
        //   14-16  Boy pastel multi-color (blue + yellow + white)
        //   17-20  Rainbow (multi-color thread on white / pastel)
        //   21     Green
        //   22     bibs on alphabet blanket alt angle
        images: Array.from({ length: 22 }, (_, i) =>
          `/img/days-bib/${String(i + 1).padStart(2, "0")}.jpg`,
        ),
        // Color picker -- the actual sellable variants Lusik makes.
        // Bundle shots (indices 0-3) and the rainbow pastel hero
        // (index 4) aren't tied to one variant -- they live in the
        // gallery default view but get no dedicated swatch. Same
        // pattern as the full-alphabet blanket: only sellable colorways
        // become swatches.
        colorways: [
          { label: "Pink",         indices: [5, 6, 7, 9],          swatch: { color: "#E8B5C7" } },
          { label: "Lavender",     indices: [8],                   swatch: { color: "#BBA8D6" } },
          { label: "Blue",         indices: [10, 11],              swatch: { color: "#93B7D5" } },
          { label: "Gold",         indices: [12],                  swatch: { color: "#E8D89B" } },
          { label: "Boy pastel",   indices: [13, 14, 15],          swatch: { dual: ["#93B7D5", "#E8D89B"] } },
          { label: "Rainbow",      indices: [4, 16, 17, 18, 19],   swatch: { gradient: ["#E8B5C7", "#BBA8D6", "#93B7D5", "#B5D9BC", "#E8D89B"] } },
          { label: "Green",        indices: [20],                  swatch: { color: "#B5D9BC" } },
        ],
        details: [
          { label: "Set size",  value: "Seven bibs — Monday through Sunday in Armenian (Երկուշաբթի, Երեքշաբթի, Չորեքշաբթի, Հինգշաբթի, Ուրբաթ, Շաբաթ, Կիրակի)." },
          { label: "Materials", value: "Soft terry bib body with satin trim. Commercial-grade machine-embroidery thread on the day name." },
          { label: "Sizing",    value: "One size, fits most babies. ⚠️ TODO_LUSIK: confirm." },
          // Care language acknowledges both Lusik & Sons' dry-clean
          // recommendation AND the reality that bibs are designed
          // to be washed daily. Same hybrid stance as the full-alphabet
          // blanket but with an extra line confirming the
          // commercial-grade thread can survive the wash.
          { label: "Care",      value: "We recommend professional dry cleaning to preserve the embroidery for years. That said, bibs are built to be washed — Lusik uses commercial-grade thread that survives a baby's daily bib changes. If you launder at home: machine wash cold on delicate, tumble dry low, no bleach, no iron over the embroidery. We can't guarantee against wear from washing-machine cycles." },
          { label: "Made",      value: "By Lusik herself, in Cypress, California. Made to order — 5–10 business days." },
        ],
      },
      {
        // Slug kept stable for SEO continuity (already in sitemap.xml).
        // The display name is rewritten in full though -- the previous
        // "Hy Em — I Am Armenian Bib" used a half-romanized form
        // ("Hy em") and read like a stage direction. "The Hye Em Yes
        // Bib" uses the full 3-word romanization (Hay em yes = "I am
        // Armenian") and reads cleanly to customers searching for
        // Armenian heritage gifts.
        key: "bib-hy-em",
        slug: "hy-em-armenian-bib",
        name: "The Hye Em Yes Bib",
        status: "placeholder",         // ⚠️ TODO_LUSIK: flip to "live" when pricing lands (same checklist as the full-alphabet blanket)
        priceFrom: null,               // ⚠️ TODO_LUSIK
        // Tagline = the cultural payload + a hook to the flag colors,
        // which is THE differentiating visual cue on this bib.
        tagline: "Հայ եմ ես — \"I am Armenian,\" stitched in the colors of the flag.",
        // Description in the maker + heirloom voice. Names the
        // specific buying contexts (christening, baby shower, family
        // gathering) where Armenian-American parents reach for this
        // kind of piece. Mentions the optional matching cap because
        // the gallery shows both bib-only and bib+cap configurations.
        description: "Three Armenian words said by a baby who can't yet speak any: Հայ եմ ես — Hye em yes, \"I am Armenian.\" Each word embroidered on a soft white bib in one of the three colors of the Armenian flag — red for Հայ, blue for Եմ, orange for Ես — so the sentence itself wears the flag while the baby wears the sentence. A heritage statement piece for a christening, a baby shower, the first Easter at the Armenian Apostolic church, or any Sunday a grandmother is going to see her grandchild for the first time. Sold as the bib alone, or paired with a matching baby cap that carries the same tricolor motif. Lusik embroiders each one from her home in Cypress, California. Made to order, made to last.",
        coverImage: "/img/hye-em-bib/cover.jpg",
        // 4-photo gallery. Curatorial arc:
        //   01 HERO   bib + cap together, Armenian flag tricolor
        //              text on white -- the iconic look
        //   02        same set, alt angle showing the cap's flag
        //              motif clearly
        //   03        bib + cap on a cream alphabet blanket --
        //              cross-sell context, shows the heritage
        //              lineup together
        //   04        pink/purple girl variant in gift-bag packaging
        images: Array.from({ length: 4 }, (_, i) =>
          `/img/hye-em-bib/${String(i + 1).padStart(2, "0")}.jpg`,
        ),
        // Two real colorways for this product:
        //   Tricolor: red Հայ + blue Եմ + orange Ես (Armenian flag)
        //   Girl    : pink + purple thread on white
        // Indices are 0-based into images above.
        colorways: [
          {
            label: "Armenian flag",
            indices: [0, 1, 2],
            // Conic gradient of the three flag colors (red, blue, orange)
            // so the swatch reads as "Armenian flag" at a glance.
            swatch: { gradient: ["#D90012", "#0033A0", "#F2A800"] },
          },
          {
            label: "Pink + purple",
            indices: [3],
            swatch: { dual: ["#E8B5C7", "#BBA8D6"] },
          },
        ],
        details: [
          { label: "Set",       value: "Bib alone, or bib + matching baby cap. ⚠️ TODO_LUSIK: confirm whether the cap is a separate add-on or bundled in one price." },
          { label: "Materials", value: "Soft terry bib body with satin trim. Commercial-grade machine-embroidery thread on the lettering. Matching cap when paired." },
          { label: "Sizing",    value: "One size, fits most babies 0–24 months." },
          { label: "Care",      value: "We recommend professional dry cleaning to preserve the embroidery for years. That said, bibs are built to be washed — Lusik uses commercial-grade thread that survives a baby's daily bib changes. If you launder at home: machine wash cold on delicate, tumble dry low, no bleach, no iron over the embroidery. We can't guarantee against wear from washing-machine cycles." },
          { label: "Made",      value: "By Lusik herself, in Cypress, California. Made to order — 5–10 business days." },
        ],
      },
      {
        // ============================================================
        // The Mama & Papa's Anushig Bib Set
        // ============================================================
        // A matched PAIR of bibs sold together. One reads
        // "Մայրիկիս Անոյշիկը" (Mama's sweetheart). The other reads
        // "Պապայիս Անոյշիկը" (Papa's sweetheart). The recurring word
        // "Անոյշիկ" (Anushig) -- Armenian for "darling / sweet one"
        // -- gives the product its name. Available in pink, blue,
        // mint green, and yellow colorways with small motifs between
        // the two lines (heart, leaf, star).
        // ============================================================
        key: "bib-anushig-pair",
        slug: "anushig-bib-set",
        name: "The Mama & Papa's Anushig Bib Set",
        status: "placeholder",         // ⚠️ TODO_LUSIK: flip to "live" per the flip-to-live checklist
        priceFrom: null,
        tagline: "One bib says Mama's sweetheart, the other Papa's — Armenian for \"darling,\" stitched as a pair.",
        description: "A matched pair of baby bibs that take turns. One reads Մայրիկիս Անոյշիկը — \"Mama's sweetheart.\" The other reads Պապայիս Անոյշիկը — \"Papa's sweetheart.\" Anushig is the Armenian word for darling, the kind of name a grandmother says when she means it. Embroidered together, gifted together: the bib for the morning Dad gets up first, the bib for the night Mom takes over, both of them small daily reassurances that the baby is loved on both sides of the crib. A small heritage anchor for the first months — when the answer to \"whose baby is this?\" deserves to be said in two voices. Lusik embroiders each pair by hand from her home in Cypress, California. Made to order, made to last.",
        coverImage: "/img/anushig-bib/cover.jpg",
        images: Array.from({ length: 9 }, (_, i) =>
          `/img/anushig-bib/${String(i + 1).padStart(2, "0")}.jpg`,
        ),
        colorways: [
          { label: "Pink",   indices: [0],       swatch: { color: "#E8B5C7" } },
          { label: "Blue",   indices: [1, 7, 8], swatch: { color: "#93B7D5" } },
          { label: "Mint",   indices: [2],       swatch: { color: "#B5D9BC" } },
          { label: "Yellow", indices: [3],       swatch: { color: "#E8D89B" } },
        ],
        details: [
          { label: "Set size",  value: "Two matched bibs — one Mama's, one Papa's. Both bibs in the same colorway." },
          { label: "Reads",     value: "Մայրիկիս Անոյշիկը (\"Mama's sweetheart\") + Պապայիս Անոյշիկը (\"Papa's sweetheart\"), each with a small motif between the two lines — heart, leaf, or star, varies by colorway." },
          { label: "Materials", value: "Soft terry bib body with satin trim. Hand-stitched cross-stitch lettering." },
          { label: "Sizing",    value: "One size, fits most babies 0–24 months." },
          { label: "Care",      value: "We recommend professional dry cleaning to preserve the cross-stitch for years. That said, bibs are built to be washed — Lusik uses commercial-grade thread. If you launder at home: machine wash cold on delicate, tumble dry low, no bleach, no iron over the stitching. We can't guarantee against wear from washing-machine cycles." },
          { label: "Made",      value: "By Lusik herself, in Cypress, California. Made to order — 5–10 business days." },
        ],
      },
      {
        // ============================================================
        // The Bari Akhorzhak Bib & Burp Cloth Set
        // ============================================================
        // A meal-time set Lusik has been stitching for years. Bib +
        // burp cloth (+ optional cap), each carrying one half of an
        // Armenian grandmother's table blessing.
        //
        //   Bib:        Բարի ախորժակ ("Bari akhorzhak", "Bon appétit")
        //                              -- said before the baby eats
        //   Burp cloth: Անույշ ըլլայ  ("Anush ella", "May it be sweet")
        //                              -- said after, when the food
        //                              has worked out
        //   Cap:        baby's name or initial cross-stitched in
        //                              matching thread (optional)
        //
        // Bib has a soft white inset panel that gives the cross-stitch
        // a clean page to live on; burp cloth is single-color terry.
        // Closure is a fabric tie at the back of the neck -- the
        // heritage closure Lusik's grandmother used.
        //
        // Primary motif (above the lettering): bottle (canonical),
        // strawberry, grape, carrot, butterfly appliqué, bunny
        // appliqué, or daisies. Lusik also tucks a small SIGNATURE
        // motif into the corner of the burp cloth -- a tiny car,
        // chick, butterfly, or flower -- varies by piece. Customer
        // can express a preference at checkout; Lusik picks the
        // combination that fits.
        //
        // 26-photo gallery, ordered by curatorial arc:
        //   01-02  HEROES -- cream damask family shot + clean white-
        //          coverlet set, two emotional registers up front
        //   03-04  MOTIF EDUCATION -- pink side-by-side bunny/butterfly
        //          + pink single, proves "you can choose the motif"
        //   05-14  LOOKBOOK -- Oct 2010 white-coverlet shoot, chromatic
        //          order through yellow, mint, pink, blue, with bold
        //          rust accent at the end
        //   15-23  COLOR CARDS -- Dec 2010 burp-cloth-only archive,
        //          burp cloth-only color confirmations across the
        //          chromatic range. Position 21 is the light-blue +
        //          blue card with the small red car corner motif --
        //          confirmed Western Armenian "Անույշ ըլլայ", same
        //          blessing as every other piece in the set
        //   24-26  CONSTRUCTION & DETAIL -- the Aida-cloth inset bib
        //          (different technique), the cap-with-name shot, the
        //          scale relationship between bib and burp cloth
        //
        // Three mood-based colorways replace the prior flat list. The
        // customer picks the chromatic mood (harmony / complement /
        // contrast); Lusik picks the precise body + thread that fits.
        // This is honest to how she actually works -- she's stitched
        // this blessing in 12+ combinations across 8 body colors and
        // 9 thread colors over the years.
        // ============================================================
        key: "bib-bari-akhorzhak-set",
        slug: "bari-akhorzhak-bib-burp-cloth-set",
        name: "The Bari Akhorzhak Bib & Burp Cloth Set",
        status: "placeholder",         // ⚠️ TODO_LUSIK: flip to "live" per the flip-to-live checklist
        priceFrom: null,
        tagline: "Two Armenian meal blessings, one matched set — said before the baby eats, and after.",
        description: "A matched bib and burp cloth, each carrying one half of an Armenian grandmother's table blessing. Before the baby eats, the bib reads Բարի ախորժակ — Bari akhorzhak, bon appétit. After, when the food has worked out, the burp cloth answers Անույշ ըլլայ — Anush ella, may it be sweet. Lusik has been stitching this blessing for years — in cream with botanical green, in pale pink with magenta, in periwinkle with gold, in bubblegum pink with navy. Pick the mood you want — quiet harmony, gentle complement, or bold contrast — and Lusik picks the exact combination that fits. The bib carries a soft white inset panel that gives the cross-stitch a clean page to live on; the burp cloth is single-color terry, the everyday companion to the bib's ceremony. Each piece has a primary motif tucked between the words — a cross-stitched bottle, strawberry, grape, or carrot; an appliquéd butterfly, bunny, or daisies on the pink — and the burp cloth carries Lusik's quiet signature in the corner: a tiny car, a chick, a butterfly, varies by piece. Add the matching cap and your baby's name or initial is cross-stitched in the same thread, turning a set of two into a set of three voices: name on the cap, blessing before on the bib, blessing after on the burp cloth. The bib closes with a fabric tie at the back of the neck — the heritage closure Lusik's grandmother used. Hand cross-stitched by Lusik herself from her home in Cypress, California. Made to order, made to last.",
        coverImage: "/img/bari-akhorzhak-set/cover.jpg",
        // 26-photo gallery -- the curatorial arc described in the
        // header comment. Indices below are 0-based into this list.
        images: Array.from({ length: 26 }, (_, i) =>
          `/img/bari-akhorzhak-set/${String(i + 1).padStart(2, "0")}.jpg`,
        ),
        // Three mood-based colorways. Swatches show a canonical
        // body+thread pairing for each mood; the indices below pull
        // photos from across the gallery that exemplify that mood.
        // Motif-education shots (2, 3), cap-personalization (24), and
        // the scale shot (25) live in the gallery but aren't tagged
        // to a single mood -- they're story shots, not chromatic.
        colorways: [
          {
            // Tonal harmony -- body and thread sit in the same color
            // family. Heirloom-coded; reads quiet, considered.
            // Position 20 is the new light-blue + blue archival card
            // (DSCN1086, the one with the small red car in the corner).
            label: "Quiet harmony",
            indices: [0, 1, 4, 6, 7, 10, 11, 12, 14, 19, 20, 23],
            swatch: { dual: ["#EFE7D6", "#5B6F47"] },
          },
          {
            // Gentle complement -- body and thread are soft
            // counterparts. Reads gift-coded; legible without
            // shouting.
            label: "Gentle complement",
            indices: [5, 8, 15, 16, 17, 18],
            swatch: { dual: ["#FFFFFF", "#93B7D5"] },
          },
          {
            // Bold contrast -- thread sharply opposes the body.
            // Reads modern, statement.
            label: "Bold contrast",
            indices: [9, 13, 21, 22],
            swatch: { dual: ["#E8579A", "#1A2C5A"] },
          },
        ],
        details: [
          { label: "Set",       value: "Two pieces — one bib + one matching burp cloth. Add the matching cap and your baby's name or initial is cross-stitched in the same thread color." },
          { label: "Reads",     value: "Bib: Բարի ախորժակ (\"Bari akhorzhak,\" bon appétit) — said before the baby eats. Burp cloth: Անույշ ըլլայ (\"Anush ella,\" may it be sweet) — said after. Each piece has a primary motif tucked between the words — a cross-stitched bottle, strawberry, grape, or carrot; an appliquéd butterfly, bunny, or daisies on the pink — and the burp cloth carries Lusik's quiet signature in the corner: a tiny car, a chick, a butterfly, varies by piece." },
          { label: "Closure",   value: "Bib closes with a fabric tie at the back of the neck — the heritage closure Lusik's grandmother used. Slower than a snap, the way these were always made." },
          { label: "Materials", value: "Soft terry bib body with a soft white inset panel for the lettering, terry burp cloth, both finished with picot edging. Hand cross-stitched or appliquéd embellishments throughout." },
          { label: "Sizing",    value: "Bib: one size, fits most babies 0–24 months. Burp cloth: standard burp-cloth size (approx. 10 × 17 in). ⚠️ TODO_LUSIK: confirm." },
          { label: "Care",      value: "We recommend professional dry cleaning to preserve the stitching for years. That said, these are built to be washed — Lusik uses commercial-grade thread. If you launder at home: machine wash cold on delicate, tumble dry low, no bleach, no iron over the embroidery. We can't guarantee against wear from washing-machine cycles." },
          { label: "Made",      value: "By Lusik herself, in Cypress, California. Made to order — 5–10 business days." },
        ],
      },
    ],
  },
  towels: {
    slug: "towels",
    label: "Towels",
    description: "The Armenian textiles a family pulls out for the days that count. A hand towel for the guest bath, a powder room, the table set for a holiday meal. And the white baptism towel — the one canon asks the godparents to bring, the one the priest lifts the child onto, the one the family keeps folded in a chest for the rest of their lives.",
    eyebrow: "For the days that count",
    products: [
      {
        key: "towel-hand",
        slug: "embroidered-hand-towel",
        name: "The Embroidered Hand Towel",
        status: "placeholder",         // ⚠️ TODO_LUSIK: flip to "live" per the flip-to-live checklist
        priceFrom: null,
        tagline: "Small enough to fit in a gift bag, made to outlive the wedding it was given at.",
        description: "A hand-sized soft towel with one of Lusik's hand-embroidered Armenian motifs — the pomegranate, the cross-hatch border, the small bird-and-tree pattern that has lived on Armenian linens for centuries. Folds into a gift bag for a housewarming, a hostess thank-you, a wedding. Sits in a guest bath the way an Armenian grandmother's linens always did — the small good thing on the shelf, waiting for the day someone notices it. Hand-embroidered by Lusik from her home in Cypress, California. Made to order, made to last.",
      },
      {
        key: "towel-baptism",
        slug: "armenian-baptism-towel",
        name: "The Armenian Baptism Towel",
        status: "placeholder",         // ⚠️ TODO_LUSIK: flip to "live" per the flip-to-live checklist
        priceFrom: null,
        // Tagline = the single most important thing — this is the
        // canonically-required towel for the Armenian Apostolic
        // baptism. Godparents Google for this; the tagline should
        // land directly.
        tagline: "The white towel godparents bring to the font — embroidered with your child's name, in Armenian, and the date of their baptism.",
        description: "By Armenian Apostolic Church canon, the godparents bring one large new white towel to the baptism. The priest uses it once — to lift the child out of the font — and from that day forward it belongs to the family. It goes into the chest with the christening dress, the cross from the priest, the photograph from the church steps. It comes out again at the next baptism, the wedding, sometimes the funeral, sometimes simply when the grandchildren ask to see it. Lusik embroiders the child's name in Armenian script, the baptism date, and an Armenian-style cross — by hand, the same way the towel her own godmother brought to her christening was made. From her home in Cypress, California. Made to order, made to last.",
      },
    ],
  },
  baby: {
    slug: "baby",
    label: "For Baby",
    // Reframed -- "Swaddles, bathrobes, and other early-infant items"
    // is descriptive but doesn't sell. The new line names the
    // emotional buying context (the first weeks home from the
    // hospital, the bath ritual that becomes the day's anchor).
    description: "Soft pieces for the days before the rest of the world meets a new baby. A swaddle for the going-home photograph from the hospital. A hooded bathrobe for the bath ritual that becomes the day's anchor. Small fabric objects that are around for the first weeks of a life, and that — if they're made the right way, by the right hands — get folded into a drawer to wait for the next one.",
    eyebrow: "From the very first day",
    products: [
      {
        key: "baby-swaddle",
        slug: "baby-swaddle",
        name: "The Baby Swaddle",
        status: "placeholder",         // ⚠️ TODO_LUSIK: flip to "live" per the flip-to-live checklist
        priceFrom: null,
        tagline: "The cloth a new baby is wrapped in for the going-home photograph — embroidered with their name.",
        description: "A soft swaddle for the earliest weeks — the cloth around the baby in the hospital photograph, the cloth on the first night in the crib, the cloth in the carrier walking through the front door of a house that just got fuller by one. Lusik embroiders the baby's name on it, in Armenian or English, the parents pick. A first object with a first name on it. Made to order by Lusik from her home in Cypress, California. Made to order, made to last.",
      },
      {
        key: "baby-bathrobe",
        slug: "baby-bathrobe",
        name: "The Baby Bathrobe",
        status: "placeholder",         // ⚠️ TODO_LUSIK: flip to "live" per the flip-to-live checklist
        priceFrom: null,
        tagline: "The hooded towel that becomes every evening's anchor — with your child's name on the hood.",
        description: "A hooded terry bathrobe for the after-bath ritual — the wrap that comes out of the warm towel pile every evening for the first three years of a child's life, the wrap a parent's hands learn before the child can hold their own arms out. Lusik embroiders the child's name on the hood in Armenian or English. By the second year the child will be the one pointing at the letters, asking for them by sound. From Lusik's home in Cypress, California. Made to order, made to last.",
      },
    ],
  },
};

// ============================================================
// CATALOG LOOKUP HELPERS
// ============================================================
// Used by the router in App.jsx (to resolve /shop/<cat>/<slug>
// into a category + product pair) and by ShopMegaMenu / footer
// nav (to render category labels without re-iterating the
// CATALOG object). Centralized here so the slug format only
// has to be agreed on in one place.
// ============================================================

/** Returns an array of [categorySlug, category] pairs. */
export function listCategories() {
  return Object.entries(CATALOG).map(([_, category]) => category);
}

/** Resolve a category by its URL slug, or null if not found. */
export function getCategoryBySlug(slug) {
  if (!slug) return null;
  for (const [_, category] of Object.entries(CATALOG)) {
    if (category.slug === slug) return category;
  }
  return null;
}

/** Resolve a product by category slug + product slug, or null. */
export function getProductBySlugs(categorySlug, productSlug) {
  const category = getCategoryBySlug(categorySlug);
  if (!category) return null;
  const product = category.products.find((p) => p.slug === productSlug);
  if (!product) return null;
  return { category, product };
}

/** Build the canonical pathname for a product. */
export function productPath(category, product) {
  return `/shop/${category.slug}/${product.slug}`;
}

/** Build the canonical pathname for a category. */
export function categoryPath(category) {
  return `/shop/${category.slug}`;
}
