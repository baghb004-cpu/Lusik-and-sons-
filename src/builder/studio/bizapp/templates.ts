// ============================================================
// Business App Builder — app templates (pure data)
// ============================================================
import { appBlueprintSchema, type AppBlueprint, type Field } from "./schemas.ts";
import { deriveScreens } from "./engine.ts";

const f = (name: string, type: Field["type"] = "text", over: Partial<Field> = {}): Field => ({ name, label: name, type, required: false, options: [], relationTableId: "", ...over });

interface Spec { key: string; name: string; description: string; tables: { id: string; name: string; fields: Field[] }[] }

const SPECS: Spec[] = [
  {
    key: "appointments", name: "Appointment Tracker", description: "Book and track appointments.",
    tables: [{ id: "appointments", name: "Appointments", fields: [f("customerName"), f("phone"), f("service"), f("date", "date"), f("time", "time"), f("status", "select", { options: ["Booked", "Confirmed", "Done", "No-show", "Cancelled"] }), f("notes", "longtext")] }],
  },
  {
    key: "repair", name: "Repair Shop Tracker", description: "Intake and track repair tickets.",
    tables: [{ id: "tickets", name: "Tickets", fields: [f("customer"), f("phone"), f("device"), f("issue", "longtext"), f("status", "select", { options: ["Received", "Diagnosing", "Waiting parts", "Ready", "Picked up"] }), f("estimate", "money"), f("dateIn", "date"), f("dateOut", "date"), f("notes", "longtext")] }],
  },
  {
    key: "quotes", name: "Service Quote Generator", description: "Create and track service quotes.",
    tables: [{ id: "quotes", name: "Quotes", fields: [f("customer"), f("phone"), f("service"), f("lineItems", "longtext"), f("subtotal", "money"), f("tax", "money"), f("total", "money"), f("status", "select", { options: ["Draft", "Sent", "Accepted", "Declined"] }), f("date", "date"), f("notes", "longtext")] }],
  },
  {
    key: "crm", name: "Simple CRM", description: "Track contacts and follow-ups.",
    tables: [{ id: "contacts", name: "Contacts", fields: [f("name"), f("phone"), f("email"), f("company"), f("tags"), f("lastContact", "date"), f("notes", "longtext")] }],
  },
  {
    key: "orders", name: "Order Tracker", description: "Track orders through fulfillment.",
    tables: [{ id: "orders", name: "Orders", fields: [f("customer"), f("items", "longtext"), f("total", "money"), f("status", "select", { options: ["New", "In progress", "Ready", "Delivered"] }), f("date", "date"), f("notes", "longtext")] }],
  },
  {
    key: "inventory", name: "Inventory (lite)", description: "Track products and stock.",
    tables: [{ id: "products", name: "Products", fields: [f("name"), f("sku"), f("barcode"), f("price", "money"), f("stock", "number"), f("reorderAt", "number"), f("notes", "longtext")] }],
  },
];

export function makeAppTemplate(key: string, id = `app-${Date.now()}`): AppBlueprint | null {
  const spec = SPECS.find((s) => s.key === key);
  if (!spec) return null;
  const tables = spec.tables.map((t) => ({ ...t, fields: t.fields.map((x) => ({ ...x })) }));
  return appBlueprintSchema.parse({ id, name: spec.name, description: spec.description, tables, screens: deriveScreens(tables) });
}

export const APP_TEMPLATE_LIST = SPECS.map((s) => ({ key: s.key, name: s.name, description: s.description }));
