// The export pipeline's ONLY JSX: render a page's blocks to static
// markup through the real renderer — the same components the editor
// preview and the live site use (plan §3: renderer-first, export-second).
// `withIds` keeps data-block-id attributes in the output so the
// override @media CSS (export/css.ts) has targets.

import { BlockRenderer } from "../renderer/index.ts";
import type { Block, GlassPreset } from "../schema/index.ts";
import type { CatalogSnapshot } from "../engine/commerce.ts";
import type { RenderContext } from "../renderer/blocks.tsx";

export interface RenderBodyInput {
  blocks: Block[];
  catalog?: CatalogSnapshot;
  glass?: GlassPreset[];
  cms?: { featured?: string };
  i18n?: RenderContext["i18n"];
}

export async function renderPageBody(input: RenderBodyInput): Promise<string> {
  // Dynamic import: Next refuses STATIC react-dom/server imports in the
  // app graph; the exporter legitimately renders to a string at request
  // time (admin-gated, fs mode), so we load it on demand.
  const { renderToStaticMarkup } = await import("react-dom/server");
  return renderToStaticMarkup(
    <BlockRenderer
      blocks={input.blocks}
      catalog={input.catalog}
      glass={input.glass}
      cms={input.cms}
      i18n={input.i18n}
      withIds
    />
  );
}
