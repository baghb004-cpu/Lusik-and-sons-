"use client";

// ============================================================
// Block inspector (Phase 7) — the mobile editing layer's UI
// ============================================================
// Left: the page's block tree. Right of that: per-device
// controls for the selected block. Desktop edits touch the BASE
// document; tablet/mobile edits write SPARSE PATCHES into the
// page's override layers — desktop never reads those, so mobile
// polish structurally can't damage desktop (plan §4/§6). Every
// patched block shows a badge; "Reset to desktop" deletes the
// patch and the base shines through again.
// ============================================================

import type { Block, Breakpoint, GlassPreset, OverrideLayer, StyleProps } from "../schema/index.ts";
import { newId } from "../schema/index.ts";
import type { CatalogSnapshot } from "../engine/commerce.ts";
import type { LocaleCode } from "../i18n/locales.ts";
import { PillNavEditor, type PillNavProps } from "./PillNavEditor.tsx";
import { BlockPropsForm } from "./BlockPropsForm.tsx";
import { hasGeneratedForm } from "./introspect.ts";
import {
  setOverridePatch,
  clearOverridePatch,
  addMobileOnlyBlock,
  removeMobileOnlyBlock,
  type Device,
} from "../engine/index.ts";
import { textDoc } from "../schema/richtext.ts";

const inputClass =
  "w-full rounded-lg border border-ink/15 bg-white/80 px-2 py-1.5 text-xs focus:border-accent focus:outline-none";

export interface InspectorProps {
  blocks: Block[];
  layers: Record<Breakpoint, OverrideLayer>;
  device: Device;
  selectedId: string | null;
  glass: GlassPreset[];
  /** Catalog + locales feed the generated per-block form (plan §21). */
  catalog: CatalogSnapshot;
  locales: LocaleCode[];
  defaultLocale: LocaleCode;
  onSelect: (id: string | null) => void;
  onLayerChange: (bp: Breakpoint, next: OverrideLayer) => void;
  /** Base-document edits (desktop visibility). */
  onBlockVisibility: (id: string, device: Device, visible: boolean) => void;
  /** Base-document prop edits (dedicated block editors, e.g. pillNav). */
  onBlockProps: (id: string, props: Record<string, unknown>) => void;
  /** Drag-reorder: place dragged block after the drop target. */
  onMove: (dragId: string, afterId: string) => void;
}

function blockLabel(b: Block): string {
  const p = b.props as Record<string, unknown>;
  const text =
    (typeof p.heading === "string" && p.heading) ||
    (typeof p.title === "string" && p.title) ||
    (typeof p.label === "string" && p.label) ||
    "";
  return text ? `${b.type} · ${text.slice(0, 24)}` : b.type;
}

export function Inspector({
  blocks,
  layers,
  device,
  selectedId,
  glass,
  catalog,
  locales,
  defaultLocale,
  onSelect,
  onLayerChange,
  onBlockVisibility,
  onBlockProps,
  onMove,
}: InspectorProps) {
  const selected = selectedId ? findIn(blocks, selectedId) : null;
  return (
    <div className="space-y-3">
      <BlockTree blocks={blocks} layers={layers} selectedId={selectedId} onSelect={onSelect} onMove={onMove} depth={0} />
      {selected && selected.type === "pillNav" && device === "desktop" ? (
        <PillNavEditor
          value={selected.props as unknown as PillNavProps}
          glass={glass}
          onChange={(next) => onBlockProps(selected.id, next as unknown as Record<string, unknown>)}
        />
      ) : selectedId ? (
        <>
          {selected && device === "desktop" && hasGeneratedForm(selected) ? (
            selected.locks?.edit ? (
              <p className="rounded-xl border border-ink/10 bg-cream/60 p-3 text-xs text-muted">
                🔒 {selected.locks.reason || "This block's content is locked."}
              </p>
            ) : (
              <BlockPropsForm
                key={selected.id}
                block={selected}
                catalog={catalog}
                locales={locales}
                defaultLocale={defaultLocale}
                onChange={(props) => onBlockProps(selected.id, props)}
              />
            )
          ) : null}
          <BlockControls
          blocks={blocks}
          layers={layers}
          device={device}
          blockId={selectedId}
          onLayerChange={onLayerChange}
          onBlockVisibility={onBlockVisibility}
        />
        </>
      ) : (
        <p className="text-xs text-muted">Select a block to edit its visibility and spacing per device.</p>
      )}
    </div>
  );
}

