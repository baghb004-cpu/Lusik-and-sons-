// ============================================================
// ONE HAND-STITCHED BIB
// ============================================================
// A bib body with one or two lines of Armenian worked onto it, in a
// thread colour the customer picked. Every piece of every set is one of
// these: seven of them are a week, two of them are the Mama and Papa
// pair, one of them plus a burp cloth is the Bari Akhorzhak set.
//
// It exists so the sets do not each re-derive where lettering sits on a
// bib. That measurement came off the photographs once, in bibBody.ts, and
// a set that placed its own text would drift from the single bibs beside
// it in the same shop.
// ============================================================

import { Group } from "three";
import { createStitchMesh, type PlannedStitch, type StitchMeshHandle } from "../stitch/mesh";
import { planStitchedLines } from "../design";
import { MOTIFS } from "../stitch/chart.js";
import { createBibBody, faceZ, HALF_W, SURFACE_Y, TOP, BOTTOM, type BibBody } from "./bibBody";

export interface StitchedBibOptions {
  clothColor?: string;
  trimColor?: string;
  threadColor: string;
  /** One line, or two with a motif between them. */
  lines: string[];
  motif?: keyof typeof MOTIFS | null;
  textureSize?: number;
  /**
   * Fraction of the bib's width the lettering is fitted to. A single word
   * wants less than a two-line blessing.
   */
  textWidth?: number;
  /** Height up the bib the block of lettering is centred on, in shape space. */
  textY?: number;
  /**
   * Plan the work differently. The Bari Akhorzhak bib carries a
   * two-colour strawberry between its lines, which a single-colour motif
   * chart cannot express, so that piece supplies its own planner rather
   * than this module growing a special case for one product.
   */
  planWith?: (color: string) => { stitches: PlannedStitch[] };
}

export interface StitchedBib {
  group: Group;
  /** Footprint on the stage: width across, depth being its height laid flat. */
  extent: { width: number; depth: number };
  /** Stitches this piece carries, for the stage's reveal. */
  count: number;
  /** Re-plan (the letterforms come from a webfont). Returns the new count. */
  restitch: () => number;
  /** Change cloth and thread without rebuilding the piece. Returns the new count. */
  setColors: (colors: { cloth?: string; thread?: string }) => number;
  setRevealed: (count: number) => void;
  dispose: () => void;
}

/** Cell size the stitches are planned at; the block is then scaled to fit. */
const CELL = 0.02;
/** No piece here carries more stitches than a two-line blessing. */
const CAPACITY = 2400;

export function createStitchedBib(opts: StitchedBibOptions): StitchedBib {
  const {
    clothColor = "#FFFFFF",
    trimColor,
    threadColor: initialThread,
    lines,
    motif = null,
    textureSize = 1024,
    textWidth = 0.66,
    textY = -0.34,
    planWith = null,
  } = opts;

  const body: BibBody = createBibBody({ clothColor, trimColor, textureSize });
  const group = body.group;

  // Pivot carries the scale and the placement on the cloth; the inner
  // group carries the centring offset in the stitch plane's own
  // coordinates. Applying the offset outside the scale puts the words
  // beside the bib rather than on it.
  const pivot = new Group();
  const inner = new Group();
  const stitches: StitchMeshHandle = createStitchMesh(CAPACITY, { cell: CELL });
  for (const mesh of stitches.meshes) inner.add(mesh);
  pivot.add(inner);
  pivot.position.set(0, SURFACE_Y, faceZ(textY));
  group.add(pivot);

  let count = 0;
  let threadColor = initialThread;

  const restitch = (): number => {
    const planned = planWith
      ? planWith(threadColor)
      : planStitchedLines({ lines, color: threadColor, motif });
    if (planned.stitches.length === 0) {
      count = 0;
      stitches.setStitches([]);
      return 0;
    }
    let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
    for (const s of planned.stitches) {
      if (s.x < minX) minX = s.x;
      if (s.x > maxX) maxX = s.x;
      if (s.y < minY) minY = s.y;
      if (s.y > maxY) maxY = s.y;
    }
    const cellsW = maxX - minX + 1;
    const cellsH = maxY - minY + 1;
    // Fit by whichever axis runs out first. A two-line block fitted only
    // by width would run off the bottom of a bib.
    const targetW = HALF_W * 2 * textWidth;
    const targetD = (TOP - BOTTOM) * 0.3;
    const scale = Math.min(targetW / (cellsW * CELL), targetD / (cellsH * CELL));
    pivot.scale.setScalar(scale);
    inner.position.set(
      -(minX * CELL + (cellsW * CELL) / 2),
      0,
      -(minY * CELL + (cellsH * CELL) / 2),
    );
    stitches.setStitches(planned.stitches);
    count = planned.stitches.length;
    return count;
  };

  restitch();

  return {
    group,
    extent: { width: HALF_W * 2, depth: TOP - BOTTOM },
    get count() { return count; },
    restitch,
    setColors: ({ cloth, thread }) => {
      if (cloth) body.setClothColor(cloth);
      if (thread && thread !== threadColor) {
        threadColor = thread;
        return restitch();
      }
      return count;
    },
    setRevealed: stitches.setRevealed,
    dispose: () => {
      stitches.dispose();
      body.dispose();
    },
  };
}
