"use client";

import dynamic from "next/dynamic";

const Immersive = dynamic(() => import("./Immersive.tsx").then((m) => m.Immersive), {
  ssr: false,
  loading: () => <div className="flex min-h-[50vh] items-center justify-center font-body text-muted">Loading the Immersive Builder…</div>,
});

export function ImmersiveRoute() {
  return <Immersive />;
}
