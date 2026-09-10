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

import {
  BackSide, CylinderGeometry, Group, LatheGeometry, Mesh, MeshStandardMaterial,
  Vector2,
} from "three";
import { clothMaps } from "../materials/cloth";
import { createStitchMesh, type PlannedStitch, type StitchMeshHandle } from "../stitch/mesh";
import { planCapFlag, planHyeEmYes } from "../design";
import { clearChartCache } from "../stitch/rasterize.js";
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

// ── The cap's dimensions ────────────────────────────────────
// Up here rather than beside its builder because the framing arithmetic
// below needs them, and a rig that cannot say how big it is cannot fit
// itself into the frame.
const CAP_R = 0.42;
const CAP_HEIGHT = 0.62;
/** The turned-up cuff, deep enough to carry the flag as the photo does. */
const CUFF_H = 0.22;
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

/** The cap's stitches never outnumber the flag chart; the bib's never outnumber the words. */
const TEXT_CAPACITY = 1200;
const FLAG_CAPACITY = 300;

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
  const cap = buildCap(opts);
  cap.group.visible = false;
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
    cap.stitches.setRevealed(count - textCount);
  };

  // First plan, then a second one once the font is in. `document.fonts`
  // is absent in the poster generator's early frames and in tests, so the
  // first plan has to stand on its own.
  stitchText();
  flagCount = cap.stitchFlag();
  const fonts = typeof document !== "undefined" ? document.fonts : undefined;
  let disposed = false;
  fonts?.load?.('600 48px "Fraunces"').then(() => {
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

// ============================================================
// The cap
// ============================================================
// A knit beanie photographed standing on its cuff behind the bib
// (hye-em-bib/02.jpg). A lathe rather than a sphere: a beanie's profile
// has a straight side and a rounded crown, and a hemisphere reads as a
// bowl.


function capProfile(): Vector2[] {
  const points: Vector2[] = [];
  // From the bottom of the cuff up over the crown. The last point sits on
  // the axis so the lathe closes rather than leaving a hole at the top.
  points.push(new Vector2(CAP_R, 0));
  points.push(new Vector2(CAP_R * 0.99, CAP_HEIGHT * 0.42));
  points.push(new Vector2(CAP_R * 0.94, CAP_HEIGHT * 0.66));
  points.push(new Vector2(CAP_R * 0.78, CAP_HEIGHT * 0.85));
  points.push(new Vector2(CAP_R * 0.46, CAP_HEIGHT * 0.97));
  points.push(new Vector2(0, CAP_HEIGHT));
  return points;
}

function buildCap(opts: HyeEmYesRigOptions) {
  const { clothColor = "#FFFFFF", textureSize = 1024 } = opts;
  const group = new Group();

  const knit = clothMaps({
    weave: "terry",
    color: clothColor,
    size: Math.max(256, textureSize / 2),
    repeat: 3,
  });
  const material = new MeshStandardMaterial({
    map: knit.map,
    normalMap: knit.normalMap,
    roughnessMap: knit.roughnessMap,
    roughness: 0.92,
    metalness: 0,
  });

  const crownGeo = new LatheGeometry(capProfile(), 40);
  const crown = new Mesh(crownGeo, material);
  group.add(crown);

  // The turned-up cuff: a short open cylinder standing clearly proud of
  // the crown. Proud enough to SEE — at 4% it read as one smooth dome,
  // and a beanie without a visible brim is a helmet.
  const cuffGeo = new CylinderGeometry(CAP_R * 1.1, CAP_R * 1.12, CUFF_H, 40, 1, true);
  // Its own material: a folded double thickness of knit catches light
  // differently from the single layer above it, and that difference is
  // most of what makes the fold read.
  const cuffMaterial = new MeshStandardMaterial({
    map: knit.map,
    normalMap: knit.normalMap,
    roughnessMap: knit.roughnessMap,
    roughness: 0.82,
    metalness: 0,
  });
  const cuff = new Mesh(cuffGeo, cuffMaterial);
  cuff.position.y = CUFF_H / 2;
  group.add(cuff);
  // The cuff is open-ended, so its inside faces away from the camera and
  // would be culled, leaving a see-through band. A back-side copy closes it.
  const cuffInner = new Mesh(cuffGeo, new MeshStandardMaterial({
    map: knit.map, normalMap: knit.normalMap, roughness: 0.95, metalness: 0, side: BackSide,
  }));
  cuffInner.position.y = CUFF_H / 2;
  group.add(cuffInner);

  // The flag, stitched on the front of the cuff.
  const flagPivot = new Group();
  const flagInner = new Group();
  const stitches: StitchMeshHandle = createStitchMesh(FLAG_CAPACITY, { cell: CELL });
  for (const mesh of stitches.meshes) flagInner.add(mesh);
  flagPivot.add(flagInner);
  // Stand the stitch plane up to face the camera: rotating +90° about X
  // maps a chart row (increasing z) onto decreasing world y, so the flag
  // reads the right way up rather than mirrored top to bottom.
  flagPivot.rotation.x = Math.PI / 2;
  flagPivot.position.set(
    0,
    CUFF_H * 0.5,
    // Just proud of the cuff's front face, so the thread sits ON the knit.
    CAP_R * 1.06,
  );
  group.add(flagPivot);

  const stitchFlag = () => {
    const planned = planCapFlag();
    // A quarter of the cap's width, as in the photograph: a small flag
    // pinned to the brim, not a banner wrapped round it.
    const fit = fitStitches(planned.stitches, CAP_R * 0.5);
    flagPivot.scale.setScalar(fit.scale);
    flagInner.position.set(fit.offsetX, 0, fit.offsetZ);
    stitches.setStitches(planned.stitches);
    return planned.stitches.length;
  };

  // Stand the cap behind the bib's shoulders, tipped back a little, the
  // way it is propped in the photograph.
  group.position.set(0, 0.02, -(TOP + CAP_STANDOFF));
  group.rotation.x = -0.22;

  const dispose = () => {
    stitches.dispose();
    crownGeo.dispose();
    cuffGeo.dispose();
    material.dispose();
    cuffMaterial.dispose();
    (cuffInner.material as MeshStandardMaterial).dispose();
    group.clear();
  };

  return { group, stitches, stitchFlag, dispose };
}
