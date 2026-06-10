import SwiftUI

/// Chunk-0 shop: every live product with its cover photo (loaded from the
/// production site) and price. Chunk 1 grows this into the category grid +
/// real product pages; Chunk 2 adds the immersive pill sheet.
struct ShopView: View {
    private let products = Catalog.products

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 14), GridItem(.flexible())], spacing: 18) {
                    ForEach(products) { product in
                        ProductCard(product: product)
                    }
                }
                .padding(.horizontal, 18)
                .padding(.bottom, 24)
            }
            .background(Brand.cream)
            .navigationTitle("Shop")
        }
    }
}

struct ProductCard: View {
    let product: Product

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            AsyncImage(url: product.photoURLs.first) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                default:
                    Brand.creamSubtle
                }
            }
            .frame(height: 190)
            .clipShape(RoundedRectangle(cornerRadius: Brand.cornerRadius))

            Text(product.name)
                .font(Brand.fontDisplay(16, weight: .medium))
                .foregroundStyle(Brand.ink)
                .lineLimit(2, reservesSpace: true)

            Text("From $\(product.priceDollars)")
                .font(Brand.fontBody(13, weight: .medium))
                .foregroundStyle(Brand.accent)
        }
    }
}

#Preview {
    ShopView()
}
