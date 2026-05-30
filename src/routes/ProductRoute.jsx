"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { getProductBySlugs } from "../data/catalog.js";
import { PRODUCT } from "../data/product.js";
import { CUSTOM_PRODUCTS } from "../data/customProducts.js";
import { useSite } from "../state/SiteProvider.jsx";
import { useSiteNav } from "../state/useSiteNav.js";

const ProductView = dynamic(() => import("../components/shop/ProductView.jsx").then((m) => m.ProductView), { ssr: false });

export function ProductRoute() {
  const site = useSite();
  const nav = useSiteNav();
  const params = useParams();
  const cat = typeof params?.category === "string" ? params.category : "";
  const prod = typeof params?.product === "string" ? params.product : "";
  const pair = getProductBySlugs(cat, prod);
  if (!pair) return null;

  return (
    <ProductView
      category={pair.category}
      product={pair.product}
      productData={PRODUCT}
      customProductData={CUSTOM_PRODUCTS?.bib}
      onAdd={site.addToCart}
      onAddCustom={site.addCustomToCart}
      onBuyNow={(...a) => { site.buyNowBlanket(...a); nav.goCheckout(); }}
      onBuyNowCustom={(...a) => { site.buyNowCustom(...a); nav.goCheckout(); }}
      onCartFeedback={() => {}}
      user={site.user}
      onRequireSignIn={() => {}}
      onStickyCtaShown={() => {}}
      onOpenWaitlist={() => {}}
      onNavigateHome={nav.goForYou}
      onNavigateShop={nav.goShopIndex}
      onNavigateCategory={nav.goShopCategory}
    />
  );
}

export default ProductRoute;
