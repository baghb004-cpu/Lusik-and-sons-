"use client";

import dynamic from "next/dynamic";
import { PRODUCT } from "../data/product.js";
import { useSite } from "../state/SiteProvider.jsx";
import { useSiteNav } from "../state/useSiteNav.js";
import { useToast } from "../components/ToastProvider.jsx";
import { productPathForCartItem } from "../lib/productUrl.js";

const AccountView = dynamic(() => import("../components/AccountView.jsx").then((m) => m.AccountView), { ssr: false });

export function AccountRoute() {
  const site = useSite();
  const nav = useSiteNav();
  const toast = useToast();
  return (
    <AccountView
      user={site.user}
      profile={site.profile}
      onProfileUpdate={site.setProfile}
      onBack={nav.goForYou}
      onSignOut={site.signOut}
      // "Order again" walks the customer to the ordered piece's product
      // page rather than force-adding stale line items: order rows only
      // hold display metadata (not the full configurator state), and
      // prices may have changed since — the PDP is always current.
      // (This was a `() => {}` stub: the button rendered but did nothing.)
      onReorder={(order) => {
        const items = order?.order_items ?? [];
        const first = items[0];
        if (!first) return;
        toast({
          message: items.length > 1
            ? `Your order had ${items.length} pieces — starting with ${first.product_name}. Add each piece from its page.`
            : `Pick your options for ${first.product_name} again — the page always shows current colors and prices.`,
        });
        nav.go(productPathForCartItem({ productKey: first.product_key }));
      }}
      product={PRODUCT}
      onOpenAdmin={site.isAdmin ? nav.goAdmin : null}
    />
  );
}

export default AccountRoute;
