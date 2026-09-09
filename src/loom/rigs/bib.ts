// ============================================================
// RIG — the terry bib
// ============================================================
// A bib is not a rectangle, and modelling it as one would make the whole
// engine look like a mock-up. The real piece (public/img/days-bib/02.jpg,
// hye-em-bib/cover.jpg) is a rounded body, a little wider at the bottom,
// with a neck opening at the top and a satin binding running all the way
// round including the neck.
//
// Built from a Shape with a hole rather than a mesh file: it stays a few
// hundred bytes of code instead of a download, and the proportions are
// readable and adjustable here rather than locked in a binary.
// ============================================================

import {
  DoubleSide, ExtrudeGeometry, Group, Mesh, MeshStandardMaterial, Path,
  PlaneGeometry, Shape, TorusGeometry,
} from "three";
import { clothMaps } from "../materials/cloth";
import { scriptDecal, type ScriptDecal } from "../stitch/script";
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

/** Half-width at the widest point. The bib is about 1.6 units across. */
const HALF_W = 0.8;
const TOP = 0.9;
const BOTTOM = -1.0;
const NECK_R = 0.26;

function bibShape(): Shape {
  const shape = new Shape();
  // Start at the top-left of the shoulder and run clockwise.
  shape.moveTo(-HALF_W * 0.72, TOP);
  shape.quadraticCurveTo(-HALF_W, TOP * 0.55, -HALF_W, 0.1);
  // The body flares slightly toward the bottom, then rounds off.
  shape.quadraticCurveTo(-HALF_W * 1.02, BOTTOM * 0.55, -HALF_W * 0.62, BOTTOM * 0.92);
  shape.quadraticCurveTo(0, BOTTOM * 1.12, HALF_W * 0.62, BOTTOM * 0.92);
  shape.quadraticCurveTo(HALF_W * 1.02, BOTTOM * 0.55, HALF_W, 0.1);
  shape.quadraticCurveTo(HALF_W, TOP * 0.55, HALF_W * 0.72, TOP);
  // The shoulders dip toward the neck.
  shape.quadraticCurveTo(HALF_W * 0.4, TOP * 1.02, 0, TOP * 0.98);
  shape.quadraticCurveTo(-HALF_W * 0.4, TOP * 1.02, -HALF_W * 0.72, TOP);

  // The neck opening.
  const neck = new Path();
  neck.absarc(0, TOP * 0.62, NECK_R, 0, Math.PI * 2, true);
  shape.holes.push(neck);
  return shape;
}

export function createBibRig(opts: BibRigOptions = {}): BibRig {
  const {
    clothColor = "#FFFFFF",
    trimColor = "#DFE7F2",
    textureSize = 1024,
  } = opts;

  const group = new Group();
  const shape = bibShape();

  const geometry = new ExtrudeGeometry(shape, {
    depth: 0.045,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 2,
    curveSegments: 24,
  });
  // Extrude builds along +z; lay it flat with the face up.
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();

  const terry = clothMaps({ weave: "terry", color: clothColor, size: textureSize, repeat: 4 });
  const bodyMaterial = new MeshStandardMaterial({
    map: terry.map,
    normalMap: terry.normalMap,
    roughnessMap: terry.roughnessMap,
    roughness: 0.95,
    metalness: 0,
    side: DoubleSide,
  });
  const body = new Mesh(geometry, bodyMaterial);
  body.receiveShadow = true;
  group.add(body);

  // Satin binding around the neck. The outer edge binding is suggested by
  // the bevel; the neck ring is the piece the eye actually checks.
  const satin = clothMaps({ weave: "satin", color: trimColor, size: 256, repeat: 2 });
  const trimMaterial = new MeshStandardMaterial({
    map: satin.map,
    normalMap: satin.normalMap,
    roughness: 0.28,
    metalness: 0.03,
  });
  const neckTrim = new Mesh(new TorusGeometry(NECK_R, 0.022, 8, 48), trimMaterial);
  neckTrim.rotation.x = Math.PI / 2;
  neckTrim.position.set(0, 0.03, -TOP * 0.62);
  group.add(neckTrim);

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
  namePlane.position.set(0, 0.06, 0.12);
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
    fonts.load('400 48px "Allura"').then(() => {
      if (disposed || lastDesign !== design) return;
      draw(design);
    }).catch(() => { /* no Allura: the fallback face still reads as a name */ });
  };

  const dispose = () => {
    disposed = true;
    geometry.dispose();
    bodyMaterial.dispose();
    neckTrim.geometry.dispose();
    trimMaterial.dispose();
    panelGeo.dispose();
    nameMaterial.dispose();
    decal?.map.dispose();
    decal?.normalMap.dispose();
    group.clear();
  };

  return {
    group,
    extent: { width: HALF_W * 2, height: TOP - BOTTOM },
    setDesign,
    dispose,
  };
}
