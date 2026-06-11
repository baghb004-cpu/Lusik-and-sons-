// ============================================================
// Builder engine — block tree operations
// ============================================================
// Pure, immutable functions over Block[] (a page's sections).
// Every editor mutation (and later, undo/redo via inverse
// commands) goes through these. They respect block locks and
// refuse structurally invalid moves; the editor surfaces the
// thrown EngineError's message.
// ============================================================

import { CONTAINER_TYPES, newId, type Block } from "../schema/block.ts";

export class EngineError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "EngineError";
    this.code = code;
  }
}

export interface BlockLocation {
  block: Block;
  /** null = top level of the page */
  parent: Block | null;
  index: number;
}

/** Depth-first search for a block id. */
export function findBlock(blocks: Block[], id: string): BlockLocation | null {
  const walk = (list: Block[], parent: Block | null): BlockLocation | null => {
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (b.id === id) return { block: b, parent, index: i };
      if (b.children) {
        const hit = walk(b.children, b);
        if (hit) return hit;
      }
    }
    return null;
  };
  return walk(blocks, null);
}

export function collectIds(blocks: Block[]): string[] {
  const ids: string[] = [];
  const walk = (list: Block[]) => {
    for (const b of list) {
      ids.push(b.id);
      if (b.children) walk(b.children);
    }
  };
  walk(blocks);
  return ids;
}

function isDescendant(ancestor: Block, id: string): boolean {
  return !!ancestor.children?.some((c) => c.id === id || isDescendant(c, id));
}

/** Immutably replace the children list at a given parent (null = root). */
function withChildren(blocks: Block[], parent: Block | null, next: Block[]): Block[] {
  if (parent === null) return next;
  const replace = (list: Block[]): Block[] =>
    list.map((b) => {
      if (b.id === parent.id) return { ...b, children: next };
      return b.children ? { ...b, children: replace(b.children) } : b;
    });
  return replace(blocks);
}

export function updateBlock(blocks: Block[], id: string, updater: (b: Block) => Block): Block[] {
  const loc = findBlock(blocks, id);
  if (!loc) throw new EngineError("not_found", `Block ${id} not found`);
  if (loc.block.locks?.edit) {
    throw new EngineError("locked", lockMessage(loc.block, "edited"));
  }
  const apply = (list: Block[]): Block[] =>
    list.map((b) => {
      if (b.id === id) {
        const next = updater(b);
        if (next.id !== b.id) throw new EngineError("id_change", "updater must not change block id");
        return next;
      }
      return b.children ? { ...b, children: apply(b.children) } : b;
    });
  return apply(blocks);
}

export interface InsertTarget {
  /** null = top level of the page */
  parentId: string | null;
  index: number;
}

export function insertBlock(blocks: Block[], block: Block, target: InsertTarget): Block[] {
  if (findBlock(blocks, block.id)) {
    throw new EngineError("duplicate_id", `Block id ${block.id} already exists on this page`);
  }
  let parent: Block | null = null;
  let siblings = blocks;
  if (target.parentId !== null) {
    const loc = findBlock(blocks, target.parentId);
    if (!loc) throw new EngineError("not_found", `Parent ${target.parentId} not found`);
    if (!CONTAINER_TYPES.has(loc.block.type)) {
      throw new EngineError("not_container", `Block type "${loc.block.type}" cannot contain children`);
    }
    parent = loc.block;
    siblings = loc.block.children ?? [];
  }
  const index = clampIndex(target.index, siblings.length);
  const next = [...siblings.slice(0, index), block, ...siblings.slice(index)];
  return withChildren(blocks, parent, next);
}

export function removeBlock(
  blocks: Block[],
  id: string,
  opts: { force?: boolean } = {}
): { blocks: Block[]; removed: Block } {
  const loc = findBlock(blocks, id);
  if (!loc) throw new EngineError("not_found", `Block ${id} not found`);
  if (loc.block.locks?.delete && !opts.force) {
    throw new EngineError("locked", lockMessage(loc.block, "deleted"));
  }
  const siblings = loc.parent ? loc.parent.children! : blocks;
  const next = siblings.filter((b) => b.id !== id);
  return { blocks: withChildren(blocks, loc.parent, next), removed: loc.block };
}

export function moveBlock(blocks: Block[], id: string, target: InsertTarget): Block[] {
  const loc = findBlock(blocks, id);
  if (!loc) throw new EngineError("not_found", `Block ${id} not found`);
  if (loc.block.locks?.move) {
    throw new EngineError("locked", lockMessage(loc.block, "moved"));
  }
  if (target.parentId === id || isDescendant(loc.block, target.parentId ?? "")) {
    throw new EngineError("cycle", "Cannot move a block into itself or its own children");
  }
  const { blocks: without } = removeBlock(blocks, id, { force: true });
  return insertBlock(without, loc.block, target);
}

/** Deep clone with fresh ids everywhere; inserted right after the original. */
export function duplicateBlock(blocks: Block[], id: string): { blocks: Block[]; copy: Block } {
  const loc = findBlock(blocks, id);
  if (!loc) throw new EngineError("not_found", `Block ${id} not found`);
  const copy = cloneWithFreshIds(loc.block);
  const next = insertBlock(blocks, copy, {
    parentId: loc.parent?.id ?? null,
    index: loc.index + 1,
  });
  return { blocks: next, copy };
}

export function cloneWithFreshIds(block: Block): Block {
  return {
    ...structuredClone(block),
    id: newId(),
    children: block.children?.map(cloneWithFreshIds),
  };
}

function clampIndex(i: number, len: number): number {
  return Math.max(0, Math.min(Math.trunc(i), len));
}

function lockMessage(block: Block, verb: string): string {
  const why = block.locks?.reason ? ` (${block.locks.reason})` : "";
  return `Block ${block.id} is locked and cannot be ${verb}${why}`;
}
