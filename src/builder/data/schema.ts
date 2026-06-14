// ============================================================
// Datasets & shipping — schemas (plan §14 / Phase 13)
// ============================================================
// Two document families under builder/data/:
//
//   builder/data/datasets/<id>.json — a LOCAL dataset (ZIP→place
//     entries today) with the §14 manifest: source + licenseNotes
//     are REQUIRED — schema law, so un-attributed data can't even
//     be saved. Bundled data ships only when redistribution is
//     clearly allowed (the repo's zip dataset is BSD); everything
//     else arrives via user import.
//
//   builder/data/shipping.json — origin ZIP, local-delivery and
//     blocked lists, zones (separate from rates by structure:
//     zones are prefix groups, rates attach to rules/zones), the
//     free-shipping threshold, and the default rate.
//
// DISPLAY-ONLY for the Lusik site: what a customer is CHARGED
// remains server-computed in netlify/functions/_lib (the
// drift-test pattern). For exported sites this module is the
// local lookup engine the §14 spec describes.
// ============================================================

import { z } from "zod";

export const ZIP_RE = /^\d{5}$/;
const zip5 = z.string().regex(ZIP_RE);
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ── dataset manifest + entries ──────────────────────────────
export const datasetManifestSchema = z
  .object({
    id: z.string().regex(ID_RE),
    name: z.string().min(1).max(80),
    kind: z.literal("zip-places"),
    source: z.string().min(1), // where the data came from — required
    licenseNotes: z.string().min(1), // the legal basis for having it — required
    version: z.string().min(1),
    importedAt: z.string().min(1),
    updatedAt: z.string().min(1),
    coverage: z.string().min(1), // e.g. "CA only", "US incl. territories"
    limitations: z.string().default(""),
    rows: z.number().int().min(0),
    sha256: z.string().optional(),
  })
  .strict();

export const zipPlaceEntry = z
  .object({
    zip: zip5,
    city: z.string().min(1),
    state: z.string().regex(/^[A-Z]{2}$/),
    /** Other acceptable city names for multi-city ZIPs (primary first = `city`). */
    alternates: z.array(z.string().min(1)).default([]),
  })
  .strict();

export const zipDatasetSchema = z
  .object({
    schemaVersion: z.number().int().min(1).default(1),
    manifest: datasetManifestSchema,
    entries: z.array(zipPlaceEntry),
  })
  .strict()
  .superRefine((d, ctx) => {
    if (d.manifest.rows !== d.entries.length) {
      ctx.addIssue({ code: "custom", path: ["manifest", "rows"], message: `manifest.rows (${d.manifest.rows}) must equal entries.length (${d.entries.length})` });
    }
  });

export type ZipDataset = z.infer<typeof zipDatasetSchema>;
export type ZipPlace = z.infer<typeof zipPlaceEntry>;

// ── shipping configuration ──────────────────────────────────
export const shippingZoneSchema = z
  .object({
    id: z.string().regex(ID_RE),
    label: z.string().min(1).max(40),
    /** ZIP prefixes, 1–5 digits; longest match wins. */
    prefixes: z.array(z.string().regex(/^\d{1,5}$/)).min(1),
    rateCents: z.number().int().min(0),
  })
  .strict();

export const shippingConfigSchema = z
  .object({
    schemaVersion: z.number().int().min(1).default(1),
    originZip: zip5,
    /** null = no free-shipping rule. */
    freeShippingOverCents: z.number().int().min(0).nullable().default(null),
    localDelivery: z
      .object({
        zips: z.array(zip5).min(1),
        rateCents: z.number().int().min(0),
        label: z.string().default("Local delivery"),
      })
      .strict()
      .nullable()
      .default(null),
    blockedZips: z.array(zip5).default([]),
    zones: z.array(shippingZoneSchema).default([]),
    /** Fallback rate when no zone matches; null = "contact us". */
    defaultRateCents: z.number().int().min(0).nullable().default(null),
    /** Handmade lead-time display rule, shown with every quote. */
    leadTimeNote: z.string().default(""),
  })
  .strict()
  .superRefine((c, ctx) => {
    const ids = new Set<string>();
    for (const [i, zone] of c.zones.entries()) {
      if (ids.has(zone.id)) ctx.addIssue({ code: "custom", path: ["zones", i, "id"], message: `duplicate zone id "${zone.id}"` });
      ids.add(zone.id);
    }
  });

export type ShippingConfig = z.infer<typeof shippingConfigSchema>;
export type ShippingZone = z.infer<typeof shippingZoneSchema>;

export const SHIPPING_DOC_PATH = "builder/data/shipping.json";
export const DATASET_DIR = "builder/data/datasets";
