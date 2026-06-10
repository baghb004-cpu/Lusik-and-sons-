import SwiftUI

// ============================================================
// ProductBuyControls — the ONE buy surface, used by both layouts
// ============================================================
// Classic detail page and the immersive pill sheet render this same
// view (the web does the identical thing: the sheet un-hides the same
// PurchaseCard the desktop page uses), so pricing, variant keys, and
// add-to-bag behavior can never drift between presentations.

struct ProductBuyControls: View {
    let product: Product

    @EnvironmentObject private var cart: CartStore
    @State private var withCap = false
    @State private var added = false

    private var displayPrice: Int {
        withCap ? (product.capPriceDollars ?? product.priceDollars) : product.priceDollars
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("MADE TO ORDER · FROM LUSIK'S HOME IN SOUTHERN CALIFORNIA")
                .font(Brand.fontBody(10, weight: .semibold))
                .kerning(1.8)
                .foregroundStyle(Brand.accent)

            Text(product.name)
                .font(Brand.fontDisplay(28, weight: .medium))
                .foregroundStyle(Brand.ink)

            Text(product.tagline)
                .font(Brand.fontBody(15))
                .foregroundStyle(Brand.ink.opacity(0.7))

            if let capPrice = product.capPriceDollars {
                Toggle(isOn: $withCap) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Add the matching baby cap")
                            .font(Brand.fontBody(14, weight: .medium))
                        Text("$\(product.priceDollars) without · $\(capPrice) with")
                            .font(Brand.fontBody(12))
                            .foregroundStyle(Brand.ink.opacity(0.55))
                    }
                }
                .tint(Brand.accent)
                .padding(14)
                .background(Brand.creamSubtle, in: RoundedRectangle(cornerRadius: Brand.cornerRadius))
            }

            Text("$\(displayPrice)")
                .font(Brand.fontDisplay(30, weight: .semibold))
                .foregroundStyle(Brand.ink)
                .padding(.top, 2)

            Button {
                let key = withCap ? (product.capVariantKey ?? product.checkoutKey) : product.checkoutKey
                cart.add(CartItem(
                    id: "\(product.id)\(withCap ? "-with-cap" : "")",
                    checkoutKey: key,
                    name: product.name,
                    subtitle: withCap ? "With matching cap" : product.tagline,
                    priceDollars: displayPrice,
                    qty: 1,
                    photoURL: product.photoURLs.first
                ))
                added = true
                Task { try? await Task.sleep(for: .seconds(1.6)); added = false }
            } label: {
                Text(added ? "Added ✓" : "Add to Bag — $\(displayPrice)")
                    .font(Brand.fontBody(14, weight: .semibold))
                    .kerning(1.2)
                    .textCase(.uppercase)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(Brand.ink, in: RoundedRectangle(cornerRadius: Brand.pillRadius))
                    .foregroundStyle(Brand.textOnInk)
            }
            .accessibilityLabel("Add to Bag, $\(displayPrice)")

            Text("Made to order — hand-stitched in about two weeks, then shipped to your door. Shipping is priced by distance from Lusik's workshop in Buena Park, CA; free over $150.")
                .font(Brand.fontBody(12))
                .foregroundStyle(Brand.ink.opacity(0.55))
                .padding(.top, 4)
        }
    }
}
