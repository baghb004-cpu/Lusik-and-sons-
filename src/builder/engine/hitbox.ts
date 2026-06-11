// ============================================================
// Builder engine — tap-target (hit-box) math
// ============================================================
// Pure rect logic behind the editor's hit-box overlay and the
// mobile tap validators (plan §6 item 4): targets under the
// 44×44 px comfort floor, and overlapping targets a thumb can't
// tell apart. DOM measurement happens in the editor component;
// everything decidable is here, where node:test can reach it.
// Editor-side only — none of this ships to published pages.
// ============================================================

export interface TargetRect {
  id: string; // stable per measurement pass (element index / block id)
  label: string; // accessible name-ish, for the issue message
  x: number;
  y: number;
  width: number;
  height: number;
}

/** WCAG 2.5.8 AAA / Apple HIG comfort floor. */
export const MIN_TAP_PX = 44;

export interface TapIssue {
  kind: "too_small" | "overlap";
  message: string;
  ids: string[];
}

export function findSmallTargets(rects: TargetRect[], min = MIN_TAP_PX): TapIssue[] {
  return rects
    .filter((r) => r.width > 0 && r.height > 0 && (r.width < min || r.height < min))
    .map((r) => ({
      kind: "too_small" as const,
      ids: [r.id],
      message: `“${r.label}” is ${Math.round(r.width)}×${Math.round(r.height)}px — under the ${min}px tap floor`,
    }));
}

function intersects(a: TargetRect, b: TargetRect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function contains(outer: TargetRect, inner: TargetRect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

/**
 * Overlapping targets, ignoring containment (a label wrapping its input
 * is ONE target, not a collision).
 */
export function findOverlaps(rects: TargetRect[]): TapIssue[] {
  const issues: TapIssue[] = [];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i];
      const b = rects[j];
      if (!intersects(a, b)) continue;
      if (contains(a, b) || contains(b, a)) continue;
      issues.push({
        kind: "overlap",
        ids: [a.id, b.id],
        message: `“${a.label}” and “${b.label}” overlap — a thumb can't tell them apart`,
      });
    }
  }
  return issues;
}

export function auditTapTargets(rects: TargetRect[], min = MIN_TAP_PX): TapIssue[] {
  return [...findSmallTargets(rects, min), ...findOverlaps(rects)];
}
