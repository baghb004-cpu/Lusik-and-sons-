// ============================================================
// JOURNAL_POSTS — Lusik's Journal article data
// ============================================================
// These three posts are intentionally about ARMENIAN HERITAGE,
// not about Lusik personally. They make claims about Armenian
// history, cross-stitch technique, and pomegranate symbolism
// that are well-attested — not autobiographical claims that
// would need Lusik's sign-off.
//
// ⚠️ TODO_LUSIK_REVIEW: Lusik should read each post and tell
//    us if anything needs adjusting. She can also send us a
//    personal anecdote for any of them — we'll splice it in as
//    a fourth section or pull it forward as the lede.
//
// Adding a new post: prepend a new entry below with a unique
// slug. The slug appears in the URL hash (#journal/the-slug),
// the JSON-LD BlogPosting `mainEntityOfPage`, and the SEO
// canonical link. Don't change a slug once a post is shared —
// older links would 404.
//
// Each `content` block is an array of typed nodes:
//   { type: "p",          text: "..." }   plain paragraph
//   { type: "h2",         text: "..." }   section heading
//   { type: "blockquote", text: "..." }   pulled-out quote
//   { type: "p", text: "...", em: ["word1", "word2"] }   italicize substrings
//
// Keep posts in the 300–500 word range. Long enough to rank on
// long-tail Armenian-craft searches, short enough that a
// customer browsing on their phone actually reads to the end.
//
// NOTE: when you add or remove a post here, also update
// `sitemap.xml` at the repo root — every post needs its own
// <url> entry for Google to index it. Don't change a slug
// once a post is shared; old URLs would 404.
//
// MIRRORED FROM index.html (~line 1981).
// ============================================================

