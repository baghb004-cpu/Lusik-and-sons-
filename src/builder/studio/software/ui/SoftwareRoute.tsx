"use client";

import dynamic from "next/dynamic";

const SoftwareCreation = dynamic(() => import("./SoftwareCreation.tsx").then((m) => m.SoftwareCreation), {
  ssr: false,
  loading: () => <div className="flex min-h-[50vh] items-center justify-center font-body text-muted">Loading Software Creation…</div>,
});

export function SoftwareRoute() {
  return <SoftwareCreation />;
}
