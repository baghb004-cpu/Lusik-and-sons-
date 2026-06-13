"use client";

import dynamic from "next/dynamic";

const BusinessAppBuilder = dynamic(() => import("./BusinessAppBuilder.tsx").then((m) => m.BusinessAppBuilder), {
  ssr: false,
  loading: () => <div className="flex min-h-[50vh] items-center justify-center font-body text-muted">Loading the Business App Builder…</div>,
});

export function BusinessAppRoute() {
  return <BusinessAppBuilder />;
}
