"use client";

// ============================================================
// Canvas toolbar (Phase 9) — act on the selected block in place
// ============================================================
// Floats above the preview when a block is selected: move up/
// down, duplicate, delete, lock/unlock, and (for image blocks)
// rotate. Lock state is honest UI: locked actions show why they
// refuse (the engine's lock messages), not grayed-out mystery.
// ============================================================

import type { Block } from "../schema/index.ts";

export interface CanvasToolbarProps {
  block: Block;
  onMoveBy: (delta: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleLock: () => void;
  onRotate?: () => void; // image blocks only
  onClose: () => void;
}

export function CanvasToolbar({ block, onMoveBy, onDuplicate, onDelete, onToggleLock, onRotate, onClose }: CanvasToolbarProps) {
  const locked = !!(block.locks?.move || block.locks?.delete || block.locks?.edit);
  return (
    <div className="pointer-events-auto absolute left-1/2 top-2 z-40 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-ink/15 bg-white/95 px-1.5 py-1 shadow-card backdrop-blur">
      <span className="max-w-28 truncate px-1.5 text-[11px] font-medium text-muted">{block.type}</span>
      <Btn label="Move up (Alt+↑)" onClick={() => onMoveBy(-1)}>↑</Btn>
      <Btn label="Move down (Alt+↓)" onClick={() => onMoveBy(1)}>↓</Btn>
      <Btn label="Duplicate" onClick={onDuplicate}>⧉</Btn>
      {onRotate ? <Btn label="Rotate 90°" onClick={onRotate}>⟳</Btn> : null}
      <Btn label={locked ? `Unlock${block.locks?.reason ? ` (${block.locks.reason})` : ""}` : "Lock (protect from move/delete)"} onClick={onToggleLock}>
        {locked ? "🔒" : "🔓"}
      </Btn>
      <Btn label="Delete (Del)" onClick={onDelete} danger>✕</Btn>
      <Btn label="Deselect (Esc)" onClick={onClose}>×</Btn>
    </div>
  );
}

function Btn({ children, label, onClick, danger }: { children: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={
        danger
          ? "h-7 min-w-7 rounded-full px-1.5 text-sm text-red-700 hover:bg-red-50"
          : "h-7 min-w-7 rounded-full px-1.5 text-sm hover:bg-cream"
      }
    >
      {children}
    </button>
  );
}
