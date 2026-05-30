"use client";

import dynamic from "next/dynamic";
import { useSite } from "../state/SiteProvider.jsx";
import { useSiteNav } from "../state/useSiteNav.js";

const CheckoutView = dynamic(() => import("../components/CheckoutView.jsx").then((m) => m.CheckoutView), { ssr: false });

// Express buy-now sends a single transient item; otherwise checkout reflects
// the saved bag — identical to App.jsx's checkout branch.
export function CheckoutRoute() {
  const site = useSite();
  const nav = useSiteNav();
  const cart = site.buyNowItem ? [site.buyNowItem] : site.cart;
  const subtotal = site.buyNowItem
    ? (Number(site.buyNowItem.qty) || 0) * (Number(site.buyNowItem.price) || 0)
    : site.subtotal;
  return (
    <CheckoutView
      cart={cart}
      subtotal={subtotal}
      user={site.user}
      profile={site.profile}
      onBack={nav.goForYou}
    />
  );
}

export default CheckoutRoute;
