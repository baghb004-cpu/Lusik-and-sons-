// Embroidery module (§31, Phase 5) — public surface. A pure, offline counted
// embroidery/cross-stitch engine: thread palette, 5x7 text-to-stitch font,
// design grid model, grid→stitch-path, a Tajima DST machine-file encoder
// (experimental), and metrics/hoop/density checks. The UI route is
// ui/EmbroideryStudio.tsx.
export * from "./palette.ts";
export * from "./font.ts";
export * from "./model.ts";
export * from "./stitches.ts";
export * from "./dst.ts";
export * from "./metrics.ts";
export * from "./autodigitize.ts";

export const EMBROIDERY_STORE_KEY = "lusik_embroidery_current";
export const EMBROIDERY_BACKUP_TAG = "lusik-embroidery-design";
