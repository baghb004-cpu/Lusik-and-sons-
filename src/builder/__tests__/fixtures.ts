// Shared test fixtures: a small but representative page document.

import type { Block } from "../schema/block.ts";
import type { Page, OverrideLayer } from "../schema/documents.ts";
import { textDoc } from "../schema/richtext.ts";
import { CURRENT_SCHEMA_VERSION } from "../schema/migrate.ts";

export const heroText: Block = {
  id: "b_hero00000001",
  type: "richText",
  props: { doc: textDoc("Hand cross-stitched in Buena Park.") },
};

export const heroImage: Block = {
  id: "b_img000000001",
  type: "image",
  props: { src: "/img/hero/blanket.jpg", alt: "Armenian alphabet blanket" },
};

export const lockedCard: Block = {
  id: "b_card00000001",
  type: "card",
  props: { title: "Our Story", href: "/story", ctaLabel: "Read" },
  locks: { delete: true, reason: "footer legal link" },
};

export const heroSection: Block = {
  id: "b_sect00000001",
  type: "section",
  props: { heading: "Welcome", container: true },
  children: [heroText, heroImage],
};

export function makePage(overrides: Partial<Page> = {}): Page {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: "b_page00000001",
    slug: "welcome",
    kind: "landing",
    title: "Welcome",
    order: 0,
    seo: {},
    status: "draft",
    sections: [structuredClone(heroSection), structuredClone(lockedCard)],
    ...overrides,
  };
}

export function makeMobileLayer(overrides: Partial<OverrideLayer> = {}): OverrideLayer {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    pageId: "b_page00000001",
    breakpoint: "mobile",
    patches: {
      b_hero00000001: { style: { textAlign: "center" } },
    },
    mobileOnlyBlocks: [],
    ...overrides,
  };
}
