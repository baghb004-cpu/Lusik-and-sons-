"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useSite } from "../state/SiteProvider.jsx";
import { useSiteNav } from "../state/useSiteNav.js";

const AdminView = dynamic(() => import("../components/AdminView.jsx").then((m) => m.AdminView), { ssr: false });
const AdminOrderDetail = dynamic(() => import("../components/AdminOrderDetail.jsx").then((m) => m.AdminOrderDetail), { ssr: false });

// Admin order detail has no public URL in the SPA (internal state), so the
// /admin route keeps that detail view as local state, mirroring App.jsx.
export function AdminRoute() {
  const site = useSite();
  const nav = useSiteNav();
  const [orderId, setOrderId] = useState(null);

  if (!site.isAdmin) return null;

  if (orderId) {
    return (
      <AdminOrderDetail
        orderId={orderId}
        onBack={() => setOrderId(null)}
        onViewSite={() => { setOrderId(null); nav.goForYou(); }}
        onSignOut={site.signOut}
      />
    );
  }
  return (
    <AdminView
      user={site.user}
      onBack={nav.goForYou}
      onOpenOrder={(id) => setOrderId(id)}
      onSignOut={site.signOut}
    />
  );
}

export default AdminRoute;
