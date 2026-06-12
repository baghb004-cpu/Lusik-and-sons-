// ============================================================
// "+ Add block" defaults (Phase 10)
// ============================================================
// One schema-valid starter per insertable type. Commerce defaults
// bind to the first LIVE product in the caller's catalog snapshot,
// so a freshly added block previews real data instead of an error.
// Pure module — unit-tested against blockSchema so a default can
// never drift out of validity.
// ============================================================

import { newId, type Block } from "../schema/index.ts";
import { textDoc } from "../schema/richtext.ts";
import type { CatalogSnapshot } from "../engine/commerce.ts";

export const INSERTABLE_TYPES = [
  "section",
  "richText",
  "image",
  "card",
  "button",
  "spacer",
  "accordion",
  "tabs",
  "breadcrumbs",
  "drawer",
  "gallery",
  "searchLauncher",
  "productCard",
  "productGrid",
  "featuredProduct",
  "relatedProducts",
  "swatchRow",
  "inventoryBadge",
  "buyBox",
] as const;

export type InsertableType = (typeof INSERTABLE_TYPES)[number];

/** First live product as "category/slug", else any product, else null. */
export function defaultProductRef(catalog: CatalogSnapshot): string | null {
  let fallback: string | null = null;
  for (const [category, products] of Object.entries(catalog)) {
    for (const p of products) {
      const ref = `${category}/${p.slug}`;
      if (p.status === "live") return ref;
      fallback ??= ref;
    }
  }
  return fallback;
}

export function newDefaultBlock(type: InsertableType, catalog: CatalogSnapshot): Block {
  const id = newId();
  const ref = defaultProductRef(catalog) ?? "shop/example";
  const category = ref.split("/")[0];

  switch (type) {
    case "section":
      return { id, type, props: { heading: "New section", container: true }, children: [] };
    case "richText":
      return { id, type, props: { doc: textDoc("New text — click to edit.") } };
    case "image":
      return { id, type, props: { src: "/img/armenian-flag.jpg", alt: "Describe this image" } };
    case "card":
      return { id, type, props: { title: "New card", body: textDoc("Card body.") } };
    case "button":
      return { id, type, props: { label: "Button", href: "/", variant: "primary" } };
    case "spacer":
      return { id, type, props: { size: "spacing.lg" } };
    case "accordion":
      return { id, type, props: { items: [{ id: newId(), title: "Question", body: textDoc("Answer.") }] } };
    case "tabs":
      return {
        id,
        type,
        props: {
          items: [
            { id: newId(), label: "One", body: textDoc("First panel.") },
            { id: newId(), label: "Two", body: textDoc("Second panel.") },
          ],
        },
      };
    case "breadcrumbs":
      return { id, type, props: { items: [{ label: "Home", href: "/" }, { label: "This page" }] } };
    case "drawer":
      return { id, type, props: { side: "bottom", triggerLabel: "More details" }, children: [] };
    case "gallery":
      return { id, type, props: { product: ref, layout: "grid", columns: 3 } };
    case "searchLauncher":
      return { id, type, props: { label: "Search", href: "/shop", style: "pill" } };
    case "productCard":
      return { id, type, props: { product: ref, showTagline: true } };
    case "productGrid":
      return { id, type, props: { category, columns: 3 } };
    case "featuredProduct":
      return { id, type, props: { binding: "cms:featured" } };
    case "relatedProducts":
      return { id, type, props: { product: ref, limit: 3 } };
    case "swatchRow":
      return {
        id,
        type,
        props: {
          layout: "horizontal",
          swatches: [
            { id: newId(), color: "#B08842", name: "Gold" },
            { id: newId(), color: "#1A1612", name: "Ink" },
            { id: newId(), color: "#F5EFE3", name: "Cream" },
          ],
        },
      };
    case "inventoryBadge":
      return { id, type, props: { product: ref } };
    case "buyBox":
      return { id, type, props: { product: ref } };
  }
}
