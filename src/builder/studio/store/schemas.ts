// ============================================================
// Creation Studio — Store Manager data model (§30, Phase 4)
// ============================================================
// A small store's customers, products/inventory, and orders. Local
// + offline; zod-validated. IMPORTANT: payment is a LABEL only — no
// card numbers, CVV, PIN, or stripe/chip data are ever stored here.
// ============================================================

import { z } from "zod";

const id = () => z.string().min(1);
const money = () => z.number().int().min(0); // cents

export const customerSchema = z.object({
  id: id(),
  firstName: z.string().default(""),
  lastName: z.string().default(""),
  phone: z.string().default(""),
  email: z.string().default(""),
  address: z.string().default(""),
  birthday: z.string().default(""),
  notes: z.string().default(""),
  preferences: z.string().default(""),
  favoriteProducts: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  consentToContact: z.boolean().default(false),
  createdAt: z.string().default(""),
  lastVisit: z.string().default(""),
});
export type Customer = z.infer<typeof customerSchema>;

export const productSchema = z.object({
  id: id(),
  name: z.string().default(""),
  sku: z.string().default(""),
  barcode: z.string().default(""),
  category: z.string().default(""),
  vendor: z.string().default(""),
  costCents: money().default(0),
  priceCents: money().default(0),
  stock: z.number().int().default(0),
  reorderThreshold: z.number().int().min(0).default(0),
  supplier: z.string().default(""),
  variant: z.string().default(""),
  notes: z.string().default(""),
  createdAt: z.string().default(""),
  updatedAt: z.string().default(""),
});
export type Product = z.infer<typeof productSchema>;

export const orderItemSchema = z.object({
  productId: z.string().default(""),
  name: z.string().default(""),
  qty: z.number().int().min(1).default(1),
  unitPriceCents: money().default(0),
});
export type OrderItem = z.infer<typeof orderItemSchema>;

export const ORDER_SOURCES = ["in-store", "online", "manual", "imported"] as const;
export const orderSchema = z.object({
  id: id(),
  customerId: z.string().default(""),
  date: z.string().default(""),
  items: z.array(orderItemSchema).default([]),
  discountCents: money().default(0),
  taxCents: money().default(0),
  // a human LABEL only ("Cash", "Card via Square") — never card data.
  paymentMethodLabel: z.string().default(""),
  notes: z.string().default(""),
  receiptNumber: z.string().default(""),
  source: z.enum(ORDER_SOURCES).default("in-store"),
});
export type Order = z.infer<typeof orderSchema>;

export const inventoryMovementSchema = z.object({
  id: id(),
  productId: z.string().default(""),
  delta: z.number().int().default(0),
  reason: z.string().default(""),
  at: z.string().default(""),
});
export type InventoryMovement = z.infer<typeof inventoryMovementSchema>;

export const RETENTIONS = ["1y", "3y", "5y", "forever"] as const;
export const storeSettingsSchema = z.object({
  storeName: z.string().default("My Store"),
  retention: z.enum(RETENTIONS).default("5y"),
  lastBackup: z.string().default(""),
  pinLock: z.string().default(""), // optional 4-8 digit PIN; "" = off
});
export type StoreSettings = z.infer<typeof storeSettingsSchema>;

export const storeSchema = z.object({
  schemaVersion: z.number().int().min(1).default(1),
  settings: storeSettingsSchema.default({ storeName: "My Store", retention: "5y", lastBackup: "", pinLock: "" }),
  customers: z.array(customerSchema).default([]),
  products: z.array(productSchema).default([]),
  orders: z.array(orderSchema).default([]),
  movements: z.array(inventoryMovementSchema).default([]),
});
export type Store = z.infer<typeof storeSchema>;

export function emptyStore(): Store {
  return storeSchema.parse({});
}
