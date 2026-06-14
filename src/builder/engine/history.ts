// ============================================================
// Builder engine — undo/redo history (Phase 9)
// ============================================================
// A plain immutable past/present/future stack over document
// snapshots. The shell decides WHAT a snapshot is (page content
// + override layers) and when to coalesce (typing shouldn't
// create 40 undo steps); this module just keeps the timeline
// honest. Capped so a long editing session can't eat the tab's
// memory.
// ============================================================

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

export const HISTORY_CAP = 100;

export function createHistory<T>(initial: T): History<T> {
  return { past: [], present: initial, future: [] };
}

/** Commit a new state as an undo step. Clears the redo branch. */
export function push<T>(h: History<T>, next: T, cap = HISTORY_CAP): History<T> {
  const past = [...h.past, h.present];
  if (past.length > cap) past.shift();
  return { past, present: next, future: [] };
}

/**
 * Replace the present WITHOUT creating an undo step — for coalescing
 * rapid edits (keystrokes) into the step that opened them.
 */
export function replace<T>(h: History<T>, next: T): History<T> {
  return { ...h, present: next };
}

export function canUndo<T>(h: History<T>): boolean {
  return h.past.length > 0;
}

export function canRedo<T>(h: History<T>): boolean {
  return h.future.length > 0;
}

export function undo<T>(h: History<T>): History<T> {
  if (!canUndo(h)) return h;
  const past = [...h.past];
  const present = past.pop()!;
  return { past, present, future: [h.present, ...h.future] };
}

export function redo<T>(h: History<T>): History<T> {
  if (!canRedo(h)) return h;
  const [present, ...future] = h.future;
  return { past: [...h.past, h.present], present, future };
}
