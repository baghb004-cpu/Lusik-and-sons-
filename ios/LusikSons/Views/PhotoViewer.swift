import SwiftUI
import UIKit

// ============================================================
// PhotoViewer — the zoomable lightbox (Chunk 3)
// ============================================================
// The "see everything" view, native edition. The backdrop pager crops
// photos full-bleed; this shows the WHOLE photo inside the screen —
// corners, edges, border stitching — and lets the customer get close:
//
//   • pinch to zoom 1×–4×, anchored between the fingers
//   • double-tap to zoom into that exact spot / double-tap to reset
//   • drag to pan while zoomed, clamped to the photo's edges
//   • swipe sideways (unzoomed) for the next/previous photo
//   • pull down (unzoomed) to close — plus the ✕ button
//
// Each page wraps a UIScrollView: anchored pinch, rubber-banding,
// zoom-to-rect and pan clamping are decades-old UIKit behavior — far
// better than reimplementing gesture math (the web version had to).

private enum ViewerConfig {
    static let maxZoom: CGFloat = 4      // parity with web SHEET.LIGHTBOX_MAX_ZOOM
    static let doubleTapZoom: CGFloat = 2.5
    static let pullDownToClose: CGFloat = 110
}

struct PhotoViewer: View {
    let photos: [URL]
    let title: String
    let startIndex: Int

    @Environment(\.dismiss) private var dismiss
    @State private var index: Int = 0
    @State private var zoomed = false

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Color.black.ignoresSafeArea()

            TabView(selection: $index) {
                ForEach(Array(photos.enumerated()), id: \.offset) { i, url in
                    ZoomableRemoteImage(
                        url: url,
                        isZoomed: $zoomed,
                        onPullDismiss: { dismiss() }
                    )
                    .tag(i)
                    .ignoresSafeArea()
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .ignoresSafeArea()

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

            VStack(spacing: 6) {
                Spacer()
                Text(zoomed ? "Drag to look around · double-tap to reset"
                            : "Pinch or double-tap to zoom")
                    .font(Brand.fontBody(10, weight: .medium))
                    .kerning(1.4)
                    .textCase(.uppercase)
                    .foregroundStyle(.white.opacity(0.55))
                Text("\(index + 1) / \(photos.count)")
                    .font(Brand.fontBody(12, weight: .medium))
                    .foregroundStyle(.white.opacity(0.85))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 4)
                    .background(.white.opacity(0.14), in: Capsule())
            }
            .frame(maxWidth: .infinity)
            .padding(.bottom, 18)
            .allowsHitTesting(false)
        }
        .onAppear { index = startIndex }
        .accessibilityLabel("\(title) — photo viewer")
    }
}

// ── one zoomable page ───────────────────────────────────────

private struct ZoomableRemoteImage: UIViewRepresentable {
    let url: URL
    @Binding var isZoomed: Bool
    let onPullDismiss: () -> Void

    func makeUIView(context: Context) -> UIScrollView {
        let scroll = UIScrollView()
        scroll.minimumZoomScale = 1
        scroll.maximumZoomScale = ViewerConfig.maxZoom
        scroll.showsVerticalScrollIndicator = false
        scroll.showsHorizontalScrollIndicator = false
        scroll.bouncesZoom = true
        scroll.alwaysBounceVertical = true
        scroll.contentInsetAdjustmentBehavior = .never
        scroll.backgroundColor = .clear
        scroll.delegate = context.coordinator

        let imageView = UIImageView()
        imageView.contentMode = .scaleAspectFit
        imageView.isUserInteractionEnabled = true
        scroll.addSubview(imageView)
        context.coordinator.imageView = imageView
        context.coordinator.scrollView = scroll

        let doubleTap = UITapGestureRecognizer(
            target: context.coordinator,
            action: #selector(Coordinator.handleDoubleTap(_:))
        )
        doubleTap.numberOfTapsRequired = 2
        imageView.addGestureRecognizer(doubleTap)

        context.coordinator.load(url: url)
        return scroll
    }

