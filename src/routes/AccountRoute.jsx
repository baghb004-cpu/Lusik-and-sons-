"use client";

import dynamic from "next/dynamic";
import { PRODUCT } from "../data/product.js";
import { useSite } from "../state/SiteProvider.jsx";
import { useSiteNav } from "../state/useSiteNav.js";

const AccountView = dynamic(() => import("../components/AccountView.jsx").then((m) => m.AccountView), { ssr: false });

export function AccountRoute() {
  const site = useSite();
  const nav = useSiteNav();
  return (
    <AccountView
      user={site.user}
      profile={site.profile}
      onProfileUpdate={site.setProfile}
      onBack={nav.goForYou}
      onSignOut={site.signOut}
      onReorder={() => {}}
      product={PRODUCT}
      onOpenAdmin={site.isAdmin ? nav.goAdmin : null}
    />
  );
}

export default AccountRoute;
