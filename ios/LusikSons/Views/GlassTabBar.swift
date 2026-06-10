import SwiftUI
import UIKit

// ============================================================
// GlassTabBar — the Liquid Glass island, native edition (Chunk 6)
// ============================================================
// The floating pill nav from the website (.lg-bottom-island), rebuilt on
// real materials: .ultraThinMaterial frost with a warm cream tint (the
// web's --lg-tint-island), a 1px bevel stroke, soft depth shadow, and
// the gliding "lens" capsule that always hovers over the active tab
// (the web's .lg-lens, via matchedGeometryEffect). Content scrolls
// UNDER the glass and shows through the blur — that's the whole look.

enum AppTab: String, CaseIterable {
    case forYou, products, journal, bag

    var label: String {
        switch self {
        case .forYou: return "For You"
        case .products: return "Products"
        case .journal: return "Journal"
        case .bag: return "Bag"
        }
    }

    var icon: String {
        switch self {
        case .forYou: return "house"
        case .products: return "storefront"
        case .journal: return "book"
        case .bag: return "bag"
        }
    }
}

struct GlassTabBar: View {
    @Binding var selection: AppTab
    let bagCount: Int

    /// Vertical room content must reserve so the floating bar never covers
    /// it (the web's --imm-nav-clear). Tabs add this as a safe-area inset.
    static let clearance: CGFloat = 84

    @Namespace private var lens
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(spacing: 0) {
            ForEach(AppTab.allCases, id: \.self) { tab in
                tabButton(tab)
            }
        }
        .padding(6)
        .background {
            Capsule()
                .fill(.ultraThinMaterial)
                .overlay(Capsule().fill(Brand.cream.opacity(0.42)))   // warm tint
                .overlay(Capsule().strokeBorder(.white.opacity(0.55), lineWidth: 1))
                .shadow(color: Brand.ink.opacity(0.22), radius: 16, y: 8)
        }
        .padding(.horizontal, 24)
        .padding(.bottom, 6)
    }

    private func tabButton(_ tab: AppTab) -> some View {
        Button {
            guard selection != tab else { return }
            if reduceMotion {
                selection = tab
            } else {
                withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                    selection = tab
                }
            }
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        } label: {
            VStack(spacing: 3) {
                Image(systemName: tab.icon)
                    .font(.system(size: 19, weight: .regular))
                    .overlay(alignment: .topTrailing) {
                        if tab == .bag && bagCount > 0 {
                            Text("\(bagCount)")
                                .font(Brand.fontBody(9, weight: .bold))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 4)
                                .padding(.vertical, 1)
                                .background(Brand.accent, in: Capsule())
                                .offset(x: 10, y: -7)
                        }
                    }
                Text(tab.label)
                    .font(Brand.fontBody(10, weight: selection == tab ? .semibold : .regular))
            }
            .foregroundStyle(selection == tab ? Brand.accent : Brand.ink.opacity(0.65))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 9)
            .background {
                if selection == tab {
                    // The lens — glides between tabs (web .lg-lens parity):
                    // a brighter frost dome with a faint accent rim.
                    Capsule()
                        .fill(.regularMaterial)
                        .overlay(Capsule().fill(.white.opacity(0.35)))
                        .overlay(Capsule().strokeBorder(Brand.accent.opacity(0.25), lineWidth: 1))
                        .matchedGeometryEffect(id: "lens", in: lens)
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(tab == .bag && bagCount > 0 ? "Bag, \(bagCount) items" : tab.label)
        .accessibilityAddTraits(selection == tab ? [.isButton, .isSelected] : .isButton)
    }
}

#Preview {
    ZStack(alignment: .bottom) {
        Brand.cream.ignoresSafeArea()
        GlassTabBar(selection: .constant(.products), bagCount: 2)
    }
}
