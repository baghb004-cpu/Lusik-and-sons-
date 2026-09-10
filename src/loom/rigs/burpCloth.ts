// ============================================================
// THE BURP CLOTH
// ============================================================
// A soft terry rectangle, about 10 by 17 inches, finished all the way
// round with crochet picot edging — the little scalloped points that are
// the first thing you notice on the real piece
// (public/img/bari-akhorzhak-set/cover.jpg). It carries the second half
// of the blessing and the same motif as the bib.
//
// The picot is modelled rather than painted: a ring of small spheres
// around the hem. At this scale that is what the eye reads as scalloped
// lace, and a normal map on a flat edge reads as nothing at all.
// ============================================================

import {
  Color, DoubleSide, ExtrudeGeometry, Group, InstancedMesh, Matrix4, Mesh,
  MeshStandardMaterial, Shape, SphereGeometry, Vector3,
} from "three";
import { clothMaps } from "../materials/cloth";
import { createStitchMesh, type PlannedStitch, type StitchMeshHandle } from "../stitch/mesh";

/** Half the cloth's width and depth. Ten by seventeen inches, laid flat. */
export const BURP_HALF_W = 0.52;
export const BURP_HALF_D = 0.88;
const CORNER = 0.16;
const DEPTH = 0.03;
const BEVEL = 0.012;
/** The worked surface, clear of the extrusion and its bevel. */
const SURFACE_Y = DEPTH + BEVEL + 0.016;

const CELL = 0.02;
const CAPACITY = 1600;

export interface BurpClothOptions {
  clothColor?: string;
  trimColor?: string;
  textureSize?: number;
}

export interface BurpCloth {
  group: Group;
  extent: { width: number; depth: number };
  /** Work stitches onto the face. Returns how many. */
  stitch: (planned: PlannedStitch[]) => number;
  setRevealed: (count: number) => void;
  setClothColor: (hex: string) => void;
  dispose: () => void;
}

function clothShape(): Shape {
  const shape = new Shape();
  const w = BURP_HALF_W;
  const d = BURP_HALF_D;
  const r = CORNER;
  shape.moveTo(-w + r, d);
  shape.lineTo(w - r, d);
  shape.quadraticCurveTo(w, d, w, d - r);
  shape.lineTo(w, -d + r);
  shape.quadraticCurveTo(w, -d, w - r, -d);
  shape.lineTo(-w + r, -d);
  shape.quadraticCurveTo(-w, -d, -w, -d + r);
  shape.lineTo(-w, d - r);
  shape.quadraticCurveTo(-w, d, -w + r, d);
  return shape;
}

/** Points evenly spaced round the hem, for the picot. */
function hemPoints(count: number): Vector3[] {
  const pts = clothShape().getSpacedPoints(count);
  return pts.map((p) => new Vector3(p.x, 0, -p.y));
}

export function createBurpCloth(opts: BurpClothOptions = {}): BurpCloth {
  const { clothColor = "#FFFFFF", trimColor, textureSize = 512 } = opts;
  const group = new Group();

  const geometry = new ExtrudeGeometry(clothShape(), {
    depth: DEPTH,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 2,
    curveSegments: 12,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();

  const terry = clothMaps({ weave: "terry", color: "#FFFFFF", size: textureSize, repeat: 3 });
  const material = new MeshStandardMaterial({
    map: terry.map,
    normalMap: terry.normalMap,
    roughnessMap: terry.roughnessMap,
    color: new Color(clothColor),
    roughness: 0.95,
    metalness: 0,
    side: DoubleSide,
  });
  group.add(new Mesh(geometry, material));

  // The picot edging: one small bead per hem point, instanced so the
  // whole scalloped border is a single draw call.
  const PICOT = 96;
  const beadGeo = new SphereGeometry(0.026, 6, 5);
  const beadMaterial = new MeshStandardMaterial({
    color: new Color(trimColor ?? clothColor),
    roughness: 0.6,
    metalness: 0,
  });
  const picot = new InstancedMesh(beadGeo, beadMaterial, PICOT);
  const m = new Matrix4();
  hemPoints(PICOT).forEach((p, i) => {
    // Sitting on the hem line at the cloth's mid-thickness, so each bead
    // reads as a little scallop hanging off the edge rather than a bump
    // on the face.
    m.makeTranslation(p.x, DEPTH * 0.4, p.z);
    picot.setMatrixAt(i, m);
  });
  picot.instanceMatrix.needsUpdate = true;
  picot.frustumCulled = false;
  group.add(picot);

  // The lettering.
  const pivot = new Group();
  const inner = new Group();
  const stitches: StitchMeshHandle = createStitchMesh(CAPACITY, { cell: CELL });
  for (const mesh of stitches.meshes) inner.add(mesh);
  pivot.add(inner);
  pivot.position.y = SURFACE_Y;
  // The words run along the cloth's LONG axis. The shape is a portrait
  // rectangle — ten inches by seventeen — and the set lays it down
  // landscape, so text laid out across the short axis comes out reading
  // sideways once the cloth is turned.
  //
  // MINUS a quarter turn, not plus. Under +90° the text's advance
  // direction lands on -z, and once the cloth is turned to landscape that
  // points leftward: the blessing came out running right to left, which
  // in Armenian is not a stylistic choice.
  pivot.rotation.y = -Math.PI / 2;
  group.add(pivot);

  const stitch = (planned: PlannedStitch[]): number => {
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
    // Fitted to the long axis across and the short axis down, because the
    // stitch plane is turned a quarter turn above.
    const scale = Math.min(
      (BURP_HALF_D * 2 * 0.74) / (cellsW * CELL),
      (BURP_HALF_W * 2 * 0.46) / (cellsH * CELL),
    );
    pivot.scale.setScalar(scale);
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
    extent: { width: BURP_HALF_W * 2, depth: BURP_HALF_D * 2 },
    stitch,
    setRevealed: stitches.setRevealed,
    setClothColor: (hex: string) => {
      material.color.set(hex);
      if (!trimColor) beadMaterial.color.set(hex);
    },
    dispose: () => {
      stitches.dispose();
      geometry.dispose();
      material.dispose();
      beadGeo.dispose();
      beadMaterial.dispose();
      picot.dispose();
      group.clear();
    },
  };
}
