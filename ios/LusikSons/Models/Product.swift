import Foundation

/// Server-trusted product keys. Raw values MUST equal the keys in
/// netlify/functions/_lib/trusted-products.mjs — checkout rejects anything
/// else. Never invent a key on the client.
enum ProductKey: String, Codable, CaseIterable {
    case blanketAlphabet = "blanket-double_diag_br"   // Armenian Alphabet Blanket (live layout)
    case blanketFullAlphabet = "blanket-full-alphabet"
    case bib = "bib"                                   // Custom Name Bib
    case bibDaysOfWeek = "bib-days-of-week"
    case bibAnushigPair = "bib-anushig-pair"
    case bibBariAkhorzhakSet = "bib-bari-akhorzhak-set"
    case bibBariAkhorzhakSetWithCap = "bib-bari-akhorzhak-set-with-cap"
    case bibHyEm = "bib-hy-em"
    case bibHyEmWithCap = "bib-hy-em-with-cap"
}

/// How a product page renders — parity with the website's
/// CONFIG.SHEET.EXCLUDE_KEYS rule: photo-led products get the immersive
/// pill sheet; configurator-led products get a classic scroll page.
enum ProductPresentation: String, Codable {
    case immersiveSheet
    case classicConfigurator
}

struct Product: Identifiable, Codable {
    let id: String                 // catalog key (e.g. "bib-hy-em")
    let checkoutKey: ProductKey    // what the server charges by
    let capVariantKey: ProductKey? // optional "+ matching cap" SKU
    let name: String
    let tagline: String
    /// Display-only dollars — the server reprices from its trusted map.
    let priceDollars: Int
    let capPriceDollars: Int?
    let categorySlug: String
    let productSlug: String
    let presentation: ProductPresentation
    /// Remote photo URLs on the production site (AsyncImage-ready).
    let photoURLs: [URL]

    var pagePath: String { "/shop/\(categorySlug)/\(productSlug)" }
}
