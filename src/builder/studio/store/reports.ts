// ============================================================
// Store Manager — report set + print-to-PDF (pure, §30 Phase 5)
// ============================================================
// Builds the standard business reports as { title, headers, rows } so
// the UI can render them to CSV, XLSX, or a print-friendly HTML page
// (the browser's "Save as PDF"). Pure + tested.
// ============================================================

import type { Store } from "./schemas.ts";
import { customerTotals, orderTotalCents, lowStock } from "./engine.ts";

const dollars = (c: number) => (c / 100).toFixed(2);
const xesc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export interface Report {
  title: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}

function salesSummary(store: Store): Report {
  const revenue = store.orders.reduce((s, o) => s + orderTotalCents(o), 0);
  const bySource = new Map<string, number>();
  const byPayment = new Map<string, number>();
  for (const o of store.orders) {
    bySource.set(o.source, (bySource.get(o.source) ?? 0) + orderTotalCents(o));
    const pay = o.paymentMethodLabel || "—";
    byPayment.set(pay, (byPayment.get(pay) ?? 0) + orderTotalCents(o));
  }
  const rows: Array<Array<string | number>> = [
    ["Total orders", store.orders.length],
    ["Total sales ($)", dollars(revenue)],
    ["Average order ($)", dollars(store.orders.length ? Math.round(revenue / store.orders.length) : 0)],
    ["—", "—"],
    ...[...bySource].map(([k, v]) => [`Source: ${k}`, dollars(v)] as Array<string | number>),
    ...[...byPayment].map(([k, v]) => [`Payment: ${k}`, dollars(v)] as Array<string | number>),
  ];
  return { title: "Sales summary", headers: ["Metric", "Value"], rows };
}

export const STORE_REPORTS: Array<{ id: string; name: string; build: (s: Store) => Report }> = [
  {
    id: "customers", name: "Customer list", build: (store) => ({
      title: "Customer list", headers: ["Customer ID", "First", "Last", "Phone", "Email", "Consent", "Orders", "Spent"],
      rows: store.customers.map((c) => { const t = customerTotals(store, c.id); return [c.id, c.firstName, c.lastName, c.phone, c.email, c.consentToContact ? "yes" : "no", t.orders, dollars(t.spentCents)]; }),
    }),
  },
  {
    id: "customer-activity", name: "Customer activity", build: (store) => ({
      title: "Customer activity", headers: ["Customer", "Orders", "Spent", "Last visit"],
      rows: store.customers.map((c) => { const t = customerTotals(store, c.id); return [`${c.firstName} ${c.lastName}`.trim() || c.id, t.orders, dollars(t.spentCents), (c.lastVisit || "").slice(0, 10)]; }),
    }),
  },
  {
    id: "inventory", name: "Product inventory", build: (store) => ({
      title: "Product inventory", headers: ["Product", "SKU", "Barcode", "Category", "Price", "Stock", "Reorder at"],
      rows: store.products.map((p) => [p.name, p.sku, p.barcode, p.category, dollars(p.priceCents), p.stock, p.reorderThreshold]),
    }),
  },
  {
    id: "low-stock", name: "Low stock", build: (store) => ({
      title: "Low stock", headers: ["Product", "SKU", "Stock", "Reorder at", "Vendor"],
      rows: lowStock(store).map((p) => [p.name, p.sku, p.stock, p.reorderThreshold, p.vendor]),
    }),
  },
  {
    id: "orders", name: "Purchase history (all)", build: (store) => ({
      title: "Purchase history", headers: ["Order ID", "Date", "Customer ID", "Items", "Total", "Payment (label)", "Source"],
      rows: store.orders.map((o) => [o.id, o.date.slice(0, 10), o.customerId, o.items.reduce((s, it) => s + it.qty, 0), dollars(orderTotalCents(o)), o.paymentMethodLabel, o.source]),
    }),
  },
  { id: "sales", name: "Sales summary", build: salesSummary },
];

/** A print-friendly HTML page (the browser's Save-as-PDF). */
export function reportHtml(report: Report, storeName: string): string {
  const head = `<tr>${report.headers.map((h) => `<th>${xesc(h)}</th>`).join("")}</tr>`;
  const body = report.rows.map((r) => `<tr>${r.map((c) => `<td>${xesc(String(c))}</td>`).join("")}</tr>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${xesc(report.title)} — ${xesc(storeName)}</title>
<style>
  body { font-family: system-ui, sans-serif; color: #1a1612; margin: 24px; }
  h1 { font-size: 18px; margin: 0; } .meta { color: #666; font-size: 12px; margin: 2px 0 16px; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
  th { background: #f3efe6; }
  .note { color: #888; font-size: 10px; margin-top: 14px; }
  @media print { .noprint { display: none; } body { margin: 0; } }
</style></head><body>
  <h1>${xesc(report.title)}</h1>
  <p class="meta">${xesc(storeName)} · ${new Date().toLocaleDateString()} · ${report.rows.length} rows</p>
  <button class="noprint" onclick="window.print()" style="margin-bottom:12px;padding:8px 16px;border:0;border-radius:8px;background:#1a1612;color:#fff;cursor:pointer">Print / Save as PDF</button>
  <table><thead>${head}</thead><tbody>${body}</tbody></table>
  <p class="note">Contains business${report.title.toLowerCase().includes("customer") ? " and customer" : ""} data — store and share it carefully. No payment card data is included.</p>
</body></html>`;
}
