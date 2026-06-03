// ============================================================
// inventory — browser-side helpers for the handmade-stock cap
// ============================================================
// Mirrors netlify/functions/_lib/inventory.mjs's grouping so the UI
// reads availability the same way the server enforces it. The server
// is the authoritative overselling guard (in create-checkout-session);
// this is display + a friendly pre-checkout cap only.
// ============================================================

export type Availability = { remaining: number; limit: number; soldOut: boolean };
export type InventoryMap = Record<string, Availability>;

// A product and its "+ cap" variant share one stock pool — the group
// key strips the trailing "-with-cap". Keep in lockstep with the
// server's inventoryGroup().
export function inventoryGroup(productKey: string | null | undefined): string | null {
  if (!productKey || typeof productKey !== "string") return null;
  return productKey.replace(/-with-cap$/, "");
}

// remaining for a productKey given a fetched inventory map. Unknown /
// not-yet-loaded products return Infinity so the UI never blocks a
// purchase on a missing display read — the server still guards.
export function remainingForKey(inventory: InventoryMap | null | undefined, productKey: string | null | undefined): number {
  const group = inventoryGroup(productKey);
  if (!inventory || !group) return Infinity;
  const entry = inventory[group];
  return entry ? entry.remaining : Infinity;
}

export function isSoldOutKey(inventory: InventoryMap | null | undefined, productKey: string | null | undefined): boolean {
  const group = inventoryGroup(productKey);
  if (!inventory || !group) return false;
  return inventory[group]?.soldOut === true;
}

// The two original live products use a catalog key that differs from
// their server inventory group key; every other product's catalog key
// already equals its inventory key. Resolves a catalog product key to
// the inventory group its stock is tracked under.
const INVENTORY_KEY_BY_CATALOG: Record<string, string> = {
  "blanket-alphabet": "blanket-double_diag_br",
  "bib-single": "bib",
};

export function inventoryKeyForCatalog(catalogKey: string | null | undefined): string | null {
  if (!catalogKey) return null;
  return INVENTORY_KEY_BY_CATALOG[catalogKey] ?? catalogKey;
}