    func updateUIView(_ uiView: UIScrollView, context: Context) {
        context.coordinator.layoutImage(in: uiView.bounds.size)
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(isZoomed: $isZoomed, onPullDismiss: onPullDismiss)
    }

    final class Coordinator: NSObject, UIScrollViewDelegate {
        weak var imageView: UIImageView?
        weak var scrollView: UIScrollView?
        private let isZoomed: Binding<Bool>
        private let onPullDismiss: () -> Void
        private var lastLaidOutSize: CGSize = .zero

        init(isZoomed: Binding<Bool>, onPullDismiss: @escaping () -> Void) {
            self.isZoomed = isZoomed
            self.onPullDismiss = onPullDismiss
        }

        func load(url: URL) {
            Task { @MainActor in
                guard let (data, _) = try? await URLSession.shared.data(from: url),
                      let image = UIImage(data: data) else { return }
                imageView?.image = image
                if let scroll = scrollView { layoutImage(in: scroll.bounds.size) }
            }
        }

        // Fit the image inside the page (object-contain) and center it.
        @MainActor func layoutImage(in container: CGSize) {
            guard let scroll = scrollView, let imageView,
                  let image = imageView.image,
                  container.width > 0, container.height > 0,
                  container != lastLaidOutSize || imageView.frame.isEmpty else { return }
            lastLaidOutSize = container

            let scale = min(container.width / image.size.width,
                            container.height / image.size.height)
            let fitted = CGSize(width: image.size.width * scale,
                                height: image.size.height * scale)
            scroll.zoomScale = 1
            imageView.frame = CGRect(origin: .zero, size: fitted)
            scroll.contentSize = fitted
            centerContent()
        }

        // Keep the (possibly zoomed) image centered with insets; UIKit
        // clamps panning to the content automatically.
        @MainActor private func centerContent() {
            guard let scroll = scrollView else { return }
            let dx = max(0, (scroll.bounds.width - scroll.contentSize.width) / 2)
            let dy = max(0, (scroll.bounds.height - scroll.contentSize.height) / 2)
            scroll.contentInset = UIEdgeInsets(top: dy, left: dx, bottom: dy, right: dx)
        }

        func viewForZooming(in scrollView: UIScrollView) -> UIView? { imageView }

        func scrollViewDidZoom(_ scrollView: UIScrollView) {
            MainActor.assumeIsolated {
                centerContent()
                isZoomed.wrappedValue = scrollView.zoomScale > 1.02
            }
        }

        // Pull-down-to-close: only meaningful while unzoomed (zoomed
        // vertical drags are panning). The bounce offset is the signal.
        func scrollViewWillEndDragging(
            _ scrollView: UIScrollView,
            withVelocity velocity: CGPoint,
            targetContentOffset: UnsafeMutablePointer<CGPoint>
        ) {
            guard scrollView.zoomScale <= 1.02 else { return }
            let pull = -(scrollView.contentOffset.y + scrollView.contentInset.top)
            if pull > ViewerConfig.pullDownToClose {
                MainActor.assumeIsolated { onPullDismiss() }
            }
        }

        @MainActor @objc func handleDoubleTap(_ gesture: UITapGestureRecognizer) {
            guard let scroll = scrollView, let imageView else { return }
            if scroll.zoomScale > 1.02 {
                scroll.setZoomScale(1, animated: true)
            } else {
                let point = gesture.location(in: imageView)
                let size = CGSize(
                    width: scroll.bounds.width / ViewerConfig.doubleTapZoom,
                    height: scroll.bounds.height / ViewerConfig.doubleTapZoom
                )
                let rect = CGRect(
                    x: point.x - size.width / 2,
                    y: point.y - size.height / 2,
                    width: size.width,
                    height: size.height
                )
                scroll.zoom(to: rect, animated: true)
            }
        }
    }
}

#Preview {
    PhotoViewer(
        photos: Catalog.products[6].photoURLs,
        title: Catalog.products[6].name,
        startIndex: 0
    )
}
