"use client";

// Client boundary for the payroll calculator. The calculator runs the
// pure engine entirely in the browser — no network, nothing saved to a
// server — so it's loaded ssr:false and stays off any public first-load.

import dynamic from "next/dynamic";

const PayrollCalculator = dynamic(() => import("./PayrollCalculator.tsx").then((m) => m.PayrollCalculator), {
  ssr: false,
  loading: () => <div className="flex min-h-[50vh] items-center justify-center font-body text-muted">Loading the calculator…</div>,
});

export function PayrollRoute() {
  return <PayrollCalculator />;
}
