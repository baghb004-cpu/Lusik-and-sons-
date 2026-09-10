// ============================================================
// BIB BODY — the piece of cloth both bib rigs are built on
// ============================================================
// Two products are the same bib with different work on it: the Custom
// Name Bib (machine satin script, one colour) and the Hye Em Yes Bib
// (three hand cross-stitched words in the flag colours). Modelling the
// cloth twice would let them drift, and the customer comparing the two
// product pages would be looking at two different bibs.
//
// Proportions are read off public/img/hye-em-bib/02.jpg, which shows the
// piece flat and square on: narrow at the shoulders, flaring to a wide
// bottom with big rounded corners, a satin binding running all the way
// round, and a teardrop neck opening that is narrow at the top and opens
// downward. The earlier shape here was near enough a rounded rectangle
// with a circular neck hole, which read as a coaster.
//
// Built from a Shape with a hole rather than a mesh file: a few hundred
// bytes of code instead of a download, and the proportions stay readable
// and adjustable here rather than locked inside a binary.
// ============================================================

import {
  Color, DoubleSide, ExtrudeGeometry, Group, Mesh, MeshStandardMaterial, Path, Shape,
} from "three";
import { clothMaps } from "../materials/cloth";

// Proportions measured off public/img/hye-em-bib/01.jpg, where the piece
// is flat and square on. Written as fractions of the piece so the numbers
// can be checked against the photograph rather than taken on trust:
//
//   width : height          1.11 : 1   (the bib is WIDER than it is tall)
//   shoulders               0.74 of the full width
//   neck opening            0.23 of the width, from 8% to 38% down
//   lettering baseline      67% down
//
/** Half-width at the widest point, a little below the middle. */
export const HALF_W = 0.86;
/** Half-width across the shoulders. The bib is a trapezoid, not a rectangle. */
export const SHOULDER_W = HALF_W * 0.74;
/** Height follows from the width and the measured aspect. */
const HEIGHT = (HALF_W * 2) / 1.11;
export const TOP = HEIGHT * 0.44;
export const BOTTOM = TOP - HEIGHT;

/** Neck opening: narrow at the top, opening downward like a teardrop. */
const NECK_TOP = TOP - HEIGHT * 0.075;
const NECK_BOTTOM = TOP - HEIGHT * 0.38;
const NECK_HALF = HALF_W * 0.23;

/**
 * The cloth's top surface, in world units. Anything worked ON the bib —
 * a decal plane, a stitch mesh — sits at this height so it is above the
 * terry and its binding rather than inside them.
 *
 * It has to clear the extrusion: laying the shape flat maps the extrude
 * depth plus its bevel onto world y, so the face is at depth+bevel and a
 * value below that buries the work INSIDE the cloth. That is not a
 * z-fight, it is an invisible name — which is exactly how the first
 * render of this rig came out.
 */
const DEPTH = 0.04;
const BEVEL_THICKNESS = 0.018;
export const SURFACE_Y = DEPTH + BEVEL_THICKNESS + 0.018;

export interface BibBodyOptions {
  clothColor?: string;
  /** Satin binding colour. */
  trimColor?: string;
  textureSize?: number;
}

export interface BibBody {
  group: Group;
  extent: { width: number; height: number };
  /**
   * Re-tint the cloth. Cheap, because the weave is a shared white texture
   * and the colour lives on the material — which is what lets a
   * seven-piece set change colourway without rebuilding seven bibs.
   */
  setClothColor: (hex: string) => void;
  dispose: () => void;
}

/**
 * The outline. Shape space is (x, y) with +y toward the shoulders; the
 * geometry is laid flat afterwards, which maps shape y to world -z.
 */
export function bibShape(): Shape {
  const shape = new Shape();
  // Heights down the piece, as fractions of its own height.
  const at = (f: number) => TOP - HEIGHT * f;
  const shoulder = at(0.04);
  const widest = at(0.55);

  // Left shoulder, down the left side, flaring outward to the widest point.
  shape.moveTo(-SHOULDER_W, shoulder);
  shape.bezierCurveTo(
    -HALF_W * 0.94, at(0.16),
    -HALF_W, at(0.36),
    -HALF_W, widest,
  );
  // The hem: broad and softly rounded, not a semicircle.
  shape.bezierCurveTo(
    -HALF_W, at(0.82),
    -HALF_W * 0.78, BOTTOM,
    -HALF_W * 0.42, BOTTOM,
  );
  shape.lineTo(HALF_W * 0.42, BOTTOM);
  shape.bezierCurveTo(
    HALF_W * 0.78, BOTTOM,
    HALF_W, at(0.82),
    HALF_W, widest,
  );
  shape.bezierCurveTo(
    HALF_W, at(0.36),
    HALF_W * 0.94, at(0.16),
    SHOULDER_W, shoulder,
  );
  // Across the shoulders, rising slightly to the top edge either side of
  // the neck.
  shape.quadraticCurveTo(SHOULDER_W * 0.6, TOP, SHOULDER_W * 0.28, TOP);
  shape.lineTo(-SHOULDER_W * 0.28, TOP);
  shape.quadraticCurveTo(-SHOULDER_W * 0.6, TOP, -SHOULDER_W, shoulder);

  shape.holes.push(neckPath());
  return shape;
}

