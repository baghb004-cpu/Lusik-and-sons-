// ============================================================
// Builder schema — Page, Template, MobileOverride, Revision
// ============================================================
// These are the documents that live as JSON under builder/ in
// the repo (git-tracked in both storage modes, which is what
// makes drafts, revisions, and the thumb-drive story work).
// ============================================================

import { z } from "zod";
import { blockId, blockSchema, type Block } from "./block.ts";
import { styleProps } from "./style.ts";
import { imageSrc } from "./richtext.ts";
import { CURRENT_SCHEMA_VERSION } from "./migrate.ts";

// One URL segment; full paths come from nesting (parentId chain).
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const slug = z.string().regex(SLUG_RE);

const schemaVersion = z.number().int().min(1).default(CURRENT_SCHEMA_VERSION);

// ── Page ────────────────────────────────────────────────────
export const pageKind = z.enum(["landing", "standard", "product", "category", "journal", "policy"]);

export const pageSchema = z
  .object({
    schemaVersion,
    id: blockId,
    slug,
    parentId: blockId.optional(),
    kind: pageKind,
    title: z.string().min(1),
    order: z.number().int().min(0).default(0),
    // SEO FIELDS are editable; metadata STRUCTURE (how these become
    // <meta>/JSON-LD) is renderer-owned and locked — see plan §5.
    seo: z
      .object({
        title: z.string().max(70).optional(),
        description: z.string().max(170).optional(),
        ogImage: imageSrc.optional(),
      })
      .strict()
      .default({}),
    sections: z.array(blockSchema),
    status: z.enum(["draft", "published"]).default("draft"),
    publishedHash: z.string().optional(),
  })
  .strict();

export type Page = z.infer<typeof pageSchema>;

// ── Template ────────────────────────────────────────────────
export const templateKind = z.enum(["section", "page", "component", "nav", "pillNav"]);

export const templateSchema = z
  .object({
    schemaVersion,
    id: blockId,
    name: z.string().min(1).max(80),
    kind: templateKind,
    // Page templates store a full Page skeleton; everything else a Block.
    root: z.union([blockSchema, pageSchema]),
    thumbnail: imageSrc.optional(),
  })
  .strict()
  .superRefine((tpl, ctx) => {
    const rootIsPage = "sections" in (tpl.root as Record<string, unknown>);
    if (tpl.kind === "page" && !rootIsPage) {
      ctx.addIssue({ code: "custom", message: "page templates must store a Page root", path: ["root"] });
    }
    if (tpl.kind !== "page" && rootIsPage) {
      ctx.addIssue({ code: "custom", message: `${tpl.kind} templates must store a Block root`, path: ["root"] });
    }
  });

export type Template = z.infer<typeof templateSchema>;

// ── Site chrome (plan §22) — shared header + footer ─────────
// One document, builder/chrome.json, holds the blocks every page
// shares: exports and the editor preview render header blocks
// above the page and footer blocks below it, so a nav or a
// copyright line is edited ONCE, not per page.
export const chromeSchema = z
  .object({
    schemaVersion,
    header: z.array(blockSchema).default([]),
    footer: z.array(blockSchema).default([]),
  })
  .strict();

export type Chrome = z.infer<typeof chromeSchema>;

export const CHROME_PATH = "builder/chrome.json";

// ── Mobile/tablet override layer (plan §4/§6) ───────────────
// Sparse patches keyed by block id. Desktop never reads these,
// which is the structural guarantee that mobile polish cannot
// damage desktop layouts.
export const breakpoint = z.enum(["tablet", "mobile"]);
export type Breakpoint = z.infer<typeof breakpoint>;

const blockPatch = z
  .object({
    props: z.record(z.string(), z.unknown()).optional(),
    style: styleProps.optional(),
    visibility: z.boolean().optional(),
  })
  .strict();

export const overrideLayerSchema = z
  .object({
    schemaVersion,
    pageId: blockId,
    breakpoint,
    patches: z.record(z.string(), blockPatch).default({}),
    mobileOnlyBlocks: z
      .array(
        z
          .object({
            anchorBlockId: blockId,
            position: z.enum(["before", "after"]),
            block: blockSchema,
          })
          .strict()
      )
      .default([]),
  })
  .strict();

export type OverrideLayer = z.infer<typeof overrideLayerSchema>;
export type BlockPatch = z.infer<typeof blockPatch>;

// ── Revision (thin — git is the store, plan §4) ─────────────
export const revisionSchema = z
  .object({
    docPath: z.string().min(1),
    ts: z.string().datetime(),
    author: z.string().min(1),
    label: z.string().optional(),
    commitSha: z.string().optional(),
  })
  .strict();

export type Revision = z.infer<typeof revisionSchema>;

export type { Block };
