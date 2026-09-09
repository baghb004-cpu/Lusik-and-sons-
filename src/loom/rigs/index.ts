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
import { planDesignFor } from "../design";
import type { BibDesign, LoomDesign } from "../types";

export interface MountedRig {
  group: Group;
  /**
   * Apply a design and return how many stitches can be revealed.
   * 0 means the piece has nothing to work in progressively.
   */
  apply: (design: LoomDesign | BibDesign) => number;
  setRevealed?: (count: number) => void;
  dispose: () => void;
}

export interface RigOptions {
  textureSize: number;
  clothColor?: string;
}

function isBibDesign(design: LoomDesign | BibDesign): design is BibDesign {
  return typeof (design as BibDesign).name === "string";
}

/** Null when the product has no rig yet — the stage stays on its poster. */
export function createRigFor(productKey: string, opts: RigOptions): MountedRig | null {
  if (productKey === "blanket-classic") {
    const rig = createBlanketRig({ textureSize: opts.textureSize, clothColor: opts.clothColor });
    return {
      group: rig.group,
      apply: (design) => {
        if (isBibDesign(design)) return 0;
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

  return null;
}
