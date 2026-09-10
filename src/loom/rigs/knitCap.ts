// ============================================================
// THE KNIT CAP
// ============================================================
// The same little beanie is the add-on for two products: it carries the
// Armenian flag on the Hye Em Yes bib, and the baby's name or initial on
// the Bari Akhorzhak set. One cap, two things stitched on its cuff.
//
// A lathe rather than a sphere: a beanie's profile has a nearly straight
// side and a rounded crown, and a hemisphere reads as a bowl.
// References: public/img/hye-em-bib/02.jpg and
// public/img/bari-akhorzhak-set/cover.jpg.
// ============================================================

import {
  BackSide, CircleGeometry, CylinderGeometry, Group, LatheGeometry, Mesh,
  MeshStandardMaterial, Vector2,
} from "three";
import { clothMaps } from "../materials/cloth";
import { createStitchMesh, type PlannedStitch, type StitchMeshHandle } from "../stitch/mesh";

export const CAP_R = 0.42;
export const CAP_HEIGHT = 0.62;
/** The turned-up cuff, deep enough to carry what is worked on it. */
export const CUFF_H = 0.22;
/** How far the stitching stands proud of the cuff's front face. */
export const CUFF_FACE = CAP_R * 1.13;

/** Cell size the cuff's stitches are planned at, before fitting. */
const CELL = 0.02;
/** Nothing on a cuff is bigger than a short name or a small flag. */
const CAPACITY = 900;

export interface KnitCapOptions {
  clothColor?: string;
  textureSize?: number;
}

export interface KnitCap {
  group: Group;
  /** Work something onto the front of the cuff. Returns the stitch count. */
  stitchCuff: (stitches: PlannedStitch[], widthFraction?: number) => number;
  setRevealed: (count: number) => void;
  dispose: () => void;
}

function capProfile(): Vector2[] {
  // From the bottom of the cuff up over the crown. The last point sits on
  // the axis so the lathe closes rather than leaving a hole at the top.
  return [
    new Vector2(CAP_R, 0),
    new Vector2(CAP_R * 0.99, CAP_HEIGHT * 0.42),
    new Vector2(CAP_R * 0.94, CAP_HEIGHT * 0.66),
    new Vector2(CAP_R * 0.78, CAP_HEIGHT * 0.85),
    new Vector2(CAP_R * 0.46, CAP_HEIGHT * 0.97),
    new Vector2(0, CAP_HEIGHT),
  ];
}

export function createKnitCap(opts: KnitCapOptions = {}): KnitCap {
  const { clothColor = "#FFFFFF", textureSize = 1024 } = opts;
  const group = new Group();

  // White weave tinted by the material, so a cap in a colourway costs no
  // extra texture — the same reason the bib body works this way.
  const knit = clothMaps({
    weave: "terry",
    color: "#FFFFFF",
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
  material.color.set(clothColor);

  const crownGeo = new LatheGeometry(capProfile(), 40);
  group.add(new Mesh(crownGeo, material));

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
  cuffMaterial.color.set(clothColor);
  const cuff = new Mesh(cuffGeo, cuffMaterial);
  cuff.position.y = CUFF_H / 2;
  group.add(cuff);
  // The cuff is open-ended, so its inside faces away from the camera and
  // would be culled, leaving a see-through band. A back-side copy closes it.
  const innerMaterial = new MeshStandardMaterial({
    map: knit.map, normalMap: knit.normalMap, roughness: 0.95, metalness: 0, side: BackSide,
  });
  innerMaterial.color.set(clothColor);
  const cuffInner = new Mesh(cuffGeo, innerMaterial);
  cuffInner.position.y = CUFF_H / 2;
  group.add(cuffInner);

  // A real beanie is open at the bottom, but this one is lying on a table
  // and tipped back: leaving it open shows the inside of the lathe as a
  // dark notch under the brim, which reads as a hole in the cap.
  const baseGeo = new CircleGeometry(CAP_R * 1.11, 40);
  baseGeo.rotateX(Math.PI / 2);
  const base = new Mesh(baseGeo, innerMaterial);
  base.position.y = 0.004;
  group.add(base);

  // Whatever is worked on the front of the cuff.
  const pivot = new Group();
  const inner = new Group();
  const stitches: StitchMeshHandle = createStitchMesh(CAPACITY, { cell: CELL });
  for (const mesh of stitches.meshes) inner.add(mesh);
  pivot.add(inner);
  // Stand the stitch plane up to face the camera: rotating +90° about X
  // maps a chart row (increasing z) onto decreasing world y, so it reads
  // the right way up rather than mirrored top to bottom.
  pivot.rotation.x = Math.PI / 2;
  pivot.position.set(0, CUFF_H * 0.5, CUFF_FACE);
  group.add(pivot);

  const stitchCuff = (planned: PlannedStitch[], widthFraction = 0.5): number => {
    if (planned.length === 0) {
      stitches.setStitches([]);
      return 0;
    }
    let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
    for (const s of planned) {
      if (s.x < minX) minX = s.x;
      if (s.x > maxX) maxX = s.x;
      if (s.y < minY) minY = s.y;
      if (s.y > maxY) maxY = s.y;
    }
    const cellsW = maxX - minX + 1;
    const cellsH = maxY - minY + 1;
    // Fit by whichever axis runs out first: a long name fitted only by
    // width would stand taller than the cuff it is stitched on.
    const scale = Math.min(
      (CAP_R * 2 * widthFraction) / (cellsW * CELL),
      (CUFF_H * 0.78) / (cellsH * CELL),
    );
    pivot.scale.setScalar(scale);
    // Offsets in the stitch plane's own coordinates, inside the rotation
    // and the scale — applying them outside puts the work beside the cap.
    inner.position.set(
      -(minX * CELL + (cellsW * CELL) / 2),
      0,
      -(minY * CELL + (cellsH * CELL) / 2),
    );
    stitches.setStitches(planned);
    return planned.length;
  };

  return {
    group,
    stitchCuff,
    setRevealed: stitches.setRevealed,
    dispose: () => {
      stitches.dispose();
      crownGeo.dispose();
      cuffGeo.dispose();
      baseGeo.dispose();
      material.dispose();
      cuffMaterial.dispose();
      innerMaterial.dispose();
      group.clear();
    },
  };
}
