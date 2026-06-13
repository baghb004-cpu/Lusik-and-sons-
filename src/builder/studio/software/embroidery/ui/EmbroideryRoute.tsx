"use client";

import dynamic from "next/dynamic";

const EmbroideryStudio = dynamic(() => import("./EmbroideryStudio.tsx").then((m) => m.EmbroideryStudio), {
  ssr: false,
  loading: () => <div className="flex min-h-[50vh] items-center justify-center font-body text-muted">Loading Embroidery Studio…</div>,
});

export function EmbroideryRoute() {
  return <EmbroideryStudio />;
}
