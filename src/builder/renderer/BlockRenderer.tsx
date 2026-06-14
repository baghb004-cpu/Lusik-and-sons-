// ============================================================
// Renderer — the dispatcher
// ============================================================
// Takes resolved blocks (the caller runs the override cascade
// for the target device first — engine/overrides.ts) and renders
// them through BLOCK_COMPONENTS, applying per-block style and
// per-device visibility classes. Unknown block types render a
// clearly-marked placeholder in the editor and NOTHING on a
// published page — a document from a newer builder never leaks
// raw data into the storefront.
// ============================================================

import type { ReactNode } from "react";
import type { Block, GlassPreset } from "../schema/index.ts";
import { BLOCK_COMPONENTS, type RenderContext } from "./blocks.tsx";
import { cx, resolveStyle, visibilityClasses } from "./style.ts";

export interface BlockRendererProps {
  blocks: Block[];
  cms?: RenderContext["cms"];
  /** Theme glass presets for glass-styled blocks (pillNav). */
  glass?: GlassPreset[];
  /** Catalog snapshot for commerce blocks (prices resolve here, never from props). */
  catalog?: RenderContext["catalog"];
  /** Per-product availability for inventoryBadge. */
  inventory?: RenderContext["inventory"];
  /** Offline i18n context for the language switcher / gate. */
  i18n?: RenderContext["i18n"];
  /** Candlelight config (theme.appearance) for the appearance switcher. */
  candle?: RenderContext["candle"];
  /** Editor preview mode: show placeholders for unknown types + block ids. */
  editing?: boolean;
  /** Emit data-block-id without editor behavior — the static exporter's
   *  hook for override @media CSS targets. */
  withIds?: boolean;
}

export function BlockRenderer({ blocks, cms, glass, catalog, inventory, i18n, candle, editing = false, withIds = false }: BlockRendererProps) {
  const ctx: RenderContext = {
    cms,
    glass,
    catalog,
    inventory,
    i18n,
    candle,
    editing,
    renderChildren: (children) => (
      <BlockRenderer blocks={children} cms={cms} glass={glass} catalog={catalog} inventory={inventory} i18n={i18n} candle={candle} editing={editing} withIds={withIds} />
    ),
  };

  return <>{blocks.map((block) => renderOne(block, ctx, editing, withIds))}</>;
}

function renderOne(block: Block, ctx: RenderContext, editing: boolean, withIds = false): ReactNode {
  const component = BLOCK_COMPONENTS[block.type];

  let content: ReactNode;
  if (component) {
    content = component(block, ctx);
  } else if (editing) {
    content = (
      <div className="rounded-lg border border-dashed border-accent/60 bg-accent/5 p-3 text-sm text-muted">
        Unknown block type “{block.type}” — made with a newer builder?
      </div>
    );
  } else {
    return null;
  }
  if (content === null || content === undefined) return null;

  const style = resolveStyle(block.style);
  const visibility = visibilityClasses(block.visibility);
  const tagId = editing || withIds;

  return (
    <div key={block.id} className={cx(visibility) || undefined} style={Object.keys(style).length ? style : undefined} {...(tagId ? { "data-block-id": block.id } : {})}>
      {content}
    </div>
  );
}
