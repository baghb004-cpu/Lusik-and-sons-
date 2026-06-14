// ============================================================
// Local lookup + shipping rule engine (plan §14 / Phase 13)
// ============================================================
// Pure functions, fully offline. The §14 law is encoded in the
// evaluation order and the fail-soft rule: AN UNKNOWN ZIP NEVER
// BLOCKS — it degrades to a clearly-flagged unconfirmed quote
// instead of a silent wrong answer or a dead checkout.
//
// Evaluation order:
//   1. shape check            → invalid
//   2. blocked list           → blocked (explicit, owner-chosen)
//   3. local-delivery list    → localDelivery rate
//   4. free-shipping threshold→ free
//   5. zone prefix match      → zone rate (longest prefix wins)
//   6. default rate           → flat … or "contact us" when null
// Place lookup runs alongside (autofill + confidence); a dataset
// miss adds a warning, never a refusal.
// ============================================================

import { ZIP_RE, type ShippingConfig, type ZipDataset, type ZipPlace } from "./schema.ts";

export function normalizeZip(input: string): string | null {
  const digits = input.trim().slice(0, 10).replace(/[^0-9]/g, "");
  const five = digits.slice(0, 5);
  return ZIP_RE.test(five) ? five : null;
}

export function lookupZip(dataset: ZipDataset | null, zip: string): ZipPlace | null {
  if (!dataset) return null;
  return dataset.entries.find((e) => e.zip === zip) ?? null;
}

export interface ShippingQuote {
  kind: "invalid" | "blocked" | "local-delivery" | "free" | "zone" | "flat" | "contact";
  rateCents: number | null;
  zoneId?: string;
  place?: { city: string; state: string; alternates: string[] };
  /** False when the dataset couldn't confirm the ZIP — show, don't block. */
  placeConfirmed: boolean;
  warnings: string[];
  leadTimeNote?: string;
}

export function evaluateShipping(
  config: ShippingConfig,
  dataset: ZipDataset | null,
  rawZip: string,
  orderCents: number
): ShippingQuote {
  const warnings: string[] = [];
  const zip = normalizeZip(rawZip);
  if (!zip) {
    return { kind: "invalid", rateCents: null, placeConfirmed: false, warnings: ["ZIP must be 5 digits"] };
  }

  const place = lookupZip(dataset, zip);
  const placeConfirmed = place !== null;
  if (dataset && !place) {
    warnings.push(`ZIP ${zip} isn't in the local dataset (${dataset.manifest.coverage}) — quote shown unconfirmed`);
  }
  const base = {
    place: place ? { city: place.city, state: place.state, alternates: place.alternates } : undefined,
    placeConfirmed,
    warnings,
    leadTimeNote: config.leadTimeNote || undefined,
  };

  if (config.blockedZips.includes(zip)) {
    return { ...base, kind: "blocked", rateCents: null };
  }
  if (config.localDelivery?.zips.includes(zip)) {
    return { ...base, kind: "local-delivery", rateCents: config.localDelivery.rateCents };
  }
  if (config.freeShippingOverCents !== null && orderCents >= config.freeShippingOverCents) {
    return { ...base, kind: "free", rateCents: 0 };
  }

  // Longest matching prefix across all zones wins.
  let best: { zoneId: string; rateCents: number; length: number } | null = null;
  for (const zone of config.zones) {
    for (const prefix of zone.prefixes) {
      if (zip.startsWith(prefix) && (!best || prefix.length > best.length)) {
        best = { zoneId: zone.id, rateCents: zone.rateCents, length: prefix.length };
      }
    }
  }
  if (best) return { ...base, kind: "zone", rateCents: best.rateCents, zoneId: best.zoneId };

  if (config.defaultRateCents !== null) {
    return { ...base, kind: "flat", rateCents: config.defaultRateCents };
  }
  return { ...base, kind: "contact", rateCents: null, warnings: [...warnings, "No rate rule matched — the site will say “write to us for a quote”"] };
}

// ── CSV import (user-licensed data) ─────────────────────────
export interface CsvImportReport {
  entries: ZipPlace[];
  skipped: Array<{ line: number; reason: string }>;
}

/**
 * Parse "zip,city,state[,alternates…]" CSV (header optional). Strict on
 * shape, forgiving on noise: bad rows are reported with line numbers,
 * never silently dropped. Duplicate ZIPs merge — later cities become
 * alternates of the first.
 */
export function parseZipCsv(text: string): CsvImportReport {
  const entries = new Map<string, ZipPlace>();
  const skipped: CsvImportReport["skipped"] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed === "") return;
    const cols = trimmed.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    if (i === 0 && /zip/i.test(cols[0])) return; // header
    const [zipRaw, city, stateRaw, ...alts] = cols;
    const zip = normalizeZip(zipRaw ?? "");
    const state = (stateRaw ?? "").toUpperCase();
    if (!zip) return skipped.push({ line: i + 1, reason: `bad ZIP "${zipRaw ?? ""}"` });
    if (!city) return skipped.push({ line: i + 1, reason: "missing city" });
    if (!/^[A-Z]{2}$/.test(state)) return skipped.push({ line: i + 1, reason: `bad state "${stateRaw ?? ""}"` });
    const existing = entries.get(zip);
    if (existing) {
      if (city !== existing.city && !existing.alternates.includes(city)) existing.alternates.push(city);
    } else {
      entries.set(zip, { zip, city, state, alternates: alts.filter(Boolean) });
    }
  });
  return { entries: [...entries.values()].sort((a, b) => a.zip.localeCompare(b.zip)), skipped };
}

/** Trim a dataset for per-site export: keep only selected states and/or ZIP prefixes. */
export function trimEntries(
  entries: ZipPlace[],
  filter: { states?: string[]; prefixes?: string[] }
): ZipPlace[] {
  const states = filter.states?.map((s) => s.toUpperCase());
  return entries.filter((e) => {
    if (states && states.length > 0 && !states.includes(e.state)) return false;
    if (filter.prefixes && filter.prefixes.length > 0 && !filter.prefixes.some((p) => e.zip.startsWith(p))) return false;
    return true;
  });
}
