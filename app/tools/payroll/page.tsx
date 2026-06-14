// /tools/payroll — the offline payroll / self-employment tax calculator.
// Server shell only; the calculator is a client bundle loaded dynamically
// so it costs the public site nothing. Noindexed — it's a personal tool.

import type { Metadata } from "next";
import { PayrollRoute } from "../../../src/builder/payroll/ui/PayrollRoute.tsx";

export const metadata: Metadata = {
  title: "Set-Aside Calculator",
  robots: { index: false, follow: false },
};

export default function PayrollPage() {
  return <PayrollRoute />;
}
