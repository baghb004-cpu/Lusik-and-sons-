// ============================================================
// LOOM — public API
// ============================================================
// The only module anything outside src/loom/ should import from, and it
// must always be reached through next/dynamic. A static import anywhere
// folds three.js into that route's first-load JS; the bundle gate in
// scripts/check-bundle-budget.mjs fails the build if that happens, and
// finds the chunk by the build tag below.
// ============================================================

export { LOOM_BUILD_TAG } from "./buildTag";
export { LoomStage as default, LoomStage } from "./LoomStage";
export type { LoomStageProps } from "./LoomStage";
export { POSES } from "./core/camera";
