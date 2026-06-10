import SwiftUI

// ============================================================
// ImmersiveProductView — the Find My-style pill sheet (Chunk 2)
// ============================================================
// Native sibling of the website's ImmersiveBuySheet: a full-screen
// swipeable photo backdrop with a draggable buy sheet snapping between
// three detents — collapsed pill / medium / expanded. Behaviors ported:
//
//   • drag with spring snapping; a fast flick jumps a detent
//   • tap the pill row to cycle collapsed → medium → expanded → collapsed
//   • photo-tap contract: sheet up + tap photo → collapse to the pill;
//     sheet collapsed + tap photo → open the full-photo viewer
//     (Chunk 3 upgrades the viewer with pinch/double-tap zoom)
//   • per-product detent memory; a global "gesture learned" flag the
//     Chunk-6 breathe hint will consult (seen isn't learned; used is)
//   • reduced-motion honored (no springs, no animated snapping)
//
// The buy controls inside the sheet are the SAME ProductBuyControls the
// classic page uses — presentation differs, commerce never does.

enum SheetDetent: String {
    case collapsed, medium, expanded

    func height(in total: CGFloat) -> CGFloat {
        switch self {
        case .collapsed: return 76
        case .medium: return total * 0.46
        case .expanded: return total * 0.86
        }
    }

    var next: SheetDetent {
        switch self {
        case .collapsed: return .medium
        case .medium: return .expanded
        case .expanded: return .collapsed
        }
    }
}

struct ImmersiveProductView: View {
    let product: Product

    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var detent: SheetDetent = .medium
    @State private var dragHeight: CGFloat?    // live height mid-drag
    @State private var photoIndex = 0
    @State private var viewerIndex: ViewerIndex?

    private struct ViewerIndex: Identifiable { let id: Int }

    private static let detentKeyPrefix = "lusik.sheetDetent."
    static let gestureLearnedKey = "lusik.sheetGestureLearned"

    var body: some View {
        GeometryReader { geo in
            let total = geo.size.height
            let sheetHeight = dragHeight ?? detent.height(in: total)

            ZStack(alignment: .bottom) {
                photoBackdrop

                pageDots
                    .padding(.bottom, sheetHeight + 12)

                sheet(height: sheetHeight, total: total)
            }
            .overlay(alignment: .topLeading) { backButton }
        }
        .background(Brand.ink)
        .toolbar(.hidden, for: .navigationBar)
        .onAppear(perform: restoreDetent)
        .fullScreenCover(item: $viewerIndex) { idx in
            // Chunk-3 placeholder viewer: whole photo inside the screen
            // (every edge visible). Pinch/double-tap zoom replaces this.
            PhotoViewerPlaceholder(photos: product.photoURLs, startIndex: idx.id)
        }
    }

    // ── full-bleed photo pager ──
    private var photoBackdrop: some View {
        TabView(selection: $photoIndex) {
            ForEach(Array(product.photoURLs.enumerated()), id: \.offset) { i, url in
                AsyncImage(url: url) { phase in
                    if case .success(let image) = phase {
                        image.resizable().scaledToFill()
                    } else {
                        Brand.ink
                    }
                }
                .tag(i)
                .contentShape(Rectangle())
                .onTapGesture(perform: photoTapped)
            }
        }
        .tabViewStyle(.page(indexDisplayMode: .never))
        .ignoresSafeArea()
        .accessibilityLabel("\(product.name) photos")
    }

    // The detent-aware tap: card up → show me the photos; card already
    // down → show me EVERYTHING (the viewer).
    private func photoTapped() {
        if detent != .collapsed {
            snap(to: .collapsed)
        } else {
            viewerIndex = ViewerIndex(id: photoIndex)
        }
    }

    private var pageDots: some View {
        HStack(spacing: 7) {
            ForEach(0..<min(product.photoURLs.count, 14), id: \.self) { i in
                Circle()
                    .fill(.white.opacity(i == min(photoIndex, 13) ? 0.95 : 0.4))
                    .frame(width: 6, height: 6)
            }
        }
        .allowsHitTesting(false)
        .animation(reduceMotion ? nil : .easeOut(duration: 0.2), value: photoIndex)
    }

