import Foundation
import SwiftUI

/// One line in the bag. `checkoutKey` is what the server charges by;
/// everything else is display.
struct CartItem: Identifiable, Codable {
    let id: String                 // product id + variant suffix
    let checkoutKey: ProductKey
    let name: String
    let subtitle: String
    let priceDollars: Int
    var qty: Int
    let photoURL: URL?
}

/// The bag — persisted, with the same promo math the website shows.
/// All amounts are DISPLAY ONLY: the server recomputes prices, the
/// bundle coupon, and shipping from its own trusted tables at checkout.
@MainActor
final class CartStore: ObservableObject {
    private static let storageKey = "lusik.cart.v1"

    // Display mirrors of the server dials (web CONFIG parity).
    static let freeShippingThresholdDollars = 150
    private static let bundlePerExtraCents = 100   // _lib/bundle-discount.mjs
    private static let bundleMaxCents = 2500

    @Published private(set) var items: [CartItem] = [] {
        didSet { persist() }
    }

    init() {
        if let data = UserDefaults.standard.data(forKey: Self.storageKey),
           let saved = try? JSONDecoder().decode([CartItem].self, from: data) {
            items = saved
        }
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(items) {
            UserDefaults.standard.set(data, forKey: Self.storageKey)
        }
    }

    // ── totals ──
    var unitCount: Int { items.reduce(0) { $0 + $1.qty } }
    var subtotalDollars: Int { items.reduce(0) { $0 + $1.priceDollars * $1.qty } }

    /// "$1 off every piece after the first", capped — exact mirror of
    /// bundleDiscountCents() on the server (incl. the subtotal floor).
    var bundleSavingsDollars: Double {
        let units = unitCount
        let subtotalCents = subtotalDollars * 100
        guard units > 1, subtotalCents > 0 else { return 0 }
        let raw = (units - 1) * Self.bundlePerExtraCents
        let cents = max(0, min(raw, Self.bundleMaxCents, subtotalCents - 50))
        return Double(cents) / 100
    }

    var qualifiesForFreeShipping: Bool {
        subtotalDollars >= Self.freeShippingThresholdDollars
    }

    var freeShippingProgress: Double {
        min(1, Double(subtotalDollars) / Double(Self.freeShippingThresholdDollars))
    }

    var dollarsAwayFromFreeShipping: Int {
        max(0, Self.freeShippingThresholdDollars - subtotalDollars)
    }

    // ── mutations ──
    func add(_ item: CartItem) {
        if let i = items.firstIndex(where: { $0.id == item.id }) {
            items[i].qty = min(99, items[i].qty + item.qty)
        } else {
            items.append(item)
        }
    }

    func remove(id: String) { items.removeAll { $0.id == id } }

    func remove(atOffsets offsets: IndexSet) { items.remove(atOffsets: offsets) }

    func setQty(id: String, qty: Int) {
        guard let i = items.firstIndex(where: { $0.id == id }) else { return }
        items[i].qty = max(1, min(99, qty))
    }

    func clear() { items = [] }

    /// The catalog product behind a bag row (variant suffix stripped) —
    /// powers tap-the-row-to-revisit-the-product, like the website bag.
    func product(for item: CartItem) -> Product? {
        let baseId = item.id.hasSuffix("-with-cap")
            ? String(item.id.dropLast("-with-cap".count))
            : item.id
        return Catalog.products.first { $0.id == baseId }
    }
}
