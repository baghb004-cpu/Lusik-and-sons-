"use client";

import dynamic from "next/dynamic";

const TaxAssistant = dynamic(() => import("./TaxAssistant.tsx").then((m) => m.TaxAssistant), {
  ssr: false,
  loading: () => <div className="flex min-h-[50vh] items-center justify-center font-body text-muted">Loading the Tax Assistant…</div>,
});

export function TaxRoute() {
  return <TaxAssistant />;
}
