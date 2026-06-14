// ============================================================
// Store Manager — exports + backup (pure)
// ============================================================
// CSV reports (Excel-openable) and a validated JSON backup/restore of
// the whole store. No network; the UI turns these strings into file
// downloads. XLSX/PDF/DOCX are documented future upgrades.
// ============================================================

import { storeSchema, type Store, type Order } from "./schemas.ts";
import { orderTotalCents, purchaseHistory, customerTotals } from "./engine.ts";

const dollars = (cents: number) => (cents / 100).toFixed(2);

/** RFC-4180-ish CSV: quote fields containing comma/quote/newline. */
export function toCsv(headers: string[], rows: Array<Array<string | number>>): string {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n") + "\n";
}

export function customersCsv(store: Store): string {
  return toCsv(
    ["Customer ID", "First", "Last", "Phone", "Email", "Tags", "Consent", "Created", "Last visit", "Orders", "Spent"],
    store.customers.map((c) => {
      const t = customerTotals(store, c.id);
      return [c.id, c.firstName, c.lastName, c.phone, c.email, c.tags.join("|"), c.consentToContact ? "yes" : "no", c.createdAt, c.lastVisit, t.orders, dollars(t.spentCents)];
    })
  );
}

export function productsCsv(store: Store): string {
  return toCsv(
    ["Product ID", "Name", "SKU", "Barcode", "Category", "Vendor", "Cost", "Price", "Stock", "Reorder at"],
    store.products.map((p) => [p.id, p.name, p.sku, p.barcode, p.category, p.vendor, dollars(p.costCents), dollars(p.priceCents), p.stock, p.reorderThreshold])
  );
}

export function ordersCsv(store: Store): string {
  return toCsv(
    ["Order ID", "Date", "Customer ID", "Items", "Discount", "Tax", "Total", "Payment (label)", "Source", "Receipt"],
    store.orders.map((o) => [o.id, o.date, o.customerId, o.items.reduce((s, it) => s + it.qty, 0), dollars(o.discountCents), dollars(o.taxCents), dollars(orderTotalCents(o)), o.paymentMethodLabel, o.source, o.receiptNumber])
  );
}

export function lowStockCsv(store: Store, low: Store["products"]): string {
  return toCsv(["Product ID", "Name", "SKU", "Stock", "Reorder at", "Vendor", "Supplier"], low.map((p) => [p.id, p.name, p.sku, p.stock, p.reorderThreshold, p.vendor, p.supplier]));
}

export function purchaseHistoryCsv(store: Store, customerId: string): string {
  return toCsv(
    ["Order ID", "Date", "Items", "Total", "Payment (label)", "Source"],
    purchaseHistory(store, customerId).map((o: Order) => [o.id, o.date, o.items.map((it) => `${it.qty}× ${it.name}`).join("; "), dollars(orderTotalCents(o)), o.paymentMethodLabel, o.source])
  );
}

const APP_TAG = "lusik-store-manager";
export const STORE_BACKUP_VERSION = 1;

/** A tagged, versioned JSON snapshot of the whole store. */
export function serializeStore(store: Store): string {
  return JSON.stringify({ app: APP_TAG, version: STORE_BACKUP_VERSION, store }, null, 2);
}

/** Parse + validate a backup. Throws a friendly error on bad/foreign input. */
export function parseStoreBackup(json: string): Store {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  const obj = raw as { app?: string; version?: number; store?: unknown };
  if (obj.app !== APP_TAG) throw new Error("That doesn't look like a Store Manager backup.");
  if (typeof obj.version === "number" && obj.version > STORE_BACKUP_VERSION) throw new Error("This backup is from a newer version. Update first, then restore.");
  return storeSchema.parse(obj.store);
}
