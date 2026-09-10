// ============================================================
// BUILD TAG — how the bundle gate finds the engine's chunk
// ============================================================
// Its own module, not part of index.ts, to avoid a cycle: index.ts
// re-exports LoomStage, and LoomStage needs this value.
//
// Next hashes async chunk filenames and no build artifact maps a chunk
// back to its source modules, so scripts/check-bundle-budget.mjs greps
// compiled chunks for this string. LoomStage writes it into a DOM
// attribute, which keeps it a real runtime value — an unused constant
// would be tree-shaken and the gate would silently stop checking without
// anyone noticing.
// ============================================================

export const LOOM_BUILD_TAG = "lusik-loom-v1";
