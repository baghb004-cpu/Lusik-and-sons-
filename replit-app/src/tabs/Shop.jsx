// ============================================================
// Shop — index cards → category grid → product detail (Chunk 1)
// ============================================================
// The JS sibling of ios/LusikSons/Views/ShopView.swift +
// ProductDetailView.swift. Routes live in the hash (the tab's own
// stack): #/products, #/products/<category>, #/products/<category>/
// <product>. The detail page here is the CLASSIC layout; Chunk 2
// replaces it with the immersive pill sheet for photo-led products
// (product.presentation already carries that decision).

import React, { useEffect, useRef, useState } from "react";
import { CATEGORIES, productsInCategory, findProduct, categoryCover } from "../data/catalog.js";
import { useHashRoute } from "../lib/useHashRoute.js";
import { ProductBuyControls } from "../components/ProductBuyControls.jsx";
import { ImmersiveProduct } from "../components/ImmersiveProduct.jsx";

export function Shop() {
  const { segments, navigate, back } = useHashRoute();
  // segments: ["products", category?, product?]
  const categorySlug = segments[1] ?? null;
  const productSlug = segments[2] ?? null;

  const product = categorySlug && productSlug ? findProduct(categorySlug, productSlug) : null;
  const category = categorySlug ? CATEGORIES.find((c) => c.slug === categorySlug) : null;

  if (product) return <ProductRoute product={product} onBack={back} />;
  if (category && !category.comingSoon) return <CategoryGrid category={category} onOpen={(p) => navigate(`products/${p.categorySlug}/${p.productSlug}`)} onBack={back} />;
  return <CategoryIndex onOpen={(c) => navigate(`products/${c.slug}`)} />;
}

// Routes a product to the right page — the ONE presentation switch
// (BagView.swift's ProductRoute parity), so the rules can't drift when
// the bag links back to products in Chunk 4.
export function ProductRoute({ product, onBack }) {
  if (product.presentation === "immersiveSheet") {
    return <ImmersiveProduct product={product} onBack={onBack} />;
  }
  return <ProductDetail product={product} onBack={onBack} />;
}

// ── index: the four category cards ──
function CategoryIndex({ onOpen }) {
  return (
    <div className="shop-page">
      <h1 className="page-title">Shop</h1>
      <div className="shop-cats">
        {CATEGORIES.map((c) => {
          const cover = categoryCover(c);
          return (
            <button
              key={c.slug}
              type="button"
              className="shop-cat-card"
              disabled={c.comingSoon}
              onClick={() => !c.comingSoon && onOpen(c)}
              aria-label={c.comingSoon ? `${c.label} — coming soon` : `Browse ${c.label}`}
            >
              <span className="shop-cat-photo">
                {cover ? <img src={cover} alt="" loading="lazy" /> : <span className="shop-cat-empty" />}
                {c.comingSoon && <span className="shop-badge">Coming soon</span>}
              </span>
              <span className="shop-cat-text">
                <span className="shop-cat-label brand-display">{c.label}</span>
                <span className="shop-cat-blurb">{c.blurb}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── one category's product grid ──
function CategoryGrid({ category, onOpen, onBack }) {
  return (
    <div className="shop-page">
      <button type="button" className="back-link" onClick={onBack} aria-label="Back">
        ‹ Shop
      </button>
      <h1 className="page-title">{category.label}</h1>
      <div className="shop-grid">
        {productsInCategory(category.slug).map((p) => (
          <button key={p.id} type="button" className="shop-product-card" onClick={() => onOpen(p)} aria-label={`View ${p.name}`}>
            <span className="shop-product-photo">
              <img src={p.photoURLs[0]} alt="" loading="lazy" />
            </span>
            <span className="shop-product-name brand-display">{p.name}</span>
            <span className="shop-product-price">From ${p.priceDollars}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── classic product detail (photo pager + the one buy surface) ──
function ProductDetail({ product, onBack }) {
  const pagerRef = useRef(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  // Restart at the first photo when the product changes.
  useEffect(() => {
    setPhotoIndex(0);
    pagerRef.current?.scrollTo({ left: 0, behavior: "instant" });
  }, [product.id]);

  const onScroll = () => {
    const el = pagerRef.current;
    if (el) setPhotoIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
  };

  const dots = Math.min(product.photoURLs.length, 14);

  return (
    <div className="pdp">
      <button type="button" className="back-link pdp-back" onClick={onBack} aria-label="Back">
        ‹ Back
      </button>

      <div className="pdp-pager-wrap">
        <div className="pdp-pager" ref={pagerRef} onScroll={onScroll} aria-label={`${product.name} photos`}>
          {product.photoURLs.map((src, i) => (
            <img key={i} src={src} alt={`${product.name} — photo ${i + 1}`} loading={i === 0 ? "eager" : "lazy"} draggable={false} />
          ))}
        </div>
        {dots > 1 && (
          <div className="pdp-dots" aria-hidden="true">
            {Array.from({ length: dots }, (_, i) => (
              <span key={i} className={i === Math.min(photoIndex, dots - 1) ? "dot dot-active" : "dot"} />
            ))}
          </div>
        )}
      </div>

      <div className="pdp-body readable">
        <ProductBuyControls product={product} />
      </div>
    </div>
  );
}
