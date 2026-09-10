// ============================================================
// RIG — the Hye Em Yes Bib (and its cap)
// ============================================================
// The same bib body as the Custom Name Bib, worked differently: three
// lowercase Armenian words on one line, հայ in red, եմ in blue, ես in
// orange, hand cross-stitched. Reference: public/img/hye-em-bib/02.jpg.
//
// Real crosses, not a decal. The two bibs are made by different hands —
// one by machine, one by Lusik — and the product page says so, so the
// stage has to show the difference rather than paint the same picture
// twice in different colours.
//
// The optional cap is a white knit beanie with a turned-up cuff carrying
// a small Armenian flag. It appears only when the customer adds it, and
// the piece reframes when it does, because with the cap on the stage the
// bib is no longer the whole product.
// ============================================================

import { Group } from "three";
import { createStitchMesh, type PlannedStitch, type StitchMeshHandle } from "../stitch/mesh";
import { CAP_HEIGHT, CAP_R, createKnitCap } from "./knitCap";
import { planCapFlag, planHyeEmYes } from "../design";
import { clearChartCache, loadStitchFont } from "../stitch/rasterize.js";
import { createBibBody, faceZ, HALF_W, SURFACE_Y, TOP, BOTTOM, type BibBody } from "./bibBody";
import type { HyeEmYesDesign } from "../types";

export interface HyeEmYesRigOptions {
  clothColor?: string;
  trimColor?: string;
  textureSize?: number;
}

export interface HyeEmYesRig {
  group: Group;
  extent: { width: number; height: number };
  /** Apply a design; returns how many stitches there are to reveal. */
  setDesign: (design: HyeEmYesDesign) => number;
  setRevealed: (count: number) => void;
  /** Told when the piece re-plans itself, with the new stitch total. */
  onRestitch: (cb: (total: number) => void) => void;
  dispose: () => void;
}

/**
 * World width the line of lettering is fitted to. The photo puts it at
 * roughly two thirds of the bib's width, centred, with clear cloth either
 * side — the words are a label on the piece, not a banner across it.
 */
const TEXT_WIDTH = HALF_W * 2 * 0.66;
/** Shape-space y the line sits on. Below the neck, above the hem. */
const TEXT_Y = -0.36;

/** Cell size the stitches are planned at; the group is then scaled to fit. */
const CELL = 0.02;

/** How far behind the bib's shoulders the cap stands. */
const CAP_STANDOFF = CAP_R * 0.72;

// ── Framing when the cap is added ────────────────────────────
// The stage's camera pose is fixed — it frames a bib. Standing a cap
// behind the shoulders makes the piece half again as deep, and the cap's
// crown simply left the top of the picture. The rig has to fit itself
// into the box it was given rather than expect the camera to move: shrink
// the whole group and slide it back so bib-plus-cap occupies exactly the
// depth the bib alone did.
//
// Depths are along the stage's z, which is the bib's own height laid flat
// (see faceZ). Written out rather than measured from bounding boxes so
// the arithmetic is checkable and costs nothing per keystroke.
const BIB_NEAR_Z = -TOP;
const BIB_FAR_Z = -BOTTOM;
const BIB_DEPTH = BIB_FAR_Z - BIB_NEAR_Z;
/** The cap's crown, including its cuff, is the furthest thing from the camera. */
const CAP_NEAR_Z = -(TOP + CAP_STANDOFF) - CAP_R * 1.13;
const WITH_CAP_DEPTH = BIB_FAR_Z - CAP_NEAR_Z;
const WITH_CAP_SCALE = BIB_DEPTH / WITH_CAP_DEPTH;
/** Slide so the two arrangements share a centre. */
const WITH_CAP_SHIFT =
  (BIB_NEAR_Z + BIB_FAR_Z) / 2 - ((CAP_NEAR_Z + BIB_FAR_Z) / 2) * WITH_CAP_SCALE;

/** The bib's stitches never outnumber the three words. */
const TEXT_CAPACITY = 1200;

/**
 * Fit a planned stitch list into a box.
 *
 * The stitches come out of the planner in chart cells starting at an
 * arbitrary origin, and how wide that run is depends on the font — so the
 * only honest way to place it on the cloth is to measure what the planner
 * actually produced rather than to hard-code a transform.
 *
 * The offsets are in the STITCH PLANE's own coordinates, unscaled. Every
 * run here lives in a pivot that is scaled, and the cap's is also stood
 * on end; applying a centring offset outside those transforms would put
 * the flag beside the cap instead of on it.
 */
