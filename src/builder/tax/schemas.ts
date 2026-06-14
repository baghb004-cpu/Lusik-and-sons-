// ============================================================
// Tax Assistant — data model (pure, plan §25)
// ============================================================
// Shapes for a private, offline, LEGAL self-filing helper. Two
// principles encoded in the types themselves:
//   1. Every derived value carries a CONFIDENCE level, so the UI
//      can never make a guess look like a fact.
//   2. Every authoritative tax FIGURE carries an official source
//      + a `verified` flag — unverified figures are not trusted
//      by the engine (it returns "needs-review", never a number).
// Nothing here asserts a tax amount; amounts live in rule packs
// the user verifies against official IRS/state documents.
// ============================================================

import { z } from "zod";

// ── confidence (shown on every conclusion) ──────────────────
export const CONFIDENCE = [
  "confirmed-document", // read from an uploaded form AND confirmed by the user
  "confirmed-manual", // typed and confirmed by the user
  "calculated", // arithmetic from confirmed values
  "needs-review", // present but unverified / unusual
  "not-enough-info", // can't conclude yet
] as const;
export const confidence = z.enum(CONFIDENCE);
export type Confidence = (typeof CONFIDENCE)[number];

export const filingStatus = z.enum([
  "single",
  "married-jointly",
  "married-separately",
  "head-of-household",
  "qualifying-surviving-spouse",
]);
export type FilingStatus = z.infer<typeof filingStatus>;

// Document kinds the organizer understands (the common personal set).
export const DOC_KINDS = [
  "W-2", "1099-NEC", "1099-MISC", "1099-K", "1099-INT", "1099-DIV",
  "1099-R", "1099-G", "1098", "1098-T", "1098-E", "1095-A", "1095-B", "1095-C",
  "SSA-1099", "donation-record", "medical-receipt", "property-tax", "other",
] as const;
export const docKind = z.enum(DOC_KINDS);
export type DocKind = (typeof DOC_KINDS)[number];

// A single field read from (or typed into) a document. OCR fills `value`
// but `confidence` starts at needs-review until the user confirms — the
// app NEVER auto-trusts OCR.
export const docField = z
  .object({
    label: z.string().min(1).max(80),
    value: z.string().max(200),
    box: z.string().max(20).optional(), // e.g. "Box 1"
    confidence: confidence,
  })
  .strict();

export const taxDocument = z
  .object({
    id: z.string().min(1).max(64),
    kind: docKind,
    label: z.string().max(120).optional(),
    source: z.enum(["imported-ocr", "manual"]),
    fields: z.array(docField).max(60),
    /** Relative path under portable/tax/documents — never uploaded. */
    filePath: z.string().max(300).optional(),
    addedAt: z.number().int(),
  })
  .strict();
export type TaxDocument = z.infer<typeof taxDocument>;

const money = z.object({ amountCents: z.number().int(), confidence }).strict();

export const taxProject = z
  .object({
    schemaVersion: z.number().int().min(1).default(1),
    taxYear: z.number().int().min(2000).max(2100),
    rulePackVersion: z.string().max(40).optional(),
    filingStatus: filingStatus.optional(),
    taxpayerName: z.string().max(120).optional(),
    dependents: z.number().int().min(0).max(20).default(0),
    documents: z.array(taxDocument).max(200).default([]),
    /** Guided-interview answers, free-form by question id. */
    answers: z.record(z.string(), z.union([z.string(), z.boolean(), z.number()])).default({}),
    /** Income/deduction/credit line items the user confirmed. */
    income: z.array(z.object({ label: z.string().max(80), ...money.shape }).strict()).default([]),
    deductions: z.array(z.object({ label: z.string().max(80), itemized: z.boolean(), ...money.shape }).strict()).default([]),
    credits: z.array(z.object({ label: z.string().max(80), ...money.shape }).strict()).default([]),
    /** Explicit "I confirm this is accurate and good-faith" stamps. */
    confirmations: z.array(z.object({ what: z.string().max(120), at: z.number().int() }).strict()).default([]),
    updatedAt: z.number().int().optional(),
  })
  .strict();
export type TaxProject = z.infer<typeof taxProject>;

// ── rule packs (the only place tax FIGURES live) ────────────
export const ruleFigure = z
  .object({
    key: z.string().min(1).max(80),
    value: z.number().nullable(), // null = not filled in yet
    unit: z.enum(["usd", "percent", "count"]),
    source: z.string().url(), // official IRS/state URL — REQUIRED
    verified: z.boolean(), // the user checked it against the source
    note: z.string().max(300).optional(),
  })
  .strict();
export type RuleFigure = z.infer<typeof ruleFigure>;

export const rulePack = z
  .object({
    schemaVersion: z.number().int().min(1).default(1),
    taxYear: z.number().int().min(2000).max(2100),
    jurisdiction: z.string().regex(/^[a-z]+-[a-z]+$/), // e.g. "us-federal", "us-ca"
    status: z.enum(["template", "user-verified"]),
    /** Where to get/update this pack — opened by the one-click updater. */
    officialSource: z.string().url(),
    figures: z.array(ruleFigure).max(200),
    updatedAt: z.number().int().optional(),
  })
  .strict();
export type RulePack = z.infer<typeof rulePack>;
