"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useSite } from "../state/SiteProvider.jsx";
import { useSiteNav } from "../state/useSiteNav.js";

const CartContents = dynamic(() => import("../components/CartContents.jsx").then((m) => m.CartContents), { ssr: false });

// The mobile full-page bag (Apple-Store style). Desktop keeps the drawer
// (wired into the chrome in a later phase); this is the standalone /cart page.
export function CartRoute() {
  const site = useSite();
  const nav = useSiteNav();
  const [editMode, setEditMode] = useState(false);
  return (
    <div className="lg:hidden flex flex-col" style={{ minHeight: "100vh", paddingBottom: 24 }}>
      <CartContents
        variant="page"
        cart={site.cart}
        subtotal={site.subtotal}
        cartEditMode={editMode}
        onToggleEdit={setEditMode}
        setQtyExact={site.setQtyExact}
        removeFromCart={site.removeFromCart}
        onCheckout={nav.goCheckout}
        onShopBlankets={() => nav.goShopCategory("blankets")}
        onOpenSavedDesigns={nav.goAccount}
        user={site.user}
      />
    </div>
  );
}

export default CartRoute;
