// ============================================================
// RIG — the Bari Akhorzhak Bib & Burp Cloth Set
// ============================================================
// Two pieces carrying two halves of an Armenian grandmother's table
// blessing: the bib says Բարի ախորժակ before the baby eats, the burp
// cloth answers Անույշ ըլլայ afterwards. A strawberry is worked between
// the words of each. An optional cap carries the baby's name or initial
// in the same thread.
//
// Reference: public/img/bari-akhorzhak-set/cover.jpg, which is all three
// pieces laid out together — cap upper left, burp cloth across the
// bottom with its picot edge, bib upper right.
//
// The colourways here are `dual` swatches: a cloth colour and a thread
// colour, chosen together (quiet harmony, gentle complement, bold
// contrast). That is why this rig reads both halves of the swatch while
// the day bibs read one.
// ============================================================

import { Group } from "three";
import { BARI_AKHORZHAK, pieceColors } from "../../data/setBibs.js";
import { boundsOf } from "./arrange.js";
import { planBlessing, planCapName } from "../design";
import { clearChartCache, loadStitchFont } from "../stitch/rasterize.js";
import { createStitchedBib } from "./stitchedBib";
import { createBurpCloth, BURP_HALF_D, BURP_HALF_W } from "./burpCloth";
import { CAP_R, createKnitCap } from "./knitCap";
import { BOTTOM, HALF_W, TOP } from "./bibBody";
import type { Swatch } from "./bibSet";

export interface BariDesign {
  swatch?: Swatch | null;
  withCap?: boolean;
  capName?: string;
}

export interface BariRigOptions {
  textureSize?: number;
}

export interface BariRig {
  group: Group;
  apply: (design: BariDesign) => number;
  setRevealed: (count: number) => void;
  onRestitch: (cb: (total: number) => void) => void;
  dispose: () => void;
}

/** The cream and botanical green of the photographed set. */
const DEFAULT_CLOTH = "#F3EBD9";
const DEFAULT_THREAD = "#5B6F47";

/**
 * The frame the camera pose actually shows. Same measurement as the bib
 * sets: a single bib fills about 70 percent across and 66 percent front
 * to back, and the fit has to be tighter than that because the near
 * pieces project larger.
 */
const FRAME = {
  width: (HALF_W * 2) / 0.7,
  depth: (TOP - BOTTOM) * 1.22,
};

