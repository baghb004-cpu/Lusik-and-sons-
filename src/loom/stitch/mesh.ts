// ============================================================
// STITCH MESH — one instanced X, drawn thousands of times
// ============================================================
// A full alphabet blanket is tens of thousands of stitches. One Mesh per
// stitch would be tens of thousands of draw calls and would not hold a
// frame rate on anything. So there is ONE small geometry (two crossed
// strands) drawn as an InstancedMesh, with a per-instance colour so the
// customer's chosen thread colours cost nothing extra.
//
// The planner (planner.js) decides which stitches exist and in what
// order; this only puts them in space. Keeping those apart is what lets
// the interesting half be unit-tested in Node.
// ============================================================

import {
  BufferGeometry, Color, CylinderGeometry, DynamicDrawUsage, InstancedMesh,
  Matrix4, MeshStandardMaterial, Quaternion, Vector3,
} from "three";

/** A stitch as the planner emits it. */
export interface PlannedStitch {
  x: number;
  y: number;
  sym: string;
  color: string;
  order: number;
}

export interface StitchMeshOptions {
  /** Width of one grid cell in world units. */
  cell: number;
  /** How thick a strand reads. Fraction of a cell. */
  thickness?: number;
  /** Radial segments per strand. 4 is plenty at this scale; 3 on mid. */
  segments?: number;
}

/**
 * One arm of a cross: a slightly flattened cylinder laid along the
 * diagonal. Two of these crossed is a cross stitch; real floss is a
 * two-ply twist, which the normal map on the material fakes.
 */
function strandGeometry(cell: number, thickness: number, segments: number): BufferGeometry {
  const length = cell * Math.SQRT2 * 0.92;
  const geo = new CylinderGeometry(cell * thickness, cell * thickness, length, segments, 1);
  // Cylinders are built along Y; the instance matrix rotates them.
  geo.computeVertexNormals();
  return geo;
}

export interface StitchMeshHandle {
  /** Both arms of the cross, as two instanced meshes sharing a material. */
  meshes: InstancedMesh[];
  /** Re-place every instance from a planned stitch list. */
  setStitches: (stitches: PlannedStitch[]) => void;
  /**
   * Reveal the first `count` stitches in planner order; the rest are
   * scaled to zero. Drives the stitch-in animation.
   */
  setRevealed: (count: number) => void;
  /** Where the first worked stitch sits, in this mesh's own space. */
  firstStitchPosition: () => [number, number, number] | null;
  dispose: () => void;
}

const UP = new Vector3(0, 1, 0);
const DIAG_A = new Vector3(1, 0, 1).normalize();
const DIAG_B = new Vector3(1, 0, -1).normalize();

/**
 * @param capacity the most stitches this mesh will ever hold. Growing an
 *   InstancedMesh means reallocating, so the rig sizes it once from the
 *   grid rather than per keystroke.
 */
export function createStitchMesh(capacity: number, opts: StitchMeshOptions): StitchMeshHandle {
  const { cell, thickness = 0.09, segments = 4 } = opts;
  const geometry = strandGeometry(cell, thickness, segments);
  const material = new MeshStandardMaterial({ roughness: 0.62, metalness: 0 });

  const armA = new InstancedMesh(geometry, material, capacity);
  const armB = new InstancedMesh(geometry, material, capacity);
  for (const mesh of [armA, armB]) {
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.count = 0;
    mesh.frustumCulled = false;
  }

  const matrix = new Matrix4();
  const quat = new Quaternion();
  const position = new Vector3();
  const scale = new Vector3(1, 1, 1);
  const color = new Color();

  let current: PlannedStitch[] = [];

  const place = (mesh: InstancedMesh, i: number, s: PlannedStitch, axis: Vector3, visible: boolean) => {
    // Grid coords are (column, row) with row 0 at the TOP of the chart, and
    // the piece is laid out with its top edge furthest from the camera. The
    // camera sits at +z looking toward -z, so "further away" is SMALLER z:
    // row 0 belongs at z = 0 and later rows come toward the viewer.
    //
    // Negating y here (which reads plausible, and is what this did first)
    // puts row 0 nearest the camera, which renders every letter upside
    // down and the alphabet row below the date instead of above it.
    position.set(s.x * cell, 0, s.y * cell);
    quat.setFromUnitVectors(UP, axis);
    const k = visible ? 1 : 0;
    scale.set(k, k, k);
    matrix.compose(position, quat, scale);
    mesh.setMatrixAt(i, matrix);
    mesh.setColorAt(i, color.set(s.color));
  };

  const setStitches = (stitches: PlannedStitch[]) => {
    current = stitches.slice(0, capacity);
    for (let i = 0; i < current.length; i += 1) {
      place(armA, i, current[i], DIAG_A, true);
      place(armB, i, current[i], DIAG_B, true);
    }
    armA.count = current.length;
    armB.count = current.length;
    revealed = current.length; // setStitches shows everything; the caller
                               // calls setRevealed(0) to animate it in.
    armA.instanceMatrix.needsUpdate = true;
    armB.instanceMatrix.needsUpdate = true;
    if (armA.instanceColor) armA.instanceColor.needsUpdate = true;
    if (armB.instanceColor) armB.instanceColor.needsUpdate = true;
  };

  // How many stitches are currently shown. Tracked so a reveal only
  // touches the stitches that actually changed state.
  let revealed = 0;

  const setRevealed = (count: number) => {
    const shown = Math.max(0, Math.min(Math.floor(count), current.length));
    if (shown === revealed) return;

    // Rewriting every instance matrix each frame is O(n) per frame, and n
    // is tens of thousands on a full alphabet blanket — that alone would
    // miss the frame budget the animation exists to look good within.
    // Only the stitches crossing the threshold need touching.
    const from = Math.min(revealed, shown);
    const to = Math.max(revealed, shown);
    for (let i = from; i < to; i += 1) {
      const visible = i < shown;
      place(armA, i, current[i], DIAG_A, visible);
      place(armB, i, current[i], DIAG_B, visible);
    }
    revealed = shown;
    armA.instanceMatrix.needsUpdate = true;
    armB.instanceMatrix.needsUpdate = true;
  };

  const dispose = () => {
    geometry.dispose();
    material.dispose();
    armA.dispose();
    armB.dispose();
  };

  /**
   * Where the first stitch sits, in the mesh's own space, or null when
   * nothing is worked yet.
   *
   * The FIRST one rather than the centroid: the planner orders stitches
   * the way a person works them, so the first one is the start of the
   * first letter and is guaranteed to be on stitching. A centroid is
   * not — two symmetric diagonals average to the bare middle of the
   * piece.
   */
  const firstStitchPosition = (): [number, number, number] | null => {
    const s = current[0];
    return s ? [s.x * cell, 0, s.y * cell] : null;
  };

  return { meshes: [armA, armB], setStitches, setRevealed, firstStitchPosition, dispose };
}
