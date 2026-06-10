import SwiftUI

// ============================================================
// ProductDetailView — the CLASSIC product page
// ============================================================
// Used by configurator-led products (alphabet blanket, custom name bib —
// parity with the web's SHEET.EXCLUDE_KEYS) and as the universal
// fallback. Photo pager up top, then the SAME ProductBuyControls the
// immersive sheet uses — presentation differs, commerce never does.

struct ProductDetailView: View {
    let product: Product

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                TabView {
                    ForEach(Array(product.photoURLs.prefix(12).enumerated()), id: \.offset) { _, url in
                        AsyncImage(url: url) { phase in
                            if case .success(let image) = phase {
                                image.resizable().scaledToFill()
                            } else {
                                Brand.creamSubtle
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .clipped()
                    }
                }
                .tabViewStyle(.page)
                .frame(height: 420)

                ProductBuyControls(product: product)
                    .padding(.horizontal, 18)
                    .padding(.bottom, 28)
            }
        }
        .background(Brand.cream)
        .ignoresSafeArea(edges: .top)
        .toolbarBackground(.hidden, for: .navigationBar)
    }
}

#Preview {
    NavigationStack {
        ProductDetailView(product: Catalog.products[0])
    }
    .environmentObject(CartStore())
}