export function createBariRig(opts: BariRigOptions = {}): BariRig {
  const { textureSize = 1024 } = opts;
  const group = new Group();
  const arrangement = new Group();
  group.add(arrangement);

  // The bib, upper right.
  const bib = createStitchedBib({
    clothColor: DEFAULT_CLOTH,
    threadColor: DEFAULT_THREAD,
    lines: BARI_AKHORZHAK.bib.lines,
    textureSize: Math.max(256, textureSize / 2),
    textWidth: 0.74,
    // Both pieces carry the berry between their words.
    planWith: (color) => planBlessing({ lines: BARI_AKHORZHAK.bib.lines, color }),
  });

  // The burp cloth, across the bottom left. Its own module: it is a
  // rectangle with picot edging, not a bib.
  const burp = createBurpCloth({
    clothColor: DEFAULT_CLOTH,
    textureSize: Math.max(256, textureSize / 2),
  });

  // The cap, upper left, only when it is bought.
  const cap = createKnitCap({ clothColor: DEFAULT_CLOTH, textureSize });

  // Laid out as the photograph has them rather than on a grid: the cap
  // upper left, the bib upper right, the burp cloth lying across the
  // front at an angle.
  const bibW = HALF_W * 2;
  const bibD = TOP - BOTTOM;
  // Turned to lie landscape. Ten by seventeen inches is a portrait
  // rectangle, and stood on end it is taller than the bib beside it —
  // which is not how anyone photographs a burp cloth, or folds one.
  const BURP_ROT = Math.PI / 2 - 0.2;

  const PLACES = {
    bib: { x: bibW * 0.5, z: -bibD * 0.3, width: bibW, depth: bibD },
    burp: {
      x: -bibW * 0.1, z: bibD * 0.52,
      width: BURP_HALF_W * 2, depth: BURP_HALF_D * 2, rotY: BURP_ROT,
    },
    cap: {
      x: -bibW * 0.52, z: -bibD * 0.36,
      width: CAP_R * 2.26, depth: CAP_R * 2.26,
    },
  };

  bib.group.position.set(PLACES.bib.x, 0, PLACES.bib.z);
  burp.group.position.set(PLACES.burp.x, 0, PLACES.burp.z);
  burp.group.rotation.y = BURP_ROT;
  cap.group.position.set(PLACES.cap.x, 0, PLACES.cap.z);
  cap.group.rotation.x = -0.2;
  arrangement.add(bib.group, burp.group);

  let bibCount = 0;
  let burpCount = 0;
  let capCount = 0;
  let capOn = false;
  let onRestitch: ((total: number) => void) | null = null;
  let thread = DEFAULT_THREAD;
  let cloth = DEFAULT_CLOTH;

  const total = () => bibCount + burpCount + (capOn ? capCount : 0);

  /**
   * Fit and centre the arrangement in the frame, from the real footprints
   * of whatever is currently on the table.
   */
  const refit = () => {
    const pieces = [PLACES.bib, PLACES.burp];
    if (capOn) pieces.push(PLACES.cap);
    const bounds = boundsOf(pieces);
    const scale = Math.min(FRAME.width / bounds.width, FRAME.depth / bounds.depth);
    arrangement.scale.setScalar(scale);
    // Centre on what is actually there — the three pieces are not
    // symmetrical about the origin, and adding the cap moves the middle.
    // Then lean away from the camera, because the pieces at the front
    // project larger than their share.
    arrangement.position.set(
      -bounds.centerX * scale,
      0,
      -bounds.centerZ * scale - bounds.depth * scale * 0.06,
    );
  };

  const restitch = () => {
    bibCount = bib.restitch();
    burpCount = burp.stitch(planBlessing({
      lines: BARI_AKHORZHAK.burpCloth.lines,
      color: thread,
    }).stitches);
    return total();
  };

  const apply = (design: BariDesign): number => {
    const colors = pieceColors(design?.swatch, 0, { cloth: DEFAULT_CLOTH, thread: DEFAULT_THREAD });
    cloth = colors.cloth;
    thread = colors.thread;
    bib.setColors(colors);
    burp.setClothColor(cloth);
    burpCount = burp.stitch(planBlessing({
      lines: BARI_AKHORZHAK.burpCloth.lines,
      color: thread,
    }).stitches);

    capOn = design?.withCap === true;
    // Added and removed rather than hidden, so the fit above measures the
    // pieces that are really on the table.
    if (capOn) arrangement.add(cap.group);
    else arrangement.remove(cap.group);
    capCount = capOn
      ? cap.stitchCuff(planCapName({ name: design?.capName ?? "", color: thread }).stitches, 0.62)
      : 0;

    refit();
    return total();
  };

  /** Reveal in working order: bib, burp cloth, then the cap. */
  const setRevealed = (count: number) => {
    bib.setRevealed(count);
    burp.setRevealed(count - bibCount);
    cap.setRevealed(count - bibCount - burpCount);
  };

  restitch();
  refit();

  let disposed = false;
  loadStitchFont().then(() => {
    if (disposed) return;
    clearChartCache();
    restitch();
    onRestitch?.(total());
  }).catch(() => { /* the fallback face still spells the blessing */ });

  return {
    group,
    apply,
    setRevealed,
    onRestitch: (cb) => { onRestitch = cb; },
    dispose: () => {
      disposed = true;
      bib.dispose();
      burp.dispose();
      cap.dispose();
      group.clear();
    },
  };
}