/**
 * The neck opening. Not a circle: the photo shows a keyhole that is
 * pinched at the top, where the two shoulders meet, and rounded at the
 * bottom, where the baby's chin sits.
 */
function neckPath(): Path {
  const neck = new Path();
  const span = NECK_TOP - NECK_BOTTOM;
  // Widest a little above the bottom, tapering to a rounded point at the
  // top where the two shoulders meet.
  const belly = NECK_BOTTOM + span * 0.3;
  neck.moveTo(0, NECK_TOP);
  neck.bezierCurveTo(
    NECK_HALF * 0.42, NECK_TOP,
    NECK_HALF, NECK_BOTTOM + span * 0.62,
    NECK_HALF, belly,
  );
  neck.bezierCurveTo(
    NECK_HALF, NECK_BOTTOM + span * 0.06,
    NECK_HALF * 0.62, NECK_BOTTOM,
    0, NECK_BOTTOM,
  );
  neck.bezierCurveTo(
    -NECK_HALF * 0.62, NECK_BOTTOM,
    -NECK_HALF, NECK_BOTTOM + span * 0.06,
    -NECK_HALF, belly,
  );
  neck.bezierCurveTo(
    -NECK_HALF, NECK_BOTTOM + span * 0.62,
    -NECK_HALF * 0.42, NECK_TOP,
    0, NECK_TOP,
  );
  return neck;
}

/**
 * The world z of a point given its height up the bib.
 *
 * Work is placed on the bib in the shape's own coordinates — the ones the
 * outline above is written in, and therefore the ones a person can check
 * against the photograph. Laying the geometry flat maps shape y to world
 * -z, and doing that flip by hand at each call site is how a decal ends
 * up on the back of the cloth.
 */
export function faceZ(shapeY: number): number {
  return -shapeY;
}

export function createBibBody(opts: BibBodyOptions = {}): BibBody {
  const {
    clothColor = "#FFFFFF",
    trimColor = "#F2F4F8",
    textureSize = 1024,
  } = opts;

  const group = new Group();
  const shape = bibShape();

  // The bevel is the satin binding: on the real piece it is a rolled edge
  // a few millimetres proud of the terry, which is exactly what a bevel
  // reads as at this scale.
  const geometry = new ExtrudeGeometry(shape, {
    depth: DEPTH,
    bevelEnabled: true,
    bevelThickness: BEVEL_THICKNESS,
    bevelSize: 0.022,
    bevelSegments: 3,
    curveSegments: 28,
  });
  // Extrude builds along +z; lay it flat with the face up.
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();

  // The weave is generated WHITE and the colour applied by the material,
  // not baked into the canvas. clothMaps caches per colour, so a
  // seven-bib set in seven pastels would otherwise generate seven
  // 1024-square texture sets — three maps each, tens of megabytes — for
  // seven pieces that differ only in tint.
  const terry = clothMaps({ weave: "terry", color: "#FFFFFF", size: textureSize, repeat: 4 });
  const bodyMaterial = new MeshStandardMaterial({
    map: terry.map,
    normalMap: terry.normalMap,
    roughnessMap: terry.roughnessMap,
    color: new Color(clothColor),
    roughness: 0.95,
    metalness: 0,
    side: DoubleSide,
  });
  const body = new Mesh(geometry, bodyMaterial);
  body.receiveShadow = true;
  group.add(body);

  // The binding, drawn as a second copy of the outline swollen slightly
  // and sitting a hair lower, so the rolled edge catches light the way
  // satin does and the terry does not.
  const bindingGeo = new ExtrudeGeometry(shape, {
    depth: 0.012,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.034,
    bevelSegments: 4,
    curveSegments: 28,
  });
  bindingGeo.rotateX(-Math.PI / 2);
  bindingGeo.computeVertexNormals();
  const satin = clothMaps({ weave: "satin", color: "#FFFFFF", size: Math.max(256, textureSize / 4), repeat: 3 });
  const trimMaterial = new MeshStandardMaterial({
    map: satin.map,
    normalMap: satin.normalMap,
    color: new Color(trimColor),
    roughness: 0.3,
    metalness: 0.03,
    side: DoubleSide,
  });
  const binding = new Mesh(bindingGeo, trimMaterial);
  binding.position.y = -0.006;
  group.add(binding);

  const dispose = () => {
    geometry.dispose();
    bodyMaterial.dispose();
    bindingGeo.dispose();
    trimMaterial.dispose();
    group.clear();
  };

  return {
    group,
    extent: { width: HALF_W * 2, height: TOP - BOTTOM },
    setClothColor: (hex: string) => { bodyMaterial.color.set(hex); },
    dispose,
  };
}
