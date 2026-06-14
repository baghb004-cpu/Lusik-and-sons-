// ============================================================
// Layout issue scanner — find responsive problems + score them
// ============================================================
// Two tiers, both PURE here:
//   - staticScan(page, preset): document-model heuristics that need
//     no DOM (grid too wide for the screen, fixed widths exceeding
//     the viewport, sub-floor tap targets, too many nav items,
//     hinge conflicts, tablet space waste). Fully unit-testable.
//   - rect checks (offscreen/overflow/overlap/too-large): pure
//     functions over MEASURED rects the preview panel collects via
//     getBoundingClientRect — the DOM lives in the panel, the math
//     lives here.
// scoreIssues folds findings into the four-grade system.
// ============================================================

import type { Block, Page } from "../schema/index.ts";
import { layoutRulesFor, type LayoutRules } from "./adaptiveLayoutRules.ts";
import type { ViewportPreset } from "./viewportPresets.ts";

export type IssueSeverity = "critical" | "warning" | "info";
export type Grade = "Excellent" | "Good" | "Needs Fixes" | "Broken Layout";

export interface LayoutIssue {
  code: string;
  severity: IssueSeverity;
  message: string;
  blockId?: string;
  /** Set when the apply-engine / fixer can address it automatically. */
  fixable?: boolean;
}

// ── scoring ─────────────────────────────────────────────────
export function scoreIssues(issues: LayoutIssue[]): Grade {
  const critical = issues.filter((i) => i.severity === "critical").length;
  const warning = issues.filter((i) => i.severity === "warning").length;
  if (critical >= 2) return "Broken Layout";
  if (critical === 1) return "Needs Fixes";
  if (warning >= 3) return "Needs Fixes";
  if (warning >= 1) return "Good";
  return "Excellent";
}

// ── static scan (no DOM) ────────────────────────────────────
const CSS_PX = /^(-?\d+(?:\.\d+)?)px$/;
const PERCENT = /^(\d+(?:\.\d+)?)%$/;

function pxValue(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const m = CSS_PX.exec(v);
  return m ? Number(m[1]) : null;
}

function walk(blocks: Block[], visit: (b: Block) => void): void {
  for (const b of blocks) {
    visit(b);
    if (b.children) walk(b.children, visit);
  }
}

export function staticScan(page: Page, preset: ViewportPreset, rules: LayoutRules = layoutRulesFor(preset)): LayoutIssue[] {
  const issues: LayoutIssue[] = [];
  const contentWidth = preset.width - (preset.safeArea ? preset.safeArea.left + preset.safeArea.right : 0);

  walk(page.sections, (b) => {
    const props = b.props as Record<string, unknown>;

    // Grid/columns far wider than the screen comfortably holds.
    if ((b.type === "productGrid" || b.type === "gallery" || b.type === "columns") && typeof props.columns === "number") {
      if (props.columns > rules.columns + 1) {
        issues.push({
          code: "grid_too_wide",
          severity: props.columns - rules.columns >= 3 ? "critical" : "warning",
          message: `${b.type} uses ${props.columns} columns — ${preset.label} reads best at ${rules.columns}; cards will be cramped`,
          blockId: b.id,
          fixable: true,
        });
      }
    }

    // A fixed pixel width/maxWidth wider than the viewport → horizontal scroll / cropping.
    for (const key of ["width", "maxWidth"] as const) {
      const px = pxValue(b.style?.[key]);
      if (px !== null && px > contentWidth) {
        issues.push({
          code: "fixed_width_overflow",
          severity: "critical",
          message: `Block ${b.id} has ${key} ${px}px but the screen is ${contentWidth}px wide — content will overflow or crop`,
          blockId: b.id,
          fixable: true,
        });
      }
    }

    // Pill nav with too many items for a narrow screen → label crowding.
    if (b.type === "pillNav" && Array.isArray(props.items)) {
      const perItem = contentWidth / props.items.length;
      if (perItem <= 64) {
        issues.push({
          code: "nav_crowded",
          severity: perItem < 52 ? "critical" : "warning",
          message: `Pill menu has ${props.items.length} buttons on a ${contentWidth}px screen (~${Math.round(perItem)}px each) — below the comfortable ~64px`,
          blockId: b.id,
          fixable: false,
        });
      }
    }

    // Explicit tap-target sizing below the floor (touch screens).
    if (preset.touch && b.type === "button") {
      const h = pxValue(b.style?.height);
      if (h !== null && h < rules.tapTargetMinPx) {
        issues.push({
          code: "tap_target_small",
          severity: "warning",
          message: `Button ${b.id} is ${h}px tall — under the ${rules.tapTargetMinPx}px touch floor`,
          blockId: b.id,
          fixable: true,
        });
      }
    }

    // Foldable hinge conflict: a wide media/grid spanning the dead zone.
    if (rules.hingeAware && preset.hinge?.axis === "vertical") {
      const widePct = PERCENT.exec(String(b.style?.width ?? ""));
      const spans = b.type === "gallery" || b.type === "productGrid" || (widePct && Number(widePct[1]) >= 80);
      if (spans && rules.panes === "dual") {
        issues.push({
          code: "hinge_conflict",
          severity: "warning",
          message: `${b.type} spans the fold — consider a split-pane so content avoids the hinge dead zone`,
          blockId: b.id,
          fixable: false,
        });
      }
    }
  });

  // Tablet/desktop wasting space: everything single-column on a wide screen.
  if (rules.columns >= 3) {
    const hasGrid = page.sections.some((b) => b.type === "productGrid" || b.type === "gallery" || b.type === "columns");
    if (!hasGrid && page.sections.length > 0) {
      issues.push({
        code: "space_wasted",
        severity: "info",
        message: `${preset.label} can show ${rules.columns} columns, but this page is single-column — wide screens have room for more`,
        fixable: false,
      });
    }
  }

  // Very short screens with a tall stack: warn about excessive scrolling chrome.
  if (rules.headerStyle === "compact" && page.sections.length >= 6) {
    issues.push({
      code: "short_screen_dense",
      severity: "info",
      message: `Short screen with ${page.sections.length} sections — a compact header and tighter spacing help (Apply preset does this)`,
      fixable: true,
    });
  }

  return issues;
}

