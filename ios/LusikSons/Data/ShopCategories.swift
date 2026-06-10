import Foundation

/// Shop categories — the Swift mirror of the website's /shop index
/// (ShopIndexView's four cards). Two categories are live; Towels and
/// For Baby are coming-soon placeholders, shown the same way the web
/// shows them so the storefronts feel like one brand.
struct ShopCategory: Identifiable {
    let id: String          // slug
    let label: String
    let blurb: String
    let comingSoon: Bool

    var products: [Product] {
        Catalog.products.filter { $0.categorySlug == id }
    }

    var coverURL: URL? {
        products.first?.photoURLs.first
    }

    static let all: [ShopCategory] = [
        ShopCategory(
            id: "blankets",
            label: "Blankets",
            blurb: "The hand cross-stitched alphabet, and the full thirty-six letters hand-knit.",
            comingSoon: false
        ),
        ShopCategory(
            id: "bibs",
            label: "Bibs",
            blurb: "Names, blessings, and the days of the week — stitched to be kept.",
            comingSoon: false
        ),
        ShopCategory(
            id: "towels",
            label: "Towels",
            blurb: "Embroidered hand towels and baptism towels.",
            comingSoon: true
        ),
        ShopCategory(
            id: "baby",
            label: "For Baby",
            blurb: "Swaddles and bathrobes, on Lusik's worktable.",
            comingSoon: true
        ),
    ]
}
