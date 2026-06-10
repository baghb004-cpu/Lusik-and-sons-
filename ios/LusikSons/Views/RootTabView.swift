import SwiftUI

/// The app shell: four tab roots kept ALIVE in a ZStack (so each tab's
/// navigation state survives switching — system-TabView behavior) with
/// the floating Liquid Glass island overlaid at the bottom. Each tab
/// reserves GlassTabBar.clearance as a bottom safe-area inset, so lists
/// scroll UNDER the glass and show through the frost, while full-bleed
/// surfaces (the immersive photo backdrop) intentionally ignore it.
struct RootTabView: View {
    @EnvironmentObject private var cart: CartStore
    @State private var selection: AppTab = .forYou

    var body: some View {
        ZStack(alignment: .bottom) {
            tabContent(.forYou) { ForYouView() }
            tabContent(.products) { ShopView() }
            tabContent(.journal) {
                Text("Journal — Chunk 7")
                    .font(Brand.fontDisplay(22))
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Brand.cream)
            }
            tabContent(.bag) { BagView() }

            GlassTabBar(selection: $selection, bagCount: cart.unitCount)
        }
    }

    @ViewBuilder
    private func tabContent(_ tab: AppTab, @ViewBuilder content: () -> some View) -> some View {
        content()
            .safeAreaInset(edge: .bottom) {
                Color.clear.frame(height: GlassTabBar.clearance)
            }
            .opacity(selection == tab ? 1 : 0)
            .allowsHitTesting(selection == tab)
            .accessibilityHidden(selection != tab)
    }
}

/// Placeholder brand surface until the home content ports.
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
