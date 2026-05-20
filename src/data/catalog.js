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
    description: "Hand cross-stitched alphabet blankets — Lusik's signature work. Two pieces, both Armenian by heritage: a personalized crib blanket with the first three letters of a child's name, and a full-alphabet crib blanket in cotton. Each one stitched by hand, made to order, made to last.",
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
        tagline: "Lusik's signature blanket. Three letters, stitched diagonally.",
        // Cover image for the category-grid card thumbnail AND for
        // the second slot of the Blankets category-card hover
        // slideshow. The actual product detail page (ProductShowcase)
        // still uses PRODUCT.gallery[0] as its hero on render -- this
        // is purely the category-level thumbnail.
        coverImage: "/img/abc-blanket/cover.jpg",
      },
      {
        // ============================================================
        // FLIP-TO-LIVE CHECKLIST  (cotton-yarn-blanket)
        // ============================================================
        // When pricing is finalized and Lusik is ready to sell this,
        // here's everything you have to change. It's a ~5 minute job.
        //
        //   1. Below: change `status: "placeholder"` → `status: "live"`
        //   2. Below: change `priceFrom: null` → `priceFrom: 65`
        //      (or whatever the agreed price is)
        //   3. In netlify/functions/_lib/trusted-products.mjs:
        //      Uncomment the "blanket-cotton-cotton" entry and set
        //      priceCents to match (e.g. priceFrom 65 → priceCents
        //      6500). The server rejects any cart line item whose
        //      productKey isn't in TRUSTED_PRODUCTS, so this step
        //      is what makes the checkout actually work.
        //   4. In src/components/shop/ProductView.jsx:
        //      Add a third branch alongside the existing
        //      blanket-alphabet / bib-single cases:
        //          if (product.key === "blanket-cotton-bernat") {
        //            return <LiveCottonYarnView ... />;
        //          }
        //      That component needs to render the same gallery
        //      (already built) + a color radio (one swatch must be
        //      selected before Add-to-Cart enables) + an Add-to-Cart
        //      button that calls onAdd with cart-id "blanket-cotton-
        //      cotton" (or per-color if pricing diverges).
        //
        // No DB change, no schema migration, no Stripe dashboard
        // work needed — Stripe Checkout sessions are created on the
        // fly per cart, the trusted-products map is the entire
        // server-side price contract.
        // ============================================================
        //
        // Catalog key kept stable across the pricing flip so the
        // cart-id / Stripe trusted-products map don't get broken
        // when the product goes live. The "bernat" suffix is a
        // legacy artifact -- the customer-facing copy below no
        // longer mentions any yarn brand.
        //
        // Slug ALSO kept stable ("cotton-yarn-blanket") even though
        // the display name has changed -- the URL is in sitemap.xml
        // and may already be indexed by search engines. Changing the
        // slug would orphan inbound links and reset SEO progress.
        key: "blanket-cotton-bernat",
        slug: "cotton-yarn-blanket",
        // Renamed for SEO + conversion: the cotton blanket shows the
        // FULL Armenian alphabet (every letter, all 36) rather than
        // the 3-letter personalized layout of the live Armenian
        // Alphabet Blanket. Positioning it as "The Cotton Alphabet
        // Crib Blanket" puts both products in the same "Armenian
        // alphabet blanket" search bucket while making the
        // differentiation explicit:
        //   - The Armenian Alphabet Blanket: 3-letter personalized,
        //     acrylic, fringed.
        //   - The Cotton Alphabet Crib Blanket: full alphabet,
        //     cotton, satin-backed.
        name: "The Cotton Alphabet Crib Blanket",
        status: "placeholder",         // ⚠️ TODO_LUSIK: flip to "live" per the checklist above
        priceFrom: null,               // ⚠️ TODO_LUSIK: set when going live (catalog card "From $NN")
        // Tagline leads with "Armenian alphabet" -- a high-value
        // search term -- and immediately answers "how much of the
        // alphabet?" (every letter) and "how is it made?" (hand
        // cross-stitched).
        tagline: "Every letter of the Armenian alphabet, hand cross-stitched in cotton yarn.",
        // Description sells the heritage angle, the gifting use cases
        // (christening, baby shower, hospital photo), and the
        // longevity. Echoes the homepage voice ("from her home in
        // Cypress, California, Lusik cross-stitches...") and closes
        // with the same "Made to last" beat as the homepage H1.
        description: "The full Armenian alphabet — every letter, every one stitched by Lusik herself. A heritage crib blanket meant for a christening, a baby shower, or the going-home-from-the-hospital photograph — and for the generations after. Cross-stitched by hand from her home in Cypress, California, in soft cotton yarn for breathability, and finished with a satin backing matched to the body color. Made to order, made to last.",
        // Cover image — used by the category-grid card as a static
        // thumbnail. Center-cropped to 4:5 at 1200×1500.
        coverImage: "/img/cotton-yarn/cover.jpg",
        // Full gallery — 61 photos, ordered by curatorial arc.
        // The /img/cotton-yarn/NN.jpg files are flat-numbered;
        // the colorways array below indexes into this list.
        images: Array.from({ length: 61 }, (_, i) =>
          `/img/cotton-yarn/${String(i + 1).padStart(2, "0")}.jpg`,
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
          { label: "Materials", value: "100% cotton yarn body, cotton crochet edging, satin backing." },
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
          { label: "Care",      value: "Professional dry cleaning recommended to preserve the hand cross-stitch, satin backing, and crochet edging — the dry cleaner gives consistent gentle treatment that a washing machine can't. If you'd rather launder at home, the cotton yarn label reads: machine wash in cool water, do not bleach, do not iron, tumble dry on low / delicate. We can't guarantee against wear from washing-machine cycles." },
          { label: "Made",      value: "By Lusik herself, in Cypress, California. Made to order — 5–10 business days." },
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
    description: "Machine-embroidered baby bibs by Lusik — a custom-name bib for everyday, a seven-day Armenian set for showers, the Հայ եմ ես (\"I am Armenian\") heritage bib, a Mama-and-Papa pair, and the Bari Akhorzhak meal-time set with matching burp cloth.",
    eyebrow: "Small piece, big heart",
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
        tagline: "Any name, embroidered by Lusik — Armenian or English, up to six letters.",
      },
      {
        // Catalog key kept stable across the pricing flip so the
        // cart-id / Stripe trusted-products map don't get broken
        // when the product goes live. Slug ALSO kept stable for
        // SEO continuity (URL is already in sitemap.xml).
        key: "bib-days-of-week",
        slug: "days-of-the-week-bib-set",
        // Renamed to lead with "Armenian" -- mirrors the rename
        // pattern used on "The Cotton Alphabet Crib Blanket".
        // Heritage hook + clear product identity in the title.
        name: "The Armenian Days-of-the-Week Bib Set",
        status: "placeholder",         // ⚠️ TODO_LUSIK: flip to "live" per the same checklist pattern used on the cotton blanket
        priceFrom: null,               // ⚠️ TODO_LUSIK: set when going live
        // Tagline leads with the count (seven) + the heritage angle.
        tagline: "Seven baby bibs, one for each weekday — Armenian day names, embroidered by hand.",
        // Description in the same maker + heirloom voice as the
        // homepage. Names the buying contexts (baby shower,
        // christening) where these sets sell best.
        description: "Seven baby bibs, one for each day of the week — the Armenian day name (Երկուշաբթի through Կիրակի, Monday through Sunday) embroidered on each. A heritage gift set for a baby shower, a christening, or simply for the early-bib-change years. Lusik embroiders each one from her home in Cypress, California. Made to order, made to last.",
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
        // pattern as the cotton blanket: only sellable colorways
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
          { label: "Materials", value: "100% cotton terry bib body with satin trim. Commercial-grade machine-embroidery thread on the day name." },
          { label: "Sizing",    value: "One size, fits most babies. ⚠️ TODO_LUSIK: confirm." },
          // Care language acknowledges both Lusik & Sons' dry-clean
          // recommendation AND the reality that bibs are designed
          // to be washed daily. Same hybrid stance as the cotton
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
        status: "placeholder",         // ⚠️ TODO_LUSIK: flip to "live" when pricing lands (same checklist as cotton blanket)
        priceFrom: null,               // ⚠️ TODO_LUSIK
        // Tagline = the cultural payload + a hook to the flag colors,
        // which is THE differentiating visual cue on this bib.
        tagline: "\"Հայ եմ ես\" — I am Armenian, stitched in the colors of the flag.",
        // Description in the maker + heirloom voice. Names the
        // specific buying contexts (christening, baby shower, family
        // gathering) where Armenian-American parents reach for this
        // kind of piece. Mentions the optional matching cap because
        // the gallery shows both bib-only and bib+cap configurations.
        description: "Three Armenian words — Հայ եմ ես (Hye em yes, \"I am Armenian\") — embroidered on a soft white bib, each word in one of the three colors of the Armenian flag: red, blue, and orange. A heritage statement piece for a christening, a baby shower, the first Easter, or a Sunday at the Armenian church. Sold as a bib alone or paired with a matching baby cap that carries the same flag motif. Lusik embroiders each one from her home in Cypress, California. Made to order, made to last.",
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
          { label: "Materials", value: "100% cotton terry bib body with satin trim. Commercial-grade machine-embroidery thread on the lettering. Matching cotton cap when paired." },
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
        tagline: "One bib for Mom, one for Dad — Armenian for \"sweetheart,\" hand-embroidered as a pair.",
        description: "A matched pair of baby bibs — one says Մայրիկիս Անոյշիկը (\"Mama's sweetheart\"), the other Պապայիս Անոյշիկը (\"Papa's sweetheart\"). Anushig is the Armenian word for darling. Embroidered together, gifted together: the bib for the morning Dad gets up first, the bib for the night Mom takes over. A small heritage anchor for the first months, when the question \"whose baby is this?\" needs the right answer from both sides. Lusik embroiders each pair by hand from her home in Cypress, California. Made to order, made to last.",
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
          { label: "Materials", value: "100% cotton terry bib body with satin trim. Hand-stitched cross-stitch lettering." },
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
        // 25-photo gallery, ordered by curatorial arc:
        //   01-02  HEROES -- cream damask family shot + clean white-
        //          coverlet set, two emotional registers up front
        //   03-04  MOTIF EDUCATION -- pink side-by-side bunny/butterfly
        //          + pink single, proves "you can choose the motif"
        //   05-14  LOOKBOOK -- Oct 2010 white-coverlet shoot, chromatic
        //          order through yellow, mint, pink, blue, with bold
        //          rust accent at the end
        //   15-22  COLOR CARDS -- Dec 2010 burp-cloth-only archive,
        //          burp cloth-only color confirmations
        //   23-25  CONSTRUCTION & DETAIL -- the Aida-cloth inset bib
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
        // 25-photo gallery -- the curatorial arc described in the
        // header comment. Indices below are 0-based into this list.
        images: Array.from({ length: 25 }, (_, i) =>
          `/img/bari-akhorzhak-set/${String(i + 1).padStart(2, "0")}.jpg`,
        ),
        // Three mood-based colorways. Swatches show a canonical
        // body+thread pairing for each mood; the indices below pull
        // photos from across the gallery that exemplify that mood.
        // Motif-education shots (2, 3), cap-personalization (23), and
        // the scale shot (24) live in the gallery but aren't tagged
        // to a single mood -- they're story shots, not chromatic.
        colorways: [
          {
            // Tonal harmony -- body and thread sit in the same color
            // family. Heirloom-coded; reads quiet, considered.
            label: "Quiet harmony",
            indices: [0, 1, 4, 6, 7, 10, 11, 12, 14, 19, 22],
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
            indices: [9, 13, 20, 21],
            swatch: { dual: ["#E8579A", "#1A2C5A"] },
          },
        ],
        details: [
          { label: "Set",       value: "Two pieces — one bib + one matching burp cloth. Add the matching cap and your baby's name or initial is cross-stitched in the same thread color." },
          { label: "Reads",     value: "Bib: Բարի ախորժակ (\"Bari akhorzhak,\" bon appétit) — said before the baby eats. Burp cloth: Անույշ ըլլայ (\"Anush ella,\" may it be sweet) — said after. Each piece has a primary motif tucked between the words — a cross-stitched bottle, strawberry, grape, or carrot; an appliquéd butterfly, bunny, or daisies on the pink — and the burp cloth carries Lusik's quiet signature in the corner: a tiny car, a chick, a butterfly, varies by piece." },
          { label: "Closure",   value: "Bib closes with a fabric tie at the back of the neck — the heritage closure Lusik's grandmother used. Slower than a snap, the way these were always made." },
          { label: "Materials", value: "100% cotton terry bib body with a soft white inset panel for the lettering, cotton terry burp cloth, both finished with picot edging. Hand cross-stitched or appliquéd embellishments throughout." },
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
    description: "Hand-embroidered Armenian ceremonial towels — a baptism keepsake and a personalized hand towel for the home.",
    eyebrow: "For the milestone moments",
    products: [
      {
        key: "towel-hand",
        slug: "embroidered-hand-towel",
        name: "The Embroidered Hand Towel",
        status: "placeholder",         // ⚠️ TODO_LUSIK: flip to "live" per the flip-to-live checklist
        priceFrom: null,
        tagline: "Hand-towel size, hand-embroidered by Lusik — for a guest bath, a powder room, a christening gift.",
        description: "A hand-sized cotton towel with Lusik's hand-embroidered Armenian motif. Small enough to fit in a gift bag, lasting enough to outlive the wedding it was given at. Made to order from her home in Cypress, California. Made to order, made to last.",
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
        tagline: "The towel godparents bring to an Armenian Apostolic baptism, embroidered with your child's name and date.",
        description: "Per Armenian Church canon, the godparents bring one large new white towel to the baptism — used once at the font, then kept by the family as a keepsake of the day. Lusik embroiders the child's name in Armenian script, the baptism date, and an Armenian-style cross. Hand-embroidered, made to order from her home in Cypress, California. Made to order, made to last.",
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
    description: "Soft pieces for the earliest days — a swaddle for the going-home photograph, a hooded bathrobe for the post-bath ritual.",
    eyebrow: "From the very first day",
    products: [
      {
        key: "baby-swaddle",
        slug: "baby-swaddle",
        name: "The Baby Swaddle",
        status: "placeholder",         // ⚠️ TODO_LUSIK: flip to "live" per the flip-to-live checklist
        priceFrom: null,
        tagline: "Soft cotton swaddle for the first weeks home.",
        description: "A soft cotton swaddle for the early weeks. Lusik personalizes each one with the baby's name embroidered in Armenian or English. The swaddle for the going-home-from-the-hospital photograph; the swaddle for the first night in the crib. Made to order from her home in Cypress, California. Made to order, made to last.",
      },
      {
        key: "baby-bathrobe",
        slug: "baby-bathrobe",
        name: "The Baby Bathrobe",
        status: "placeholder",         // ⚠️ TODO_LUSIK: flip to "live" per the flip-to-live checklist
        priceFrom: null,
        tagline: "Hooded cotton bathrobe — personalized with your child's name.",
        description: "Hooded cotton-terry bathrobe for the after-bath ritual — the towel-wrap that becomes the every-night anchor of the day. Lusik embroiders the child's name in Armenian or English on the hood. Made to order from her home in Cypress, California. Made to order, made to last.",
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
