// ============================================================
// Builder engine — breakpoint override cascade
// ============================================================
// Resolves a page's blocks for a given device. The cascade is
// base → tablet → mobile: a phone gets tablet patches first,
// then mobile patches on top; desktop reads NO override layer.
// That asymmetry is the structural guarantee from plan §4/§6:
// mobile polish cannot damage desktop because desktop never
// looks at the patch layers.
//
// Patches reference blocks by id. A patch whose block no longer
// exists is STALE — reported, never applied, and cleaned up by
// pruneStaleOverrides so layers don't rot as the base evolves.
// ============================================================

import type { Block } from "../schema/block.ts";
import type { Breakpoint, BlockPatch, OverrideLayer } from "../schema/documents.ts";

export type Device = "desktop" | Breakpoint;

export interface StaleEntry {
  layerBreakpoint: Breakpoint;
  blockId: string;
  kind: "patch" | "mobileOnlyAnchor";
}

export interface ResolveResult {
  blocks: Block[];
  appliedPatches: number;
  stale: StaleEntry[];
}

/** Layers that apply to a device, in cascade order. */
function layersFor(device: Device, layers: OverrideLayer[]): OverrideLayer[] {
  if (device === "desktop") return [];
  const order: Breakpoint[] = device === "tablet" ? ["tablet"] : ["tablet", "mobile"];
  return order
    .map((bp) => layers.find((l) => l.breakpoint === bp))
    .filter((l): l is OverrideLayer => !!l);
}

function applyPatch(block: Block, patch: BlockPatch, device: Device): Block {
  const next: Block = { ...block };
  if (patch.props) next.props = { ...block.props, ...patch.props };
  if (patch.style) next.style = { ...block.style, ...patch.style };
  if (patch.visibility !== undefined) {
    next.visibility = { ...block.visibility, [device]: patch.visibility };
  }
  return next;
}

export function resolveBlocks(
  base: Block[],
  layers: OverrideLayer[],
  device: Device
): ResolveResult {
  const active = layersFor(device, layers);
  if (active.length === 0) {
    return { blocks: base, appliedPatches: 0, stale: [] };
  }

  let applied = 0;
  const stale: StaleEntry[] = [];

  // Track which ids exist so stale patches can be reported.
  const present = new Set<string>();
  const index = (list: Block[]) => {
    for (const b of list) {
      present.add(b.id);
      if (b.children) index(b.children);
    }
  };
  index(base);

  const patchTree = (list: Block[], layer: OverrideLayer): Block[] =>
    list.map((b) => {
      const patch = layer.patches[b.id];
      let next = b;
      if (patch) {
        next = applyPatch(b, patch, device);
        applied += 1;
      }
      if (next.children) next = { ...next, children: patchTree(next.children, layer) };
      return next;
    });

  let blocks = base;
  for (const layer of active) {
    for (const id of Object.keys(layer.patches)) {
      if (!present.has(id)) {
        stale.push({ layerBreakpoint: layer.breakpoint, blockId: id, kind: "patch" });
      }
    }
    blocks = patchTree(blocks, layer);

    // Device-only additions (e.g. a mobile-only section), anchored to a
    // base block. Anchors that vanished are stale, never guessed.
    for (const add of layer.mobileOnlyBlocks) {
      const inserted = insertAtAnchor(blocks, add.anchorBlockId, add.position, add.block);
      if (inserted) {
        blocks = inserted;
        present.add(add.block.id);
      } else {
        stale.push({
          layerBreakpoint: layer.breakpoint,
          blockId: add.anchorBlockId,
          kind: "mobileOnlyAnchor",
        });
      }
    }
  }
  return { blocks, appliedPatches: applied, stale };
}

function insertAtAnchor(
  blocks: Block[],
  anchorId: string,
  position: "before" | "after",
  block: Block
): Block[] | null {
  let done = false;
  const walk = (list: Block[]): Block[] => {
    const out: Block[] = [];
    for (const b of list) {
      if (b.id === anchorId && !done) {
        done = true;
        if (position === "before") out.push(block, b);
        else out.push(b, block);
        continue;
      }
      if (b.children) {
        const children = walk(b.children);
        out.push(children === b.children ? b : { ...b, children });
      } else {
        out.push(b);
      }
    }
    return out;
  };
  const result = walk(blocks);
  return done ? result : null;
}

/** All stale entries for a layer against the current base (editor warning surface). */
export function listStaleOverrides(base: Block[], layer: OverrideLayer): StaleEntry[] {
  const ids = new Set<string>();
  const index = (list: Block[]) => {
    for (const b of list) {
      ids.add(b.id);
      if (b.children) index(b.children);
    }
  };
  index(base);

  const stale: StaleEntry[] = [];
  for (const id of Object.keys(layer.patches)) {
    if (!ids.has(id)) stale.push({ layerBreakpoint: layer.breakpoint, blockId: id, kind: "patch" });
  }
  for (const add of layer.mobileOnlyBlocks) {
    if (!ids.has(add.anchorBlockId)) {
      stale.push({ layerBreakpoint: layer.breakpoint, blockId: add.anchorBlockId, kind: "mobileOnlyAnchor" });
    }
  }
  return stale;
}

/** Drop stale patches/additions (run after base edits; keeps layers from rotting). */
export function pruneStaleOverrides(base: Block[], layer: OverrideLayer): OverrideLayer {
  const stale = listStaleOverrides(base, layer);
  if (stale.length === 0) return layer;
  const stalePatchIds = new Set(stale.filter((s) => s.kind === "patch").map((s) => s.blockId));
  const staleAnchors = new Set(
    stale.filter((s) => s.kind === "mobileOnlyAnchor").map((s) => s.blockId)
  );
  return {
    ...layer,
    patches: Object.fromEntries(
      Object.entries(layer.patches).filter(([id]) => !stalePatchIds.has(id))
    ),
    mobileOnlyBlocks: layer.mobileOnlyBlocks.filter((a) => !staleAnchors.has(a.anchorBlockId)),
  };
}
