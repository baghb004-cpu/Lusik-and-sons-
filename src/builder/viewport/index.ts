// Viewport / adaptive-layout module — public surface.

export {
  VIEWPORT_PRESETS,
  presetById,
  presetsByFamily,
  presetGroups,
  breakpointForWidth,
  ratioLabel,
  type ViewportPreset,
  type DeviceFamily,
  type Breakpoint3,
  type Posture,
  type SafeArea,
  type HingeZone,
} from "./viewportPresets.ts";

export { layoutRulesFor, describeRules, type LayoutRules } from "./adaptiveLayoutRules.ts";

export {
  staticScan,
  rectScan,
  scoreIssues,
  type LayoutIssue,
  type IssueSeverity,
  type Grade,
  type MeasuredRect,
  type Viewport,
} from "./layoutIssueScanner.ts";

export { applyPreset, generateFixes, type ApplyResult } from "./presetApplyEngine.ts";
