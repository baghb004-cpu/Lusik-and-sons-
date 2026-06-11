// Builder engine — public surface.

export {
  findBlock,
  collectIds,
  updateBlock,
  insertBlock,
  removeBlock,
  moveBlock,
  duplicateBlock,
  cloneWithFreshIds,
  EngineError,
  type BlockLocation,
  type InsertTarget,
} from "./tree.ts";

export {
  resolveBlocks,
  listStaleOverrides,
  pruneStaleOverrides,
  type Device,
  type ResolveResult,
  type StaleEntry,
} from "./overrides.ts";

export { validatePage, type ValidationIssue, type ValidatePageResult } from "./validate.ts";

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
