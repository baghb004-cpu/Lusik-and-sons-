"use client";

// ============================================================
// WelcomeRoute — the /welcome shell
// ============================================================
// Thin, like every other route shell: the page is WelcomeView, and the
// only thing this adds is navigation. Nothing here fetches, and the page
// has no state, so it renders identically on the server and in the
// browser.
// ============================================================

import React from "react";
import { WelcomeView } from "../components/WelcomeView.jsx";
import { useSiteNav } from "../state/useSiteNav.js";

export function WelcomeRoute() {
  const nav = useSiteNav();
  return <WelcomeView onNavigateShop={nav.goShopIndex} onPrefetch={nav.prefetch} />;
}

export default WelcomeRoute;