    private var backButton: some View {
        Button {
            dismiss()
        } label: {
            Image(systemName: "chevron.left")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Brand.ink)
                .frame(width: 38, height: 38)
                .background(.regularMaterial, in: Circle())
        }
        .padding(.leading, 14)
        .padding(.top, 8)
        .accessibilityLabel("Back")
    }

    // ── the draggable sheet ──
    private func sheet(height: CGFloat, total: CGFloat) -> some View {
        VStack(spacing: 0) {
            sheetHandle(total: total)

            if detent != .collapsed || dragHeight != nil {
                ScrollView {
                    ProductBuyControls(product: product)
                        .padding(.horizontal, 20)
                        .padding(.top, 4)
                        .padding(.bottom, 28)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .frame(height: height, alignment: .top)
        .background(.background)
        .clipShape(UnevenRoundedRectangle(topLeadingRadius: 22, topTrailingRadius: 22))
        .shadow(color: .black.opacity(0.25), radius: 18, y: -4)
    }

    // Grabber + pill row. Drag lives HERE (not the body — it scrolls);
    // tapping the row cycles detents, exactly like the web pill.
    private func sheetHandle(total: CGFloat) -> some View {
        VStack(spacing: 6) {
            Capsule()
                .fill(Brand.ink.opacity(0.25))
                .frame(width: 40, height: 5)
                .padding(.top, 8)

            HStack(spacing: 10) {
                Text(product.name)
                    .font(Brand.fontDisplay(16, weight: .medium))
                    .foregroundStyle(Brand.ink)
                    .lineLimit(1)
                Spacer(minLength: 6)
                Text("$\(product.priceDollars)")
                    .font(Brand.fontBody(15, weight: .semibold))
                    .foregroundStyle(Brand.accent)
                Image(systemName: detent == .expanded ? "chevron.down" : "chevron.up")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Brand.ink.opacity(0.5))
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 10)
        }
        .contentShape(Rectangle())
        .onTapGesture { snap(to: detent.next) }
        .gesture(dragGesture(total: total))
        .accessibilityAddTraits(.isButton)
        .accessibilityLabel(detent == .collapsed ? "Expand product details" : "Collapse")
    }

    private func dragGesture(total: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 6)
            .onChanged { value in
                let start = detent.height(in: total)
                dragHeight = min(total * 0.92, max(SheetDetent.collapsed.height(in: total),
                                                   start - value.translation.height))
            }
            .onEnded { value in
                let current = dragHeight ?? detent.height(in: total)
                let target: SheetDetent
                let vy = value.velocity.height // +down / -up
                if vy < -600 {
                    target = current > SheetDetent.medium.height(in: total) ? .expanded : .medium
                } else if vy > 600 {
                    target = current < SheetDetent.medium.height(in: total) ? .collapsed : .medium
                } else {
                    target = nearestDetent(to: current, total: total)
                }
                snap(to: target)
            }
    }

    private func nearestDetent(to height: CGFloat, total: CGFloat) -> SheetDetent {
        let candidates: [SheetDetent] = [.collapsed, .medium, .expanded]
        return candidates.min(by: {
            abs($0.height(in: total) - height) < abs($1.height(in: total) - height)
        }) ?? .medium
    }

    private func snap(to target: SheetDetent) {
        let animation: Animation? = reduceMotion
            ? nil
            : .spring(response: 0.42, dampingFraction: 0.82)
        withAnimation(animation) {
            detent = target
            dragHeight = nil
        }
        let defaults = UserDefaults.standard
        defaults.set(target.rawValue, forKey: Self.detentKeyPrefix + product.id)
        // The guest has now moved the sheet themselves — the Chunk-6
        // breathe hint retires permanently on this flag.
        defaults.set(true, forKey: Self.gestureLearnedKey)
    }

    private func restoreDetent() {
        if let saved = UserDefaults.standard.string(forKey: Self.detentKeyPrefix + product.id),
           let restored = SheetDetent(rawValue: saved) {
            detent = restored
        }
    }
}

// Minimal full-photo viewer (object-contain on black, every edge visible).
// Chunk 3 replaces this with the zoomable lightbox — pinch, double-tap,
// pan, photo paging.
struct PhotoViewerPlaceholder: View {
    let photos: [URL]
    let startIndex: Int
    @Environment(\.dismiss) private var dismiss
    @State private var index: Int = 0

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Color.black.ignoresSafeArea()

            TabView(selection: $index) {
                ForEach(Array(photos.enumerated()), id: \.offset) { i, url in
                    AsyncImage(url: url) { phase in
                        if case .success(let image) = phase {
                            image.resizable().scaledToFit()
                        } else {
                            ProgressView().tint(.white)
                        }
                    }
                    .tag(i)
                    .padding(.horizontal, 12)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))

            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 42, height: 42)
                    .background(.white.opacity(0.15), in: Circle())
            }
            .padding(.trailing, 14)
            .accessibilityLabel("Close photo viewer")

            VStack {
                Spacer()
                Text("\(index + 1) / \(photos.count)")
                    .font(Brand.fontBody(12, weight: .medium))
                    .foregroundStyle(.white.opacity(0.85))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 4)
                    .background(.white.opacity(0.14), in: Capsule())
                    .padding(.bottom, 18)
            }
        }
        .onAppear { index = startIndex }
    }
}

#Preview {
    NavigationStack {
        ImmersiveProductView(product: Catalog.products[6])
    }
    .environmentObject(CartStore())
}
