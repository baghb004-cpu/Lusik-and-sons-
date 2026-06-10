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
    @Environment(\.horizontalSizeClass) private var sizeClass

    @State private var detent: SheetDetent = .medium
    @State private var dragHeight: CGFloat?    // live height mid-drag
    @State private var photoIndex = 0
    @State private var viewerIndex: ViewerIndex?
    // The "breathe" teaching hint: a soft rise-and-settle on open, played
    // on EVERY product until the guest moves the sheet themselves once —
    // then never again (seen isn't learned; used is). Web parity.
    @State private var breatheOffset: CGFloat = 0
    @State private var breatheTask: Task<Void, Never>?

    private struct ViewerIndex: Identifiable { let id: Int }

    private static let detentKeyPrefix = "lusik.sheetDetent."
    static let gestureLearnedKey = "lusik.sheetGestureLearned"

    /// The open-book posture (iPhone Fold inner display, iPads, landscape
    /// Max): photos become the left page, buying the right page — there is
    /// no pill sheet to drag because nothing needs uncovering.
    private var isSpread: Bool { sizeClass == .regular }

    var body: some View {
        GeometryReader { geo in
            if isSpread {
                spread(size: geo.size)
            } else {
                compact(size: geo.size)
            }
        }
        .background(Brand.ink)
        .toolbar(.hidden, for: .navigationBar)
        .onAppear {
            restoreDetent()
            startBreatheIfNeeded()
        }
        .onDisappear { breatheTask?.cancel() }
        .fullScreenCover(item: $viewerIndex) { idx in
            PhotoViewer(photos: product.photoURLs, title: product.name, startIndex: idx.id)
        }
    }

    // ── compact: the pill-sheet experience (phones, the Fold's cover) ──
    private func compact(size: CGSize) -> some View {
        let total = size.height
        let sheetHeight = dragHeight ?? detent.height(in: total)

        return ZStack(alignment: .bottom) {
            photoPager.ignoresSafeArea()

            pageDots
                .padding(.bottom, sheetHeight + 12)

            sheet(height: sheetHeight, total: total)
        }
        .overlay(alignment: .topLeading) { backButton }
    }

    // ── unfolded: the two-page spread ──
    private func spread(size: CGSize) -> some View {
        HStack(spacing: 0) {
            ZStack(alignment: .bottom) {
                photoPager
                pageDots
                    .padding(.bottom, 18)
            }
            .frame(width: size.width * FoldLayout.spreadPhotoFraction)
            .clipped()

            ScrollView {
                ProductBuyControls(product: product)
                    .padding(24)
                    .frame(maxWidth: FoldLayout.readableWidth, alignment: .leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Brand.surface)
        }
        .overlay(alignment: .topLeading) { backButton }
    }

    // ── photo pager (shared by both postures) ──
    private var photoPager: some View {
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
        .accessibilityLabel("\(product.name) photos")
    }

    // The detent-aware tap: card up → show me the photos; card already
    // down → show me EVERYTHING (the viewer). On the spread there's no
    // sheet covering anything — a tap goes straight to the viewer.
    private func photoTapped() {
        if isSpread {
            viewerIndex = ViewerIndex(id: photoIndex)
        } else if detent != .collapsed {
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
        .background(Brand.surface)
        .clipShape(UnevenRoundedRectangle(topLeadingRadius: 22, topTrailingRadius: 22))
        .shadow(color: .black.opacity(0.25), radius: 18, y: -4)
        .offset(y: breatheOffset)
    }

    // ── breathe hint ──
    private func startBreatheIfNeeded() {
        // No sheet on the spread — nothing to teach.
        guard !isSpread,
              !reduceMotion,
              !UserDefaults.standard.bool(forKey: Self.gestureLearnedKey)
        else { return }
        breatheTask?.cancel()
        breatheTask = Task { @MainActor in
            // A beat after the page lands, so it reads as an invitation,
            // not a glitch — then rise 16pt and settle (web keyframes).
            let steps: [(CGFloat, Double, Double)] = [   // (offset, duration, pause)
                (-16, 0.34, 0), (5, 0.26, 0), (-3, 0.2, 0), (0, 0.22, 0),
            ]
            try? await Task.sleep(for: .seconds(0.45))
            guard !Task.isCancelled else { return }
            for (offset, duration, _) in steps {
                guard !Task.isCancelled else { return }
                withAnimation(.easeOut(duration: duration)) { breatheOffset = offset }
                try? await Task.sleep(for: .seconds(duration))
            }
        }
    }

    // A real gesture takes over instantly — the hint must never fight it.
    private func cancelBreathe() {
        breatheTask?.cancel()
        if breatheOffset != 0 {
            withAnimation(.easeOut(duration: 0.12)) { breatheOffset = 0 }
        }
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
                cancelBreathe()
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
        cancelBreathe()
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

#Preview {
    NavigationStack {
        ImmersiveProductView(product: Catalog.products[6])
    }
    .environmentObject(CartStore())
}
