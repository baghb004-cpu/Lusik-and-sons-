"use client";

import dynamic from "next/dynamic";

const StoreManager = dynamic(() => import("./StoreManager.tsx").then((m) => m.StoreManager), {
  ssr: false,
  loading: () => <div className="flex min-h-[50vh] items-center justify-center font-body text-muted">Loading Store Manager…</div>,
});

export function StoreRoute() {
  return <StoreManager />;
}
