import SwiftUI

/// The four-tab shell, mirroring the website's bottom-nav island
/// (For You / Products / Journal / Bag). The custom Liquid Glass pill
/// chrome replaces the system tab bar in Chunk 6 — a standard TabView
/// keeps every earlier chunk runnable.
struct RootTabView: View {
    @EnvironmentObject private var cart: CartStore

    var body: some View {
        TabView {
            ForYouView()
                .tabItem { Label("For You", systemImage: "house") }

            ShopView()
                .tabItem { Label("Products", systemImage: "storefront") }

            Text("Journal — Chunk 7")
                .font(Brand.fontDisplay(22))
                .tabItem { Label("Journal", systemImage: "book") }

            Text("Bag — Chunk 4")
                .font(Brand.fontDisplay(22))
                .tabItem { Label("Bag", systemImage: "bag") }
                .badge(cart.unitCount > 0 ? cart.unitCount : 0)
        }
    }
}

/// Placeholder brand surface until Chunk 1+ ports the home content.
struct ForYouView: View {
    var body: some View {
        ZStack {
            Brand.cream.ignoresSafeArea()
            VStack(spacing: 12) {
                Text("Lusik & Sons")
                    .font(Brand.fontDisplay(40, weight: .medium))
                    .foregroundStyle(Brand.ink)
                Text("Hand cross-stitched Armenian heirlooms,\nmade one at a time in Southern California.")
                    .font(Brand.fontBody(15))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Brand.ink.opacity(0.7))
            }
        }
    }
}

#Preview {
    RootTabView().environmentObject(CartStore())
}
