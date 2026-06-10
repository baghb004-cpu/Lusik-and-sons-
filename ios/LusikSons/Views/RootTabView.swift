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
            tabContent(.journal) { JournalTabView() }
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

/// Placeholder brand surface until the home content ports — plus the
/// reach-Lusik cluster (web TextUsWidget + ChatAssistant parity, Chunk 7):
/// a real sms: path and the AI assistant sheet.
struct ForYouView: View {
    @State private var showChat = false

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

                VStack(spacing: 6) {
                    Text(Contact.headline)
                        .font(Brand.fontDisplay(19, weight: .medium))
                        .foregroundStyle(Brand.ink)
                    Text(Contact.subhead)
                        .font(Brand.fontBody(13))
                        .foregroundStyle(Brand.ink.opacity(0.65))
                        .multilineTextAlignment(.center)
                }
                .padding(.top, 40)

                HStack(spacing: 10) {
                    Link(destination: Contact.smsURL) {
                        Label("Text us", systemImage: "message")
                            .font(Brand.fontBody(13, weight: .semibold))
                            .foregroundStyle(Brand.textOnInk)
                            .padding(.horizontal, 18)
                            .padding(.vertical, 11)
                            .background(Capsule().fill(Brand.ink))
                    }
                    Button {
                        showChat = true
                    } label: {
                        Label(ChatConfig.launcherLabel, systemImage: "sparkles")
                            .font(Brand.fontBody(13, weight: .semibold))
                            .foregroundStyle(Brand.ink)
                            .padding(.horizontal, 18)
                            .padding(.vertical, 11)
                            .background(Capsule().fill(.background))
                            .overlay(Capsule().strokeBorder(Brand.ink.opacity(0.15), lineWidth: 1))
                    }
                    .accessibilityLabel("Open chat assistant")
                }
                .padding(.top, 2)
            }
            .padding(.horizontal, 24)
        }
        .sheet(isPresented: $showChat) {
            ChatView()
        }
    }
}

#Preview {
    RootTabView().environmentObject(CartStore())
}
