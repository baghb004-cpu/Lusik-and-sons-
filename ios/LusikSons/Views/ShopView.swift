import SwiftUI

// ============================================================
// Shop — index cards → category grid → product detail
// ============================================================
// Mirrors the website's /shop hierarchy (ShopIndexView → CategoryView →
// ProductView). The detail page here is the CLASSIC layout; Chunk 2
// replaces it with the immersive pill sheet for photo-led products
// (Product.presentation already carries that decision).

struct ShopView: View {
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    ForEach(ShopCategory.all) { category in
                        if category.comingSoon {
                            CategoryCard(category: category)
                                .opacity(0.55)
                        } else {
                            NavigationLink(value: category.id) {
                                CategoryCard(category: category)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(.horizontal, 18)
                .padding(.bottom, 24)
            }
            .background(Brand.cream)
            .navigationTitle("Shop")
            .navigationDestination(for: String.self) { slug in
                if let category = ShopCategory.all.first(where: { $0.id == slug }) {
                    CategoryView(category: category)
                }
            }
            .navigationDestination(for: Product.self) { product in
                // ProductRoute owns the presentation split (web
                // SHEET.EXCLUDE_KEYS parity) — shared with the bag.
                ProductRoute(product: product)
            }
        }
    }
}

// One big category card — image, label, blurb (the web's
// "Browse {Category}" cards).
private struct CategoryCard: View {
    let category: ShopCategory

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack(alignment: .bottomLeading) {
                AsyncImage(url: category.coverURL) { phase in
                    if case .success(let image) = phase {
                        image.resizable().scaledToFill()
                    } else {
                        Brand.creamSubtle
                    }
                }
                .frame(height: 168)
                .clipped()

                if category.comingSoon {
                    Text("COMING SOON")
                        .font(Brand.fontBody(10, weight: .semibold))
                        .kerning(2)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Brand.ink.opacity(0.75))
                        .foregroundStyle(Brand.textOnInk)
                        .padding(10)
                }
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(category.label)
                    .font(Brand.fontDisplay(22, weight: .medium))
                    .foregroundStyle(Brand.ink)
                Text(category.blurb)
                    .font(Brand.fontBody(13))
                    .foregroundStyle(Brand.ink.opacity(0.65))
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(.background)
        }
        .clipShape(RoundedRectangle(cornerRadius: Brand.cornerRadius))
        .shadow(color: Brand.ink.opacity(0.08), radius: 10, y: 4)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(category.comingSoon
            ? "\(category.label) — coming soon"
            : "Browse \(category.label)")
    }
}

// Product grid for one category (the web's CategoryView).
struct CategoryView: View {
    let category: ShopCategory

    var body: some View {
        ScrollView {
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 14), GridItem(.flexible())], spacing: 18) {
                ForEach(category.products) { product in
                    NavigationLink(value: product) {
                        ProductCard(product: product)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 18)
            .padding(.bottom, 24)
        }
        .background(Brand.cream)
        .navigationTitle(category.label)
        .navigationBarTitleDisplayMode(.large)
    }
}

struct ProductCard: View {
    let product: Product

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            AsyncImage(url: product.photoURLs.first) { phase in
                if case .success(let image) = phase {
                    image.resizable().scaledToFill()
                } else {
                    Brand.creamSubtle
                }
            }
            .frame(height: 190)
            .clipShape(RoundedRectangle(cornerRadius: Brand.cornerRadius))

            Text(product.name)
                .font(Brand.fontDisplay(16, weight: .medium))
                .foregroundStyle(Brand.ink)
                .multilineTextAlignment(.leading)
                .lineLimit(2, reservesSpace: true)

            Text("From $\(product.priceDollars)")
                .font(Brand.fontBody(13, weight: .medium))
                .foregroundStyle(Brand.accent)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("View \(product.name)")
    }
}

#Preview {
    ShopView().environmentObject(CartStore())
}
