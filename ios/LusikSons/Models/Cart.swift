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

/// The bag. Persistence + bundle-savings + shipping math arrive in Chunk 4 —
/// this skeleton exists so the tab shell compiles and the badge works.
@MainActor
final class CartStore: ObservableObject {
    @Published private(set) var items: [CartItem] = []

    var unitCount: Int { items.reduce(0) { $0 + $1.qty } }
    var subtotalDollars: Int { items.reduce(0) { $0 + $1.priceDollars * $1.qty } }

    func add(_ item: CartItem) {
        if let i = items.firstIndex(where: { $0.id == item.id }) {
            items[i].qty = min(99, items[i].qty + item.qty)
        } else {
            items.append(item)
        }
    }

    func remove(id: String) { items.removeAll { $0.id == id } }

    func setQty(id: String, qty: Int) {
        guard let i = items.firstIndex(where: { $0.id == id }) else { return }
        items[i].qty = max(1, min(99, qty))
    }
}
