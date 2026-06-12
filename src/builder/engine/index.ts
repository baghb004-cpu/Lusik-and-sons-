// Builder engine — public surface.

export {
  findBlock,
  collectIds,
  updateBlock,
  insertBlock,
  removeBlock,
  moveBlock,
  moveBlockBy,
  setBlockLocks,
  duplicateBlock,
  cloneWithFreshIds,
  EngineError,
  type BlockLocation,
  type InsertTarget,
} from "./tree.ts";

export {
  createHistory,
  push as pushHistory,
  replace as replaceHistory,
  undo,
  redo,
  canUndo,
  canRedo,
  HISTORY_CAP,
  type History,
} from "./history.ts";

export {
  resolveBlocks,
  listStaleOverrides,
  pruneStaleOverrides,
  overridePath,
  emptyLayer,
  setOverridePatch,
  clearOverridePatch,
  addMobileOnlyBlock,
  removeMobileOnlyBlock,
  type Device,
  type ResolveResult,
  type StaleEntry,
} from "./overrides.ts";

export {
  auditTapTargets,
  findSmallTargets,
  findOverlaps,
  MIN_TAP_PX,
  type TargetRect,
  type TapIssue,
} from "./hitbox.ts";

export { validatePage, type ValidationIssue, type ValidatePageResult } from "./validate.ts";

export {
  validateCommerceRefs,
  resolveProductRef,
  type CatalogSnapshot,
  type CatalogProductSnapshot,
} from "./commerce.ts";

export {
  suggestSlug,
  pagePath,
  templatePath,
  createPage,
  duplicatePage,
  pageToTemplate,
  type NewPageOptions,
} from "./pages.ts";

export {
  contrastRatio,
  relativeLuminance,
  checkContrast,
  hexToRgb,
  type ContrastCheck,
} from "./contrast.ts";
export { parseCsv } from "./csv.ts";