// ── rect checks (pure; fed measured rects by the panel) ─────
export interface MeasuredRect {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** position:fixed/sticky — used for footer-covers-content checks. */
  fixed?: boolean;
}

export interface Viewport {
  width: number;
  height: number;
  safeArea?: { top: number; bottom: number; left: number; right: number };
}

export function rectScan(rects: MeasuredRect[], vp: Viewport): LayoutIssue[] {
  const issues: LayoutIssue[] = [];
  const safe = vp.safeArea ?? { top: 0, bottom: 0, left: 0, right: 0 };

  for (const r of rects) {
    if (r.width === 0 && r.height === 0) continue;
    // off the right/left edge
    if (r.x + r.width > vp.width + 1 || r.x < -1) {
      issues.push({ code: "offscreen_x", severity: "critical", message: `"${r.label}" runs off the screen horizontally`, blockId: r.id });
    }
    // wider/taller than the viewport (modal/element too large)
    if (r.width > vp.width + 1) {
      issues.push({ code: "element_too_wide", severity: "critical", message: `"${r.label}" is wider than the screen`, blockId: r.id });
    }
    if (r.height > vp.height && r.fixed) {
      issues.push({ code: "modal_too_tall", severity: "warning", message: `"${r.label}" is taller than the screen`, blockId: r.id });
    }
    // intruding into a notch / cutout / home-indicator
    if (!r.fixed && (r.y < safe.top - 1 || r.y + r.height > vp.height - safe.bottom + 1) && (safe.top > 0 || safe.bottom > 0)) {
      issues.push({ code: "unsafe_area", severity: "warning", message: `"${r.label}" sits under a notch/home-indicator safe area`, blockId: r.id });
    }
  }

  // A fixed footer overlapping the last flowing element.
  const fixedBottom = rects.filter((r) => r.fixed && r.y > vp.height / 2);
  const flowing = rects.filter((r) => !r.fixed);
  for (const f of fixedBottom) {
    for (const c of flowing) {
      if (c.y < f.y + f.height && c.y + c.height > f.y && c.x < f.x + f.width && c.x + c.width > f.x) {
        issues.push({ code: "footer_covers_content", severity: "warning", message: `A sticky bar overlaps "${c.label}"`, blockId: c.id });
        break;
      }
    }
  }
  return issues;
}
