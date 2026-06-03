// ============================================================
// galleryRotationStyle — CSS-rotation band-aid for sideways photos
// ============================================================
// Some source JPEGs are stored sideways (EXIF orientation hint
// ignored by some camera apps). CONFIG.ROTATED_GALLERY_INDEXES
// tracks which gallery indexes need the rotation; this helper
// returns the right transform style for them. When you re-upload
// the photo with correct orientation, remove the index from the
// CONFIG set and the rotation goes away everywhere.
//
// `shape` controls the scale factor (4:5 portrait needs 1.25 to
// fill; square needs 1.0).
//
// ============================================================

import type { CSSProperties } from "react";
import { CONFIG } from "../data/config.js";

export type GalleryShape = "portrait-4-5" | "square";

export function galleryRotationStyle(
  i: number,
  shape: GalleryShape = "portrait-4-5",
): CSSProperties {
  if (!CONFIG.ROTATED_GALLERY_INDEXES.has(i)) return {};
  const scale = shape === "square" ? 1 : 1.25;
  return { transform: `rotate(90deg) scale(${scale})` };
}
