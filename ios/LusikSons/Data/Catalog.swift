import Foundation

/// The live catalog — a Swift mirror of src/data/catalog.js +
/// src/data/customProducts.js as of the branch point (prices are the
/// June 2026 set). DISPLAY ONLY: the server reprices every checkout from
/// its own trusted map. Photos load from production (`/img/...` folders,
/// numbered 01.jpg…NN.jpg with a cover.jpg).
enum Catalog {
    static let base = URL(string: "https://lusikandsons.com")!

    private static func photos(_ folder: String, count: Int) -> [URL] {
        var urls = [base.appendingPathComponent("img/\(folder)/cover.jpg")]
        urls += (1...count).map { i in
            base.appendingPathComponent(String(format: "img/%@/%02d.jpg", folder, i))
        }
        return urls
    }

    static let products: [Product] = [
        Product(
            id: "blanket-alphabet",
            checkoutKey: .blanketAlphabet,
            capVariantKey: nil,
            name: "The Armenian Alphabet Blanket",
            tagline: "Ա Բ Գ, hand cross-stitched corner to corner.",
            priceDollars: 65,
            capPriceDollars: nil,
            categorySlug: "blankets",
            productSlug: "armenian-alphabet-blanket",
            presentation: .classicConfigurator,
            photoURLs: [base.appendingPathComponent("img/abc-blanket/cover.jpg")]
        ),
        Product(
            id: "blanket-full-alphabet",
            checkoutKey: .blanketFullAlphabet,
            capVariantKey: nil,
            name: "The Full Alphabet Crib Blanket",
            tagline: "Every letter of the Armenian alphabet — all thirty-six, hand-knit by Lusik.",
            priceDollars: 245,
            capPriceDollars: nil,
            categorySlug: "blankets",
            productSlug: "full-alphabet-crib-blanket",
            presentation: .immersiveSheet,
            photoURLs: photos("full-alphabet", count: 61)
        ),
        Product(
            id: "bib-single",
            checkoutKey: .bib,
            capVariantKey: nil,
            name: "The Custom Name Bib",
            tagline: "Your child's name, embroidered by Lusik — in Armenian or English.",
            priceDollars: 22,
            capPriceDollars: nil,
            categorySlug: "bibs",
            productSlug: "baby-bib",
            presentation: .classicConfigurator,
            photoURLs: (1...4).map { base.appendingPathComponent(String(format: "img/bib-examples/%02d.jpg", $0)) }
        ),
        Product(
            id: "bib-days-of-week",
            checkoutKey: .bibDaysOfWeek,
            capVariantKey: nil,
            name: "The Armenian Days-of-the-Week Bib Set",
            tagline: "Seven bibs for seven days — Monday through Sunday in Armenian.",
            priceDollars: 60,
            capPriceDollars: nil,
            categorySlug: "bibs",
            productSlug: "days-of-the-week-bib-set",
            presentation: .immersiveSheet,
            photoURLs: photos("days-bib", count: 22)
        ),
        Product(
            id: "bib-hy-em",
            checkoutKey: .bibHyEm,
            capVariantKey: .bibHyEmWithCap,
            name: "The Hye Em Yes Bib",
            tagline: "“I am Armenian” — the flag is the design.",
            priceDollars: 20,
            capPriceDollars: 38,
            categorySlug: "bibs",
            productSlug: "hy-em-armenian-bib",
            presentation: .immersiveSheet,
            photoURLs: photos("hye-em-bib", count: 3)
        ),
        Product(
            id: "bib-anushig-pair",
            checkoutKey: .bibAnushigPair,
            capVariantKey: nil,
            name: "The Mama & Papa's Anushig Bib Set",
            tagline: "One says Mama's sweetheart, the other Papa's — stitched as a pair.",
            priceDollars: 40,
            capPriceDollars: nil,
            categorySlug: "bibs",
            productSlug: "anushig-bib-set",
            presentation: .immersiveSheet,
            photoURLs: photos("anushig-bib", count: 9)
        ),
        Product(
            id: "bib-bari-akhorzhak-set",
            checkoutKey: .bibBariAkhorzhakSet,
            capVariantKey: .bibBariAkhorzhakSetWithCap,
            name: "The Bari Akhorzhak Bib & Burp Cloth Set",
            tagline: "Two Armenian meal blessings, one matched set.",
            priceDollars: 40,
            capPriceDollars: 58,
            categorySlug: "bibs",
            productSlug: "bari-akhorzhak-bib-burp-cloth-set",
            presentation: .immersiveSheet,
            photoURLs: photos("bari-akhorzhak-set", count: 26)
        ),
    ]
}
