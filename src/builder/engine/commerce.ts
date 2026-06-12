// ============================================================
// Builder engine — commerce binding resolution + publish rules
// ============================================================
// Pure functions over a CATALOG SNAPSHOT passed in by the caller
// (the save gate passes the real generated catalog; the editor
// passes its loaded copy) — the engine stays import-free of site
// data. Rules:
//
//   - every product reference must resolve (unknown = error)
//   - buyBox may only point at a LIVE product — the builder can
//     place the door to checkout, but not for something that
//     isn't actually buyable
//   - non-live references elsewhere (cards/grids) are warnings:
//     legitimate for coming-soon content, worth flagging
// ============================================================

import type { Block } from "../schema/block.ts";
import type { ValidationIssue } from "./validate.ts";

export interface CatalogProductSnapshot {
  slug: string;
  name: string;
  status: string;
  priceFrom: number | null;
  tagline?: string;
  coverImage?: string;
  images?: string[];
  colorways?: Array<{ label: string; swatch?: Record<string, unknown> }>;
}

/** Record<categorySlug, products>. Built from CATALOG[cat].products. */
export type CatalogSnapshot = Record<string, CatalogProductSnapshot[]>;

export function resolveProductRef(catalog: CatalogSnapshot, ref: string): CatalogProductSnapshot | null {
  const [category, slug] = ref.split("/");
  return catalog[category]?.find((p) => p.slug === slug) ?? null;
}

const REF_PROPS: Record<string, Array<"product" | "binding" | "category">> = {
  productCard: ["product"],
  buyBox: ["product"],
  inventoryBadge: ["product"],
  relatedProducts: ["product"],
  swatchRow: ["product"],
  gallery: ["product"],
  featuredProduct: ["binding"],
  productGrid: ["category"],
};

export function validateCommerceRefs(blocks: Block[], catalog: CatalogSnapshot): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const walk = (list: Block[]) => {
    for (const b of list) {
      const propNames = REF_PROPS[b.type];
      if (propNames) {
        for (const name of propNames) {
          const value = (b.props as Record<string, unknown>)[name];
          if (typeof value !== "string") continue; // optional binding absent
          if (name === "category") {
            if (!catalog[value]) {
              issues.push({ level: "error", code: "unknown_category", message: `productGrid: category "${value}" doesn't exist`, blockId: b.id });
            }
            continue;
          }
          if (value === "cms:featured") continue; // build-validated by gen-pages
          const product = resolveProductRef(catalog, value);
          if (!product) {
            issues.push({ level: "error", code: "unknown_product", message: `"${value}" doesn't exist in the catalog (or is an unpublished draft)`, blockId: b.id });
            continue;
          }
          if (b.type === "buyBox" && product.status !== "live") {
            issues.push({
              level: "error",
              code: "buybox_not_live",
              message: `buyBox points at "${product.name}" (${product.status}) — only live products are buyable`,
              blockId: b.id,
            });
          } else if (product.status !== "live") {
            issues.push({
              level: "warning",
              code: "product_not_live",
              message: `"${product.name}" is ${product.status} — it will render as coming-soon`,
              blockId: b.id,
            });
          }
        }
      }
      if (b.children) walk(b.children);
    }
  };
  walk(blocks);
  return issues;
}
