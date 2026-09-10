// ============================================================
// RIG — a set of hand-stitched bibs
// ============================================================
// The Days-of-the-Week set (seven bibs, one word each, a colour per bib
// in the Rainbow colourway) and the Mama-and-Papa Anushig pair (two bibs,
// two lines each with a motif between). Same rig with different words and
// a different arrangement, because that is genuinely all they are.
//
// References: public/img/days-bib/02.jpg — three, three and one, each a
// different pastel; public/img/anushig-bib/cover.jpg — the pair side by
// side, both in the same thread.
//
// What the customer chooses is the colourway, and a colourway means
// different things on different sets: one thread across white cloth, a
// cloth-and-thread pair, or a colour PER BIB. `pieceColors` in
// src/data/setBibs.js is where that is decided, so the rig does not have
// to know which product it is rendering.
// ============================================================

import { Group } from "three";
import { pieceColors } from "../../data/setBibs.js";
import { fitScale, gridPlacements } from "./arrange.js";
import { clearChartCache, loadStitchFont } from "../stitch/rasterize.js";
import { createStitchedBib, type StitchedBib } from "./stitchedBib";
import { BOTTOM, HALF_W, TOP } from "./bibBody";
import type { MOTIFS } from "../stitch/chart.js";

/** A colourway swatch as the product JSON stores it. */
export interface Swatch {
  color?: string;
  dual?: string[];
  gradient?: string[];
}

export interface BibSetDesign {
  swatch?: Swatch | null;
}

export interface BibSetRigOptions {
  /** One entry per bib, in the order the set is worked. */
  pieces: { lines: string[]; label: string }[];
  perRow: number;
  motif?: keyof typeof MOTIFS | null;
  /** Used when the chosen colourway does not name one. */
  defaultCloth?: string;
  defaultThread?: string;
  textureSize?: number;
  textWidth?: number;
}

export interface BibSetRig {
  group: Group;
  apply: (design: BibSetDesign) => number;
  setRevealed: (count: number) => void;
  onRestitch: (cb: (total: number) => void) => void;
  dispose: () => void;
}

/** Space between pieces, as a fraction of one bib. */
const GAP_X = 0.1;
const GAP_Z = 0.08;

/**
 * The box the camera pose actually shows, not the size of one bib.
 *
 * A single bib fills about 70 percent of the stage's width and 66 percent
 * of its depth — the pose leaves a margin, and the stage is 4:3 while a
 * bib is nearly square, so there is more room across than front to back.
 * Fitting a set into one bib's footprint instead of into the visible
 * frame is why the pair first rendered as two small bibs adrift in a lot
 * of empty cream.
 */
const FRAME = {
  width: (HALF_W * 2) / 0.7,
  // Tighter than the 0.66 the single bib measures, because the fit is flat
  // arithmetic and the camera is not: it looks down at an angle, so the
  // near row projects larger and lower than the far one. A set fitted to
  // the full measured depth puts its front row through the bottom edge —
  // which is how the seven-bib set first rendered, with Sunday cut in half.
  depth: (TOP - BOTTOM) * 1.22,
};

/**
 * How far back a multi-row set sits, as a fraction of its own depth.
 * Same reason: the rows nearest the camera take more of the picture than
 * their share, so the whole arrangement leans away to even it out.
 */
const PUSH_BACK = 0.08;

export function createBibSetRig(opts: BibSetRigOptions): BibSetRig {
  const {
    pieces,
    perRow,
    motif = null,
    defaultCloth = "#FFFFFF",
    defaultThread = "#C25A7C",
    textureSize = 1024,
    textWidth = 0.72,
  } = opts;

  const group = new Group();
  const bibs: StitchedBib[] = [];
  let onRestitch: ((total: number) => void) | null = null;

  const layout = gridPlacements({
    count: pieces.length,
    perRow,
    itemW: FRAME.width,
    itemD: FRAME.depth,
    gapX: FRAME.width * GAP_X,
    gapZ: FRAME.depth * GAP_Z,
  });
  // Textures cost real memory per piece, so a set drops a tier: seven
  // 1024-square weaves is tens of megabytes for cloth nobody can see the
  // grain of once it is scaled to a seventh of the frame.
  const perPieceTexture = pieces.length > 2 ? Math.max(256, textureSize / 2) : textureSize;

  pieces.forEach((piece, i) => {
    const colors = pieceColors(null, i, { cloth: defaultCloth, thread: defaultThread });
    const bib = createStitchedBib({
      clothColor: colors.cloth,
      threadColor: colors.thread,
      lines: piece.lines,
      motif,
      textureSize: perPieceTexture,
      textWidth,
    });
    const at = layout.placements[i];
    bib.group.position.set(at.x, 0, at.z);
    group.add(bib.group);
    bibs.push(bib);
  });

  // Shrink the whole arrangement into the frame, and lean it away from the
  // camera when it has more than one row.
  const scale = fitScale(layout, FRAME);
  group.scale.setScalar(scale);
  if (layout.placements.some((p) => p.row > 0)) {
    group.position.z = -layout.depth * scale * PUSH_BACK;
  }

  const total = () => bibs.reduce((sum, b) => sum + b.count, 0);

  const apply = (design: BibSetDesign): number => {
    bibs.forEach((bib, i) => {
      const colors = pieceColors(design?.swatch, i, { cloth: defaultCloth, thread: defaultThread });
      bib.setColors(colors);
    });
    return total();
  };

  /**
   * Reveal across the set in working order: Lusik finishes one bib before
   * starting the next, so the set fills in piece by piece rather than all
   * seven growing at once.
   */
  const setRevealed = (count: number) => {
    let left = count;
    for (const bib of bibs) {
      bib.setRevealed(left);
      left -= bib.count;
    }
  };

  // The letterforms come from a webfont, so the whole set is planned once
  // in the fallback face and again when the real one lands.
  let disposed = false;
  loadStitchFont().then(() => {
    if (disposed) return;
    clearChartCache();
    for (const bib of bibs) bib.restitch();
    onRestitch?.(total());
  }).catch(() => { /* the fallback face still spells the words */ });

  return {
    group,
    apply,
    setRevealed,
    onRestitch: (cb) => { onRestitch = cb; },
    dispose: () => {
      disposed = true;
      for (const bib of bibs) bib.dispose();
      group.clear();
    },
  };
}
