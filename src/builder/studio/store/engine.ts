// ============================================================
// Store Manager — pure engine (§30, Phase 4)
// ============================================================
// Search, barcode lookup, low-stock, order recording (with stock
// movement), customer purchase history, retention filtering, and
// anonymize/delete. All pure: takes a Store, returns data or a new
// Store. No network, no mutation of inputs.
// ============================================================

import type { Store, Customer, Product, Order, OrderItem } from "./schemas.ts";

const norm = (s: string) => s.toLowerCase().trim();

/** Customers matching a free query over name / phone / email / id. */
export function searchCustomers(store: Store, query: string): Customer[] {
  const q = norm(query);
  if (!q) return store.customers;
  return store.customers.filter((c) =>
    [c.firstName, c.lastName, `${c.firstName} ${c.lastName}`, c.phone, c.email, c.id].some((f) => norm(f).includes(q))
  );
}

/** Products matching a query over name / sku / barcode / category. */
export function searchProducts(store: Store, query: string): Product[] {
  const q = norm(query);
  if (!q) return store.products;
  return store.products.filter((p) => [p.name, p.sku, p.barcode, p.category, p.vendor].some((f) => norm(f).includes(q)));
}

export interface BarcodeHit {
  kind: "product" | "customer" | "none";
  product?: Product;
  customer?: Customer;
  code: string;
}

/** A scanned/typed barcode → the product (or customer id) it matches, or none
 *  (so the UI can offer to create one). Exact match on barcode/sku/id. */
export function lookupByBarcode(store: Store, code: string): BarcodeHit {
  const c = code.trim();
  if (!c) return { kind: "none", code: c };
  const product = store.products.find((p) => p.barcode === c || p.sku === c);
  if (product) return { kind: "product", product, code: c };
  const customer = store.customers.find((cu) => cu.id === c || cu.phone === c);
  if (customer) return { kind: "customer", customer, code: c };
  return { kind: "none", code: c };
}

/** Products at or below their reorder threshold (threshold > 0). */
export function lowStock(store: Store): Product[] {
  return store.products.filter((p) => p.reorderThreshold > 0 && p.stock <= p.reorderThreshold);
}

export function orderTotalCents(order: Pick<Order, "items" | "discountCents" | "taxCents">): number {
  const sub = order.items.reduce((s, it) => s + it.unitPriceCents * it.qty, 0);
  return Math.max(0, sub - order.discountCents + order.taxCents);
}

/** All orders for a customer, newest first. */
export function purchaseHistory(store: Store, customerId: string): Order[] {
  return store.orders.filter((o) => o.customerId === customerId).sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** Lifetime spend (cents) + order count for a customer. */
export function customerTotals(store: Store, customerId: string): { orders: number; spentCents: number } {
  const hist = purchaseHistory(store, customerId);
  return { orders: hist.length, spentCents: hist.reduce((s, o) => s + orderTotalCents(o), 0) };
}

/** Record an order: append it, decrement product stock, log movements, and
 *  stamp the customer's lastVisit. Returns a NEW store (input untouched). */
export function recordOrder(store: Store, order: Order, now: string): Store {
  const products = store.products.map((p) => {
    const sold = order.items.filter((it) => it.productId === p.id).reduce((s, it) => s + it.qty, 0);
    return sold > 0 ? { ...p, stock: p.stock - sold, updatedAt: now } : p;
  });
  const movements = [
    ...store.movements,
    ...order.items
      .filter((it) => it.productId)
      .map((it, i) => ({ id: `mv-${now}-${i}`, productId: it.productId, delta: -it.qty, reason: `order ${order.id}`, at: now })),
  ];
  const customers = store.customers.map((c) => (c.id === order.customerId ? { ...c, lastVisit: now } : c));
  return { ...store, products, movements, customers, orders: [order, ...store.orders] };
}

/** Adjust a product's stock by delta with a logged movement. */
export function adjustStock(store: Store, productId: string, delta: number, reason: string, now: string): Store {
  const products = store.products.map((p) => (p.id === productId ? { ...p, stock: p.stock + delta, updatedAt: now } : p));
  const movements = [...store.movements, { id: `mv-${now}`, productId, delta, reason, at: now }];
  return { ...store, products, movements };
}

const YEARS: Record<string, number> = { "1y": 1, "3y": 3, "5y": 5 };

/** Records older than the retention window (orders + their movements). Used by a
 *  "clean up old data" action; "forever" keeps everything. Returns a new store. */
export function applyRetention(store: Store, nowIso = new Date().toISOString()): Store {
  const years = YEARS[store.settings.retention];
  if (!years) return store;
  const cutoff = new Date(nowIso);
  cutoff.setFullYear(cutoff.getFullYear() - years);
  const cut = cutoff.toISOString();
  return { ...store, orders: store.orders.filter((o) => o.date >= cut), movements: store.movements.filter((m) => m.at >= cut) };
}

/** Replace a customer's personal fields with anonymous placeholders, keeping
 *  their order history intact for accounting (right-to-erasure friendly). */
export function anonymizeCustomer(store: Store, customerId: string): Store {
  return {
    ...store,
    customers: store.customers.map((c) =>
      c.id === customerId
        ? { ...c, firstName: "Removed", lastName: "", phone: "", email: "", address: "", birthday: "", notes: "", preferences: "", favoriteProducts: [], tags: [], consentToContact: false }
        : c
    ),
  };
}

/** Fully delete a customer (and detach their orders to "guest"). */
export function deleteCustomer(store: Store, customerId: string): Store {
  return {
    ...store,
    customers: store.customers.filter((c) => c.id !== customerId),
    orders: store.orders.map((o) => (o.customerId === customerId ? { ...o, customerId: "" } : o)),
  };
}
