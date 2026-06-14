"use client";

import dynamic from "next/dynamic";

const TourBuilder = dynamic(() => import("./TourBuilder.tsx").then((m) => m.TourBuilder), {
  ssr: false,
  loading: () => <div className="flex min-h-[50vh] items-center justify-center font-body text-muted">Loading the Virtual Tour Builder…</div>,
});

export function TourRoute() {
  return <TourBuilder />;
}
