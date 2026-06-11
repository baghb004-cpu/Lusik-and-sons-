"use client";

// The /builder route's client boundary. The actual editor is
// dynamically imported with ssr:false so its chunk loads only
// when an admin opens /builder — never as part of any public
// route's first-load JS (enforced by the bundle-budget sentinel
// check, scripts/check-bundle-budget.mjs).

import dynamic from "next/dynamic";

const BuilderShell = dynamic(
  () => import("./BuilderShell.tsx").then((m) => m.BuilderShell),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[50vh] items-center justify-center font-body text-muted">
        Loading the builder…
      </div>
    ),
  }
);

export function BuilderRoute() {
  return <BuilderShell />;
}
