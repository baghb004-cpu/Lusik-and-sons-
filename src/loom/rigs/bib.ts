// ============================================================
// RIG — the Custom Name Bib
// ============================================================
// The cloth comes from bibBody.ts, shared with the Hye Em Yes bib. What
// belongs to THIS product is the work on it: one name, machine satin
// stitched in a single thread colour, across the belly of the bib.
//
// Machine embroidery is drawn as a decal rather than planned as stitches
// on purpose. The Custom Name Bib really is done by machine — that is
// what makes it survive a hundred and fifty wash cycles a year — and a
// grid of hand crosses would be a picture of a different product.
// ============================================================

import { Group, Mesh, MeshStandardMaterial, PlaneGeometry } from "three";
import { createBibBody, faceZ, HALF_W, SURFACE_Y, type BibBody } from "./bibBody";
import { SCRIPT_FONT_STACK, scriptDecal, type ScriptDecal } from "../stitch/script";
import type { BibDesign } from "../types";

export interface BibRigOptions {
  /** Body colour of the terry. */
  clothColor?: string;
  /** Satin binding colour. */
  trimColor?: string;
  textureSize?: number;
}

export type { BibDesign };

export interface BibRig {
  group: Group;
  extent: { width: number; height: number };
  setDesign: (design: BibDesign) => void;
  dispose: () => void;
}

export function createBibRig(opts: BibRigOptions = {}): BibRig {
  const body: BibBody = createBibBody(opts);
  const group = body.group;

  // The embroidered name sits on its own thin plane just above the terry,
  // so it can be swapped without touching the body.
  let decal: ScriptDecal | null = null;
  const nameMaterial = new MeshStandardMaterial({
    transparent: true,
    roughness: 0.45,
    metalness: 0,
    // Embroidery sits ON the cloth; without this it z-fights with it.
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  // A wide, short panel across the belly of the bib, where Lusik stitches
  // the name on the real piece.
  //
  // PlaneGeometry, NOT ExtrudeGeometry. Extrude's default UV generator
  // emits the shape's own coordinates as UVs rather than 0..1, so the
  // decal came out stretched to a single edge pixel and the name was
  // simply absent from the render. A plane gives the 0..1 UVs a decal
  // needs, and the panel has no depth worth extruding anyway.
  // Narrower than the bib is wide at this height, so a long name is
  // scaled down to fit the CLOTH rather than running off its edge. The
  // decal fits the text to the panel; the panel has to fit the bib.
  const panelGeo = new PlaneGeometry(HALF_W * 1.42, 0.4);
  panelGeo.rotateX(-Math.PI / 2);
  const namePlane = new Mesh(panelGeo, nameMaterial);
  // Shape y -0.38 is where the photographs put the lettering.
  namePlane.position.set(0, SURFACE_Y, faceZ(-0.38));
  group.add(namePlane);

  let lastDesign: BibDesign | null = null;
  let disposed = false;

  const draw = (design: BibDesign) => {
    decal?.map.dispose();
    decal?.normalMap.dispose();
    decal = scriptDecal({ text: design.name, color: design.threadColor });
    nameMaterial.map = decal.map;
    nameMaterial.normalMap = decal.normalMap;
    // An empty name means bare cloth, not an invisible black rectangle.
    nameMaterial.opacity = decal.hasInk ? 1 : 0;
    nameMaterial.needsUpdate = true;
  };

  const setDesign = (design: BibDesign) => {
    lastDesign = design;
    draw(design);

    // Canvas does not wait for webfonts. If Allura has not arrived yet the
    // name is drawn in the fallback serif — which looks like print, not
    // like machine embroidery, and would quietly ship that way. Ask for
    // the face and redraw once it lands.
    //
    // document.fonts.check() is not a reliable guard here: for a family
    // with no matching @font-face it can report true because a fallback
    // exists, which is exactly what happened while developing this.
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    if (!fonts?.load) return;
    Promise.all([
      fonts.load(`400 48px ${SCRIPT_FONT_STACK}`, "BESbswy"),
      // No text argument means the probe string "BESbswy", which is Latin
      // — so an Armenian name used to wait on a file that has none of its
      // letters in it and redraw before its own face arrived.
      fonts.load(`400 48px ${SCRIPT_FONT_STACK}`, "\u0531\u0532\u0533"),
    ]).then(() => {
      if (disposed || lastDesign !== design) return;
      draw(design);
    }).catch(() => { /* no Allura: the fallback face still reads as a name */ });
  };

  const dispose = () => {
    disposed = true;
    panelGeo.dispose();
    nameMaterial.dispose();
    decal?.map.dispose();
    decal?.normalMap.dispose();
    body.dispose();
  };

  return {
    group,
    extent: body.extent,
    setDesign,
    dispose,
  };
}
