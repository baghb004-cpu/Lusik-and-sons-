// ============================================================
// RIG — the Armenian Alphabet Blanket
// ============================================================
// The waffle blanket with the customer's chosen alphabet worked into a
// grid of cubes, plus their name and a date. This assembles the cloth,
// the stitches the planner produced, and the fringe, and exposes the
// handful of things the stage needs to drive: restitch on a design
// change, reveal for the stitch-in animation, dispose on unmount.
// ============================================================

import {
  BoxGeometry, Group, Mesh, MeshStandardMaterial, PlaneGeometry,
} from "three";
import { clothMaps } from "../materials/cloth";
import { createStitchMesh, type PlannedStitch, type StitchMeshHandle } from "../stitch/mesh";

export interface BlanketRigOptions {
  /** Grid the design is worked on. The real blanket is 7 by 7 cubes. */
  cols?: number;
  rows?: number;
  /** Body colour of the cloth. */
  clothColor?: string;
  /** Texture resolution from the tier. */
  textureSize?: number;
  /** Most stitches this rig will ever show. */
  capacity?: number;
}

export interface BlanketRig {
  group: Group;
  setStitches: (stitches: PlannedStitch[]) => void;
  setRevealed: (count: number) => void;
  dispose: () => void;
}

export function createBlanketRig(opts: BlanketRigOptions = {}): BlanketRig {
  const {
    cols = 7 * 13,          // 7 cubes across, 13 chart cells each
    rows = 7 * 15,
    clothColor = "#F7F3EA",
    textureSize = 1024,
    capacity = 24000,
  } = opts;

  const group = new Group();

  // One world unit per ~40 chart cells keeps the blanket about 2.2 units
  // wide, which the default camera frames without extra fitting maths.
  const cell = 2.2 / cols;
  const width = cols * cell;
  const height = rows * cell;

  const maps = clothMaps({ weave: "waffle", color: clothColor, size: textureSize, repeat: 7 });
  const clothMaterial = new MeshStandardMaterial({
    map: maps.map,
    normalMap: maps.normalMap,
    roughnessMap: maps.roughnessMap,
    roughness: 0.85,
    metalness: 0,
  });

  // A thin box rather than a plane: the blanket has an edge, and a plane
  // seen from a low camera angle disappears.
  const body = new Mesh(new BoxGeometry(width, cell * 1.2, height), clothMaterial);
  body.receiveShadow = true;
  // Centred over the stitch grid, which spans x 0..width and z 0..height.
  body.position.set(width / 2 - cell / 2, -cell * 0.6, height / 2 - cell / 2);
  group.add(body);

  // Satin backing, visible when the corner pose lifts an edge.
  const backingMaps = clothMaps({ weave: "satin", color: "#EFE2CE", size: Math.max(256, textureSize / 2), repeat: 3 });
  const backing = new Mesh(
    new PlaneGeometry(width, height),
    new MeshStandardMaterial({ map: backingMaps.map, normalMap: backingMaps.normalMap, roughness: 0.3, metalness: 0.02 }),
  );
  backing.rotation.x = Math.PI / 2;
  backing.position.set(body.position.x, -cell * 1.25, body.position.z);
  group.add(backing);

  const stitches: StitchMeshHandle = createStitchMesh(capacity, { cell });
  for (const mesh of stitches.meshes) {
    mesh.position.y = cell * 0.1;
    group.add(mesh);
  }

  const dispose = () => {
    stitches.dispose();
    body.geometry.dispose();
    clothMaterial.dispose();
    backing.geometry.dispose();
    (backing.material as MeshStandardMaterial).dispose();
    group.clear();
  };

  return {
    group,
    setStitches: stitches.setStitches,
    setRevealed: stitches.setRevealed,
    dispose,
  };
}
