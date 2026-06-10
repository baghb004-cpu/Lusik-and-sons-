import SwiftUI

// ============================================================
// BagView — the bag tab (Chunk 4)
// ============================================================
// Web-bag parity: rows with photo + title that tap back to the product
// page (read-again, not re-add — qty lives HERE), qty stepper,
// swipe-to-delete, the bundle-savings line ("$1 off every piece after
// the first") with its add-another nudge, the free-shipping progress
// bar, and the checkout hand-off (Chunk 5 wires the real Stripe flow).

/// Routes a product to the right page — the ONE switch used by both the
/// shop and the bag, so presentation rules can't drift.
struct ProductRoute: View {
    let product: Product

    var body: some View {
        switch product.presentation {
        case .immersiveSheet:
            ImmersiveProductView(product: product)
        case .classicConfigurator:
            ProductDetailView(product: product)
        }
    }
}

struct BagView: View {
    @EnvironmentObject private var cart: CartStore
    @State private var showCheckout = false

    var body: some View {
        NavigationStack {
            Group {
                if cart.items.isEmpty {
                    emptyState
                } else {
                    bagList
                }
            }
            .background(Brand.cream)
            .navigationTitle("Bag")
            .navigationDestination(for: Product.self) { ProductRoute(product: $0) }
            .navigationDestination(isPresented: $showCheckout) { CheckoutView() }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "bag")
                .font(.system(size: 40, weight: .light))
                .foregroundStyle(Brand.ink.opacity(0.3))
            Text("Your bag is empty.")
                .font(Brand.fontDisplay(20, weight: .medium))
                .foregroundStyle(Brand.ink)
            Text("Everything is made to order by Lusik —\nfind something worth keeping in Products.")
                .font(Brand.fontBody(13))
                .multilineTextAlignment(.center)
                .foregroundStyle(Brand.ink.opacity(0.6))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var bagList: some View {
        List {
            Section {
                ForEach(cart.items) { item in
                    BagRow(item: item, product: cart.product(for: item))
                }
                .onDelete { cart.remove(atOffsets: $0) }
            }
            .listRowBackground(Brand.surface)

            Section {
                summary
            }
            .listRowBackground(Brand.surface)
        }
        .scrollContentBackground(.hidden)
    }

    private var summary: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Subtotal").foregroundStyle(Brand.ink.opacity(0.7))
                Spacer()
                Text("$\(cart.subtotalDollars).00").fontWeight(.medium)
            }
            .font(Brand.fontBody(15))

            if cart.bundleSavingsDollars > 0 {
                HStack {
                    Text("Bundle savings (\(cart.unitCount) pieces)")
                        .foregroundStyle(Brand.ink.opacity(0.7))
                    Spacer()
                    Text(String(format: "−$%.2f", cart.bundleSavingsDollars))
                        .fontWeight(.semibold)
                        .foregroundStyle(Brand.accent)
                }
                .font(Brand.fontBody(14))
            } else {
                Text("Add another piece and save $1.00 — every additional piece takes another $1.00 off.")
                    .font(Brand.fontBody(11))
                    .italic()
                    .foregroundStyle(Brand.ink.opacity(0.5))
            }

            // Free-shipping progress (web FreeShippingProgress parity).
            VStack(alignment: .leading, spacing: 5) {
                ProgressView(value: cart.freeShippingProgress)
                    .tint(Brand.accent)
                Text(cart.qualifiesForFreeShipping
                     ? "You've earned free U.S. shipping."
                     : "$\(cart.dollarsAwayFromFreeShipping) away from free U.S. shipping.")
                    .font(Brand.fontBody(11))
                    .foregroundStyle(Brand.ink.opacity(0.6))
            }
            .padding(.top, 2)

            Button {
                showCheckout = true
            } label: {
                Text("Checkout")
                    .font(Brand.fontBody(14, weight: .semibold))
                    .kerning(1.2)
                    .textCase(.uppercase)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 15)
                    .background(Brand.ink, in: RoundedRectangle(cornerRadius: Brand.pillRadius))
                    .foregroundStyle(Brand.textOnInk)
            }
            .buttonStyle(.plain)
            .padding(.top, 4)

            Text("Tax and shipping calculated at checkout. Shipping is priced by distance from Buena Park, CA — free over $\(CartStore.freeShippingThresholdDollars).")
                .font(Brand.fontBody(11))
                .foregroundStyle(Brand.ink.opacity(0.5))
        }
        .padding(.vertical, 6)
    }
}

private struct BagRow: View {
    let item: CartItem
    let product: Product?
    @EnvironmentObject private var cart: CartStore

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            // Photo + title tap back to the product page (the bag keeps
            // quantity ownership; the visit is for re-reading).
            if let product {
                NavigationLink(value: product) { rowContent }
                    .buttonStyle(.plain)
            } else {
                rowContent
            }
        }
    }

    private var rowContent: some View {
        HStack(alignment: .top, spacing: 12) {
            AsyncImage(url: item.photoURL) { phase in
                if case .success(let image) = phase {
                    image.resizable().scaledToFill()
                } else {
                    Brand.creamSubtle
                }
            }
            .frame(width: 58, height: 72)
            .clipShape(RoundedRectangle(cornerRadius: 10))

            VStack(alignment: .leading, spacing: 4) {
                Text(item.name)
                    .font(Brand.fontDisplay(15, weight: .medium))
                    .foregroundStyle(Brand.ink)
                    .lineLimit(2)
                Text(item.subtitle)
                    .font(Brand.fontBody(11))
                    .foregroundStyle(Brand.ink.opacity(0.55))
                    .lineLimit(1)

                HStack(spacing: 14) {
                    QtyStepper(qty: item.qty) { cart.setQty(id: item.id, qty: $0) }
                    Spacer()
                    Text("$\(item.priceDollars * item.qty)")
                        .font(Brand.fontBody(14, weight: .semibold))
                        .foregroundStyle(Brand.ink)
                }
                .padding(.top, 4)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("View \(item.name) product page")
    }
}

private struct QtyStepper: View {
    let qty: Int
    let onChange: (Int) -> Void

    var body: some View {
        HStack(spacing: 0) {
            stepButton("minus") { onChange(qty - 1) }
            Text("\(qty)")
                .font(Brand.fontBody(13, weight: .semibold))
                .frame(minWidth: 26)
            stepButton("plus") { onChange(qty + 1) }
        }
        .background(Brand.creamSubtle, in: Capsule())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Quantity \(qty)")
        .accessibilityAdjustableAction { direction in
            onChange(direction == .increment ? qty + 1 : qty - 1)
        }
    }

    private func stepButton(_ symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Brand.ink)
                .frame(width: 30, height: 28)
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    let store = CartStore()
    store.add(CartItem(
        id: "bib-hy-em", checkoutKey: .bibHyEm, name: "The Hye Em Yes Bib",
        subtitle: "“I am Armenian” — the flag is the design.",
        priceDollars: 20, qty: 2,
        photoURL: Catalog.products[4].photoURLs.first
    ))
    return BagView().environmentObject(store)
}
