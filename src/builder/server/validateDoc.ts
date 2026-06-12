// ============================================================
// The save gate — every document write is validated here first
// ============================================================
// Routes a document to its family's validator by path:
//
//   builder/pages/**      → validatePage (engine publish gate)
//   builder/templates/**  → templateSchema
//   builder/overrides/**  → overrideLayerSchema
//   builder/theme.json    → themeSchema
//   content/products/**   → the REAL build gate: validateProduct
//                           exported by scripts/gen-products.mjs —
//                           including the trusted-products price
//                           reconciliation. The builder cannot save
//                           what the build would reject, and a live
//                           product cannot drift from Stripe's price,
//                           because it is the SAME function.
//   content/categories/** → validateCategory (same script reuse)
//   content/pages/<x>.json→ PAGE_VALIDATORS[x] (same script reuse)
//
// Returns issues; empty array = safe to write.
// ============================================================

import { validatePage, validateCommerceRefs } from "../engine/index.ts";
import {
  templateSchema,
  overrideLayerSchema,
  themeSchema,
  migrateDocument,
} from "../schema/index.ts";
import { shippingConfigSchema, zipDatasetSchema } from "../data/index.ts";
import { aiSettingsSchema } from "../ai/models.ts";
import { appProjectSchema } from "../app/questionnaire.ts";
// The build-time validators themselves (main() is guarded, so these
// imports never trigger regeneration). Plain .mjs — typed as any.
import { validateProduct } from "../../../scripts/gen-products.mjs";
import { validateCategory } from "../../../scripts/gen-categories.mjs";
import { PAGE_VALIDATORS } from "../../../scripts/gen-pages.mjs";

export interface DocIssue {
  level: "error" | "warning";
  code: string;
  message: string;
  path?: string;
}

type ZodLike = {
  safeParse: (v: unknown) => { success: boolean; error?: { issues: Array<{ message: string; path: Array<string | number | symbol> }> } };
};

function zodIssues(schema: ZodLike, content: unknown): DocIssue[] {
  try {
    const parsed = schema.safeParse(migrateDocument(content));
    if (parsed.success) return [];
    return parsed.error!.issues.map((zi) => ({
      level: "error" as const,
      code: "schema",
      message: zi.message,
      path: zi.path.map(String).join("."),
    }));
  } catch (err) {
    return [{ level: "error", code: "schema_version", message: err instanceof Error ? err.message : String(err) }];
  }
}

/** Wrap a throwing generator validator into the issues shape. */
async function generatorIssues(fn: (file: string, data: unknown) => unknown, path: string, content: unknown): Promise<DocIssue[]> {
  try {
    await fn(path, content); // gen-pages' "home" validator is async
    return [];
  } catch (err) {
    return [{ level: "error", code: "build_gate", message: err instanceof Error ? err.message : String(err) }];
  }
}

export async function validateDocument(path: string, content: unknown): Promise<DocIssue[]> {
  // Builder documents
  if (path.startsWith("builder/pages/")) {
    const result = validatePage(content);
    if (!result.publishable || !result.page) {
      return result.issues.filter((i) => i.level === "error");
    }
    // Commerce bindings resolve against the REAL generated catalog —
    // a page can't be saved pointing at a product that doesn't exist,
    // and a buyBox can't point at anything that isn't live.
    const { CATALOG } = await import("../../data/catalog.js");
    const snapshot = Object.fromEntries(
      Object.entries(CATALOG as Record<string, { products: unknown[] }>).map(([cat, c]) => [cat, c.products])
    ) as Parameters<typeof validateCommerceRefs>[1];
    return validateCommerceRefs(result.page.sections, snapshot).filter((i) => i.level === "error");
  }
  if (path.startsWith("builder/templates/")) return zodIssues(templateSchema, content);
  if (path.startsWith("builder/overrides/")) return zodIssues(overrideLayerSchema, content);
  if (path === "builder/theme.json") return zodIssues(themeSchema, content);
  // Phase 13: shipping config + local datasets (manifest with source +
  // licenseNotes REQUIRED — un-attributed data can't be saved).
  if (path === "builder/data/shipping.json") return zodIssues(shippingConfigSchema as ZodLike, content);
  if (path.startsWith("builder/data/datasets/")) return zodIssues(zipDatasetSchema as ZodLike, content);
  if (path === "builder/data/ai.json") return zodIssues(aiSettingsSchema as ZodLike, content);
  if (path.startsWith("builder/apps/")) return zodIssues(appProjectSchema as ZodLike, content);
  if (path.startsWith("builder/")) return []; // future builder families: structural JSON only for now

  // Lusik content collections — gated by the build's own validators.
  if (path.startsWith("content/products/")) {
    return generatorIssues(validateProduct as (f: string, d: unknown) => unknown, path, content);
  }
  if (path.startsWith("content/categories/")) {
    return generatorIssues(validateCategory as (f: string, d: unknown) => unknown, path, content);
  }
  if (path.startsWith("content/pages/")) {
    const name = path.replace(/^content\/pages\//, "").replace(/\.json$/, "");
    const validator = (PAGE_VALIDATORS as Record<string, (f: string, d: unknown) => unknown>)[name];
    if (!validator) {
      return [{
        level: "error",
        code: "unknown_page",
        message: `No validator for content/pages/${name}.json — new page surfaces must be added to scripts/gen-pages.mjs first`,
      }];
    }
    return generatorIssues(validator, path, content);
  }

  return [{ level: "error", code: "unknown_family", message: `No document family owns ${path}` }];
}