function fitStitches(stitches: PlannedStitch[], targetW: number) {
  if (stitches.length === 0) return { scale: 1, offsetX: 0, offsetZ: 0, height: 0 };
  let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
  for (const s of stitches) {
    if (s.x < minX) minX = s.x;
    if (s.x > maxX) maxX = s.x;
    if (s.y < minY) minY = s.y;
    if (s.y > maxY) maxY = s.y;
  }
  const cellsW = maxX - minX + 1;
  const cellsH = maxY - minY + 1;
  return {
    scale: targetW / (cellsW * CELL),
    // Stitches sit at (x*CELL, 0, y*CELL), so shifting back by the min
    // corner puts the run's top-left at the origin and half its size
    // re-centres it.
    offsetX: -(minX * CELL + (cellsW * CELL) / 2),
    offsetZ: -(minY * CELL + (cellsH * CELL) / 2),
    height: cellsH * CELL,
  };
}

export function createHyeEmYesRig(opts: HyeEmYesRigOptions = {}): HyeEmYesRig {
  const body: BibBody = createBibBody(opts);
  const group = body.group;

  // ---- the lettering ----
  // Two nested groups on purpose: the pivot carries the scale and the
  // placement on the cloth, the inner one carries the centring offset in
  // the stitch plane's own coordinates.
  const textPivot = new Group();
  const textInner = new Group();
  const textStitches: StitchMeshHandle = createStitchMesh(TEXT_CAPACITY, { cell: CELL });
  for (const mesh of textStitches.meshes) textInner.add(mesh);
  textPivot.add(textInner);
  textPivot.position.set(0, SURFACE_Y, faceZ(TEXT_Y));
  group.add(textPivot);

  // ---- the cap ----
  // Shared with the Bari Akhorzhak set, which stitches a name on the same
  // cuff instead of a flag.
  const cap = createKnitCap({ clothColor: opts.clothColor, textureSize: opts.textureSize });
  cap.group.visible = false;
  // Standing behind the bib's shoulders, tipped back, as it is propped in
  // the photograph.
  cap.group.position.set(0, 0.02, -(TOP + CAP_STANDOFF));
  cap.group.rotation.x = -0.22;
  group.add(cap.group);

  let textCount = 0;
  let flagCount = 0;
  let capOn = false;
  /** @see MountedRig.onRestitch — the stage's reveal has to be told. */
  let onRestitch: ((total: number) => void) | null = null;
  const total = () => textCount + (capOn ? flagCount : 0);

  /**
   * Re-plan the lettering. Called on mount and again when the display
   * font arrives: the letterforms come out of the font, so a plan made
   * before it loaded is a plan made in the fallback face.
   */
  const stitchText = () => {
    const planned = planHyeEmYes();
    const fit = fitStitches(planned.stitches, TEXT_WIDTH);
    textPivot.scale.setScalar(fit.scale);
    textInner.position.set(fit.offsetX, 0, fit.offsetZ);
    textStitches.setStitches(planned.stitches);
    textCount = planned.stitches.length;
    return textCount;
  };

  const setDesign = (design: HyeEmYesDesign): number => {
    if (textCount === 0) stitchText();
    capOn = design.withCap === true;
    cap.group.visible = capOn;
    group.scale.setScalar(capOn ? WITH_CAP_SCALE : 1);
    group.position.z = capOn ? WITH_CAP_SHIFT : 0;
    return total();
  };

  /**
   * Reveal in working order: the bib first, then the flag on the cap.
   * That is the order the pieces are actually made in, and it means the
   * cap does not appear half-stitched beside a bare bib.
   */
  const setRevealed = (count: number) => {
    textStitches.setRevealed(count);
    cap.setRevealed(count - textCount);
  };

  // First plan, then a second one once the font is in. `document.fonts`
  // is absent in the poster generator's early frames and in tests, so the
  // first plan has to stand on its own.
  stitchText();
  // A quarter of the cap's width, as in the photograph: a small flag
  // pinned to the brim, not a banner wrapped round it.
  flagCount = cap.stitchCuff(planCapFlag().stitches, 0.5);
  let disposed = false;
  loadStitchFont().then(() => {
    if (disposed) return;
    // The rasteriser caches by character AND caches the one font size the
    // lowercase alphabet is drawn at; both have to go, or the real face is
    // handed back the fallback's charts at the fallback's metrics.
    clearChartCache();
    stitchText();
    // setStitches has already made the new plan fully visible; what the
    // stage needs is the new total, or its reveal animation caps at the
    // old one and leaves the sentence half-worked.
    onRestitch?.(total());
  }).catch(() => { /* the fallback face still spells the words */ });

  const dispose = () => {
    disposed = true;
    textStitches.dispose();
    cap.dispose();
    body.dispose();
  };

  return {
    group,
    // The cap sits above the bib's shoulders, so the piece is taller
    // whenever it is on; the stage frames whatever this reports.
    get extent() {
      return {
        width: HALF_W * 2,
        height: capOn ? (TOP - BOTTOM) + CAP_HEIGHT : TOP - BOTTOM,
      };
    },
    setDesign,
    setRevealed,
    onRestitch: (cb) => { onRestitch = cb; },
    dispose,
  };
}