const DRAG_MIME = "application/x-builder-block";

function BlockTree({
  blocks,
  layers,
  selectedId,
  onSelect,
  onMove,
  depth,
}: {
  blocks: Block[];
  layers: Record<Breakpoint, OverrideLayer>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (dragId: string, afterId: string) => void;
  depth: number;
}) {
  return (
    <ul className={depth === 0 ? "space-y-0.5 rounded-xl border border-ink/10 p-2" : "ml-3 space-y-0.5 border-l border-ink/10 pl-2"}>
      {blocks.map((b) => {
        const patchCount =
          (layers.tablet.patches[b.id] ? 1 : 0) + (layers.mobile.patches[b.id] ? 1 : 0);
        const isMobileOnly = layers.mobile.mobileOnlyBlocks.some((m) => m.block.id === b.id);
        const draggable = !b.locks?.move;
        return (
          <li key={b.id}>
            <button
              type="button"
              onClick={() => onSelect(b.id)}
              draggable={draggable}
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_MIME, b.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes(DRAG_MIME)) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }
              }}
              onDrop={(e) => {
                const dragId = e.dataTransfer.getData(DRAG_MIME);
                if (dragId && dragId !== b.id) {
                  e.preventDefault();
                  onMove(dragId, b.id);
                }
              }}
              title={draggable ? "Drag onto another block to place after it" : b.locks?.reason || "Locked"}
              className={
                selectedId === b.id
                  ? "flex w-full items-center justify-between gap-1 rounded bg-cream px-2 py-1 text-left text-xs font-medium"
                  : "flex w-full items-center justify-between gap-1 rounded px-2 py-1 text-left text-xs hover:bg-cream/60"
              }
            >
              <span className="flex min-w-0 items-center gap-1">
                {draggable ? <span className="cursor-grab text-muted/70" aria-hidden="true">⠿</span> : null}
                <span className="truncate">{blockLabel(b)}</span>
              </span>
              <span className="flex shrink-0 gap-1">
                {isMobileOnly ? <Badge title="Exists only on mobile">📱</Badge> : null}
                {patchCount > 0 ? <Badge title={`${patchCount} device override(s)`}>{patchCount}</Badge> : null}
                {b.locks ? <Badge title={b.locks.reason || "Locked"}>🔒</Badge> : null}
                {b.visibility && Object.values(b.visibility).some((v) => v === false) ? (
                  <Badge title="Hidden on some devices">◐</Badge>
                ) : null}
              </span>
            </button>
            {b.children?.length ? (
              <BlockTree blocks={b.children} layers={layers} selectedId={selectedId} onSelect={onSelect} onMove={onMove} depth={depth + 1} />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function Badge({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <span title={title} className="rounded-full bg-accent/15 px-1.5 text-[10px] leading-4 text-ink">
      {children}
    </span>
  );
}

// ── per-block, per-device controls ──────────────────────────
function findIn(blocks: Block[], id: string): Block | null {
  for (const b of blocks) {
    if (b.id === id) return b;
    if (b.children) {
      const hit = findIn(b.children, id);
      if (hit) return hit;
    }
  }
  return null;
}

function BlockControls({
  blocks,
  layers,
  device,
  blockId,
  onLayerChange,
  onBlockVisibility,
}: {
  blocks: Block[];
  layers: Record<Breakpoint, OverrideLayer>;
  device: Device;
  blockId: string;
  onLayerChange: (bp: Breakpoint, next: OverrideLayer) => void;
  onBlockVisibility: (id: string, device: Device, visible: boolean) => void;
}) {
  const block = findIn(blocks, blockId);
  const mobileOnly = layers.mobile.mobileOnlyBlocks.find((m) => m.block.id === blockId);
  if (!block && !mobileOnly) return <p className="text-xs text-muted">Block no longer exists.</p>;

  if (device === "desktop") {
    const hidden = block?.visibility?.desktop === false;
    return (
      <div className="space-y-2 rounded-xl border border-ink/10 p-3">
        <h4 className="text-xs font-medium uppercase tracking-wide text-muted">Desktop (base)</h4>
        {block ? (
          <>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={hidden} onChange={(e) => onBlockVisibility(blockId, "desktop", !e.target.checked)} className="h-3.5 w-3.5 accent-ink" />
              Hide on desktop
            </label>
            <p className="text-xs text-muted">
              Structure, content and base styling edit through the document itself. Switch the device toggle to tablet or mobile to add per-device polish — those edits live in a separate layer and can never change desktop.
            </p>
          </>
        ) : (
          <p className="text-xs text-muted">This block exists only on mobile.</p>
        )}
      </div>
    );
  }

  // tablet / mobile: edit the PATCH layer
  const bp: Breakpoint = device;
  const layer = layers[bp];

  if (mobileOnly && bp === "mobile") {
    return (
      <div className="space-y-2 rounded-xl border border-accent/30 bg-accent/5 p-3">
        <h4 className="text-xs font-medium uppercase tracking-wide text-muted">Mobile-only block</h4>
        <p className="text-xs text-muted">Inserted {mobileOnly.position} “{mobileOnly.anchorBlockId}”. Desktop and tablet never render it.</p>
        <button
          type="button"
          onClick={() => onLayerChange("mobile", removeMobileOnlyBlock(layer, blockId))}
          className="rounded-full border border-red-300 px-3 py-1 text-xs text-red-700 hover:bg-red-50"
        >
          Remove mobile-only block
        </button>
      </div>
    );
  }

  const patch = layer.patches[blockId] ?? {};
  const style: Partial<StyleProps> = patch.style ?? {};
  const setStyle = (next: Partial<StyleProps>) => onLayerChange(bp, setOverridePatch(layer, blockId, { style: next as StyleProps }));
  const side = (box: "margin" | "padding", edge: "top" | "bottom") => (style[box] as Record<string, string> | undefined)?.[edge] ?? "";
  const setSide = (box: "margin" | "padding", edge: "top" | "bottom", v: string) =>
    setStyle({ [box]: { ...(style[box] as object | undefined), [edge]: v || undefined } } as Partial<StyleProps>);

  return (
    <div className="space-y-3 rounded-xl border border-ink/10 p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium uppercase tracking-wide text-muted">{bp} overrides</h4>
        {layer.patches[blockId] ? (
          <button
            type="button"
            onClick={() => onLayerChange(bp, clearOverridePatch(layer, blockId))}
            className="rounded-full border border-ink/20 px-2.5 py-0.5 text-[11px] hover:bg-cream"
          >
            Reset to desktop
          </button>
        ) : null}
      </div>

      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={patch.visibility === false}
          onChange={(e) => onLayerChange(bp, setOverridePatch(layer, blockId, { visibility: e.target.checked ? false : undefined }))}
          className="h-3.5 w-3.5 accent-ink"
        />
        Hide on {bp}
      </label>

      <div className="grid grid-cols-2 gap-2">
        {(["margin", "padding"] as const).map((box) => (
          <div key={box}>
            <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted">{box}</span>
            {(["top", "bottom"] as const).map((edge) => (
              <input
                key={edge}
                type="text"
                value={side(box, edge)}
                onChange={(e) => setSide(box, edge, e.target.value)}
                placeholder={`${edge} — e.g. spacing.sm or 12px`}
                className={`${inputClass} mb-1 font-mono`}
                aria-label={`${bp} ${box} ${edge}`}
              />
            ))}
          </div>
        ))}
      </div>

      <label className="block text-xs">
        <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted">Text align</span>
        <select
          value={style.textAlign ?? ""}
          onChange={(e) => setStyle({ textAlign: (e.target.value || undefined) as StyleProps["textAlign"] })}
          className={inputClass}
        >
          <option value="">inherit</option>
          <option value="left">left</option>
          <option value="center">center</option>
          <option value="right">right</option>
        </select>
      </label>

      <label className="block text-xs">
        <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted">Max width</span>
        <input
          type="text"
          value={style.maxWidth ?? ""}
          onChange={(e) => setStyle({ maxWidth: e.target.value || undefined })}
          placeholder="e.g. 28rem, full"
          className={`${inputClass} font-mono`}
        />
      </label>

      {bp === "mobile" ? (
        <button
          type="button"
          onClick={() =>
            onLayerChange(
              "mobile",
              addMobileOnlyBlock(layer, blockId, "after", {
                id: newId(),
                type: "richText",
                props: { doc: textDoc("Mobile-only note — edit me in the JSON view for now.") },
              })
            )
          }
          className="rounded-full border border-ink/20 px-3 py-1 text-xs hover:bg-cream"
        >
          + Mobile-only text after this block
        </button>
      ) : null}
    </div>
  );
}
