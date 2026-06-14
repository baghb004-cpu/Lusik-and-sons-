"use client";

import dynamic from "next/dynamic";

const SensorsBuilder = dynamic(() => import("./SensorsBuilder.tsx").then((m) => m.SensorsBuilder), {
  ssr: false,
  loading: () => <div className="flex min-h-[50vh] items-center justify-center font-body text-muted">Loading the Sensor Builder…</div>,
});

export function SensorsRoute() {
  return <SensorsBuilder />;
}
