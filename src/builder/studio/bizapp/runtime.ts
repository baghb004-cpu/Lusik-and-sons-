// ============================================================
// Business App — generic runtime record store (pure, §30)
// ============================================================
// Runs ANY AppBlueprint: a typed record store per table with add/edit/
// delete/search, a display label, and CSV export. The same pattern the
// Store Manager uses by hand, generalized so generated apps actually
// run. Local-only; pure functions over an AppData object.
// ============================================================

import type { AppBlueprint, Table } from "./schemas.ts";
import { toCsv } from "../store/io.ts";

export type Rec = Record<string, unknown> & { id: string; createdAt: string };
export type AppData = Record<string, Rec[]>; // tableId → records

export function emptyData(bp: AppBlueprint): AppData {
  const d: AppData = {};
  for (const t of bp.tables) d[t.id] = [];
  return d;
}

const newId = () => `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export function addRecord(data: AppData, tableId: string, fields: Record<string, unknown>): AppData {
  const rec: Rec = { ...fields, id: newId(), createdAt: new Date().toISOString() };
  return { ...data, [tableId]: [rec, ...(data[tableId] ?? [])] };
}
export function updateRecord(data: AppData, tableId: string, id: string, patch: Record<string, unknown>): AppData {
  return { ...data, [tableId]: (data[tableId] ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r)) };
}
export function deleteRecord(data: AppData, tableId: string, id: string): AppData {
  return { ...data, [tableId]: (data[tableId] ?? []).filter((r) => r.id !== id) };
}

/** Records whose text fields contain the query (empty query = all). */
export function searchRecords(data: AppData, table: Table, query: string): Rec[] {
  const recs = data[table.id] ?? [];
  const q = query.toLowerCase().trim();
  if (!q) return recs;
  const text = table.fields.filter((f) => f.type !== "bool").map((f) => f.name);
  return recs.filter((r) => text.some((k) => String(r[k] ?? "").toLowerCase().includes(q)));
}

/** A human label for a record (first text-ish field, else the id). */
export function recordLabel(rec: Rec, table: Table): string {
  const f = table.fields.find((x) => x.type === "text" || x.type === "longtext");
  const v = f ? String(rec[f.name] ?? "").trim() : "";
  return v || rec.id;
}

/** CSV of a table's records (header = field labels). */
export function tableCsv(table: Table, recs: Rec[]): string {
  const headers = table.fields.map((f) => f.label || f.name);
  const rows = recs.map((r) => table.fields.map((f) => formatValue(r[f.name], f.type)));
  return toCsv(headers, rows);
}

function formatValue(v: unknown, type: string): string | number {
  if (v == null) return "";
  if (type === "money" && typeof v === "number") return (v / 100).toFixed(2);
  if (type === "bool") return v ? "yes" : "no";
  if (typeof v === "number") return v;
  return String(v);
}

const APP_TAG = "lusik-bizapp-data";
export const DATA_VERSION = 1;

/** Tagged JSON snapshot of an app's data (for backup/move-to-another-device). */
export function serializeData(appId: string, data: AppData): string {
  return JSON.stringify({ app: APP_TAG, version: DATA_VERSION, appId, data }, null, 2);
}
export function parseDataBackup(json: string): { appId: string; data: AppData } {
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { throw new Error("That file isn't valid JSON."); }
  const o = raw as { app?: string; version?: number; appId?: string; data?: AppData };
  if (o.app !== APP_TAG) throw new Error("That isn't a business-app data backup.");
  if (typeof o.version === "number" && o.version > DATA_VERSION) throw new Error("Backup is from a newer version.");
  return { appId: o.appId ?? "", data: o.data ?? {} };
}