export const JOURNAL_POSTS = [
  {
    slug:        "armenian-alphabet-gift",
    title:       "The Armenian Alphabet: A 1,600-Year-Old Gift",
    excerpt:     "Mesrop Mashtots designed the alphabet in 405 AD. Sixteen centuries later, those same first three letters — Ա Բ Գ — are still the first ones Armenian children learn.",
    publishedAt: "2026-05-14",
    readMinutes: 3,
    content: [
      { type: "p", text: "The Armenian alphabet was created in 405 AD by a monk named Mesrop Mashtots, commissioned by King Vramshapuh and the Catholicos Sahak Parthev. Before that, Armenian was written in Greek, Syriac, or Persian script — but none of those captured the actual sounds of the spoken language. Mashtots designed a 36-letter alphabet that matched every Armenian sound, and that core has survived nearly intact for sixteen centuries." },
      { type: "p", text: "The first three letters — Ա (Ayb), Բ (Ben), Գ (Gim) — are the alphabet's opening. They're the letters Armenian children learn first. The Armenian word for \"alphabet\" itself, Այբուբեն (Aybuben), is built from the names of the first two letters, the way \"alpha-beta\" became \"alphabet\" in Greek." },
      { type: "h2", text: "Why the first three letters matter" },
      { type: "p", text: "To stitch Ա Բ Գ onto a blanket is to give a child the beginning of their language — literally the first three steps into reading it. It's a quiet kind of inheritance: nobody's reading the blanket to the baby yet, but the letters are there, and one day the same child who slept under them will recognize them on a page." },
      { type: "p", text: "Two more letters were added during the Middle Ages: Օ (Oh) and Ֆ (Feh), bringing the total to 38. The original 36 are still what most Armenian primers teach as \"the alphabet,\" and you'll still see the Mashtots-era letters in old monastery inscriptions if you ever travel to Echmiadzin or Geghard." },
      { type: "h2", text: "Or English, if that's the right gift" },
      { type: "p", text: "The English ABC follows the same logic. Some families want their child's first letters in Armenian; others want English; many want both. Lusik stitches whichever the parent picks — she doesn't push one over the other. The blanket should be the language the family speaks at home." },
      { type: "p", text: "For other letters or special requests — a child's specific initial, an unusual combination, or a custom blanket for a name you'd like spelled out — write Lusik at hello@lusikandsons.com." },
    ],
  },
  {
    slug:        "why-cross-stitch",
    title:       "Why Cross-Stitch, and Not Just Embroidery",
    excerpt:     "Most people use the two words interchangeably. They're not the same thing — and the difference is why Lusik's blanket has to be made by hand.",
    publishedAt: "2026-05-07",
    readMinutes: 4,
    content: [
      { type: "p", text: "Cross-stitch and embroidery aren't the same thing, even though most people use the words interchangeably." },
      { type: "p", text: "Embroidery is a broad family of techniques — satin stitch, French knots, chain stitch, machine embroidery — basically any way of decorating fabric with thread. Cross-stitch is one specific technique within that family, but it's old enough and exacting enough to deserve its own name." },
      { type: "h2", text: "What makes a stitch a cross-stitch" },
      { type: "p", text: "Every mark on the fabric is a small X — two diagonal threads crossing at a single point. The whole picture is built out of those Xs, counted one at a time onto a fabric with an even, gridded weave. There's no improvisation in the stitches themselves; the variation comes entirely from which Xs you place and what color thread you use." },
      { type: "p", text: "This is why cross-stitch is sometimes called \"counted embroidery\": you literally count squares of fabric to know where each X goes. The waffle-weave blankets Lusik uses have the count built into the cloth itself — every little square is one stitch." },
      { type: "h2", text: "Why a machine can't really do it" },
      { type: "p", text: "Machine embroidery uses different stitches — satin and fill — optimized for speed and density. The result is closer to a painted-on image: smooth, regular, opaque. Hand cross-stitch produces something different. You can see the individual stitches, you can feel the texture, and (on the back) you can see the path the stitcher took through the cloth." },
      { type: "p", text: "That visibility is part of why cross-stitched gifts get kept. The work is in the work. A grandmother who learned cross-stitch from her grandmother, who learned it from hers, makes something a machine can't approximate at any price." },
      { type: "h2", text: "Why the bib is different" },
      { type: "p", text: "Lusik does the blanket by hand because the blanket is where the count and texture matter. The bib is machine-embroidered because its surface is too small for hand cross-stitch — a name in cross-stitch on a bib would be unreadable. Each piece gets the technique that suits its size." },
    ],
  },
  {
    slug:        "pomegranate-in-textiles",
    title:       "The Pomegranate in Armenian Textiles",
    excerpt:     "There's a reason every Armenian rug, plate, and manuscript seems to have one. The pomegranate is the country's visual shorthand — and it's woven into Lusik's blankets too.",
    publishedAt: "2026-04-29",
    readMinutes: 3,
    content: [
      { type: "p", text: "If you've ever been in an Armenian home, you've probably seen a pomegranate somewhere. On a tablecloth, woven into a rug, painted on a plate, illuminated in an old manuscript. The pomegranate is, more than any other symbol, the visual shorthand for Armenia." },
      { type: "p", text: "There's a reason." },
      { type: "h2", text: "Abundance, marriage, family" },
      { type: "p", text: "The fruit grows wild in the Armenian highlands — pomegranate trees are an everyday sight. But the symbolism runs deeper. In Armenian folklore, the pomegranate represents abundance, fertility, marriage, and family. The seeds inside (which can number in the hundreds) stand for many children, much grace, a full life. At Armenian weddings, the bride traditionally throws a pomegranate against a wall: the seeds that scatter are blessings on the marriage." },
      { type: "h2", text: "In textiles specifically" },
      { type: "p", text: "In Armenian rug and textile work, the pomegranate appears in stylized, geometric form. The fruit's distinctive crown becomes a small angular tuft at the top; the body is a circle or stylized teardrop. Look at any Armenian rug from the last few centuries and you'll find pomegranates worked into the border or repeated through the field." },
      { type: "h2", text: "On the blanket" },
      { type: "p", text: "Lusik chose her blankets specifically for their pomegranate-pattern waffle weave. The pattern is woven into the fabric itself, not stitched on top — small, repeating, embossed across the entire surface. When she cross-stitches the alphabet over it, the pomegranates stay visible underneath, framing each letter the way they'd frame a child's name on an Armenian heirloom from a century ago." },
      { type: "p", text: "The blanket carries the symbol whether you notice it or not. A child can grow up underneath pomegranates without ever knowing why, and still inherit something Armenian." },
    ],
  },
];
