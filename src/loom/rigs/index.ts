// ============================================================
// RIG REGISTRY — productKey to a mounted piece
// ============================================================
// LoomStage should not know that a blanket is cross-stitched and a bib is
// machine embroidered. It asks for the rig for a product key and gets one
// shape back: something with a group, a way to apply a design, and a way
// to dispose of it.
//
// The two techniques really are different — the blanket plans thousands
// of individual stitches and can replay them in working order, the bib
// draws one decal — so `apply` reports how many stitches there are to
// reveal. Zero means there is nothing to animate, which is the honest
// answer for a decal rather than a special case in the stage.
// ============================================================

import type { Group } from "three";
import { createBlanketRig } from "./alphabetBlanket";
import { createBibRig } from "./bib";
import { createHyeEmYesRig } from "./hyeEmYes";
import { createBibSetRig, type BibSetDesign } from "./bibSet";
import { createBariRig, type BariDesign } from "./bariAkhorzhak";
import { createCribBlanketRig, type CribBlanketDesign } from "./cribBlanket";
import { ANUSHIG_PAIR, DAYS_OF_WEEK } from "../../data/setBibs.js";
import { planDesignFor } from "../design";
import type { BibDesign, HyeEmYesDesign, LoomDesign } from "../types";

/** Every design shape a rig can be handed. */
export type AnyDesign =
  | LoomDesign | BibDesign | HyeEmYesDesign | BibSetDesign | BariDesign | CribBlanketDesign;

export interface MountedRig {
  group: Group;
  /**
   * Apply a design and return how many stitches can be revealed.
   * 0 means the piece has nothing to work in progressively.
   */
  apply: (design: AnyDesign) => number;
  setRevealed?: (count: number) => void;
  /**
   * Register a callback for when the rig re-plans on its own, reporting
   * the new stitch total.
   *
   * A rig can restitch without the design changing: the letterforms come
   * out of the webfont, so the piece is planned once in the fallback face
   * and again when the real one arrives. The stage is animating that
   * stitch list in, and if it is still holding the OLD total the reveal
   * stops partway and the rest of the piece never appears — which is
   * exactly how the Hye Em Yes bib first rendered, showing a fragment of
   * each letter and looking, convincingly, like a broken chart.
   */
  onRestitch?: (cb: (total: number) => void) => void;
  dispose: () => void;
}

export interface RigOptions {
  textureSize: number;
  clothColor?: string;
}

function isBibDesign(design: AnyDesign): design is BibDesign {
  return typeof (design as BibDesign).name === "string";
}

/**
 * A blanket design is the one with letters to work into cubes. Checking
 * for what a rig NEEDS, rather than for what the others are, is what keeps
 * a new design shape from silently falling into the wrong branch.
 */
function isBlanketDesign(design: AnyDesign): design is LoomDesign {
  return Array.isArray((design as LoomDesign).letters);
}

/** Null when the product has no rig yet — the stage stays on its poster. */
export function createRigFor(productKey: string, opts: RigOptions): MountedRig | null {
  if (productKey === "blanket-classic") {
    const rig = createBlanketRig({ textureSize: opts.textureSize, clothColor: opts.clothColor });
    return {
      group: rig.group,
      apply: (design) => {
        if (!isBlanketDesign(design)) return 0;
        const planned = planDesignFor(design).stitches;
        rig.setStitches(planned);
        return planned.length;
      },
      setRevealed: rig.setRevealed,
      dispose: rig.dispose,
    };
  }

  if (productKey === "bib") {
    const rig = createBibRig({ textureSize: opts.textureSize, clothColor: opts.clothColor });
    return {
      group: rig.group,
      apply: (design) => {
        if (!isBibDesign(design)) return 0;
        rig.setDesign(design);
        // A decal is not worked in stitch by stitch; it is embroidered by
        // machine in one pass. Pretending otherwise would be a lie about
        // how the piece is made.
        return 0;
      },
      dispose: rig.dispose,
    };
  }

  // Both SKUs are the same piece; the "-with-cap" key is what the server
  // charges the higher price against, and the cap is a property of the
  // design rather than of the rig.
  if (productKey === "bib-hy-em" || productKey === "bib-hy-em-with-cap") {
    const rig = createHyeEmYesRig({ textureSize: opts.textureSize, clothColor: opts.clothColor });
    return {
      group: rig.group,
      apply: (design) => rig.setDesign({
        // Nothing else on this product is chosen, so anything that is not
        // an explicit yes is the bib on its own.
        withCap: (design as HyeEmYesDesign).withCap === true,
      }),
      setRevealed: rig.setRevealed,
      onRestitch: rig.onRestitch,
      dispose: rig.dispose,
    };
  }

  // ── The sets ──────────────────────────────────────────
  // Seven day bibs and the Mama-and-Papa pair are the same rig: hand
  // cross-stitched bibs laid out and shrunk to fit the frame. What
  // differs is the words, the arrangement, and whether a motif goes
  // between the lines.
  if (productKey === "bib-days-of-week") {
    return mountSet(createBibSetRig({
      pieces: [...DAYS_OF_WEEK],
      // Three, three and one — how the seven are photographed together.
      perRow: 3,
      textureSize: opts.textureSize,
      textWidth: 0.78,
    }));
  }

  if (productKey === "bib-anushig-pair") {
    return mountSet(createBibSetRig({
      pieces: [...ANUSHIG_PAIR],
      perRow: 2,
      // A small motif worked between the two lines, as the photograph shows.
      motif: "heart",
      textureSize: opts.textureSize,
      textWidth: 0.74,
    }));
  }

  // Both SKUs are the same three pieces; the cap is a property of the
  // design, and the "-with-cap" key is what the server charges against.
  if (productKey === "bib-bari-akhorzhak-set" || productKey === "bib-bari-akhorzhak-set-with-cap") {
    const rig = createBariRig({ textureSize: opts.textureSize });
    return {
      group: rig.group,
      apply: (design) => rig.apply(design as BariDesign),
      setRevealed: rig.setRevealed,
      onRestitch: rig.onRestitch,
      dispose: rig.dispose,
    };
  }

  if (productKey === "blanket-full-alphabet") {
    const rig = createCribBlanketRig({ textureSize: opts.textureSize, clothColor: opts.clothColor });
    return {
      group: rig.group,
      apply: (design) => rig.apply(design as CribBlanketDesign),
      setRevealed: rig.setRevealed,
      onRestitch: rig.onRestitch,
      dispose: rig.dispose,
    };
  }

  return null;
}

/** A set rig already has the shape the stage wants; this only narrows the design. */
function mountSet(rig: ReturnType<typeof createBibSetRig>): MountedRig {
  return {
    group: rig.group,
    apply: (design) => rig.apply(design as BibSetDesign),
    setRevealed: rig.setRevealed,
    onRestitch: rig.onRestitch,
    dispose: rig.dispose,
  };
}
