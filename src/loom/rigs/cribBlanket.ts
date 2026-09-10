// ============================================================
// RIG — the Full Alphabet Crib Blanket
// ============================================================
// A hand-knit blanket, roughly 30 by 36 inches, with the whole Armenian
// alphabet worked into a grid of six squares by seven, a crochet picot
// edge all the way round, and a satin backing matched to the thread.
// References: public/img/full-alphabet/12.jpg and 55.jpg.
//
// Different cloth from everything else in the shop: knit, not terry or
// waffle, and the customer's colour is the THREAD and the EDGE rather
// than the body — both photographs show a cream blanket with the chosen
// colour worked onto it, which is the opposite of what "body colour" in
// the product copy suggests and is what the pieces actually look like.
// ============================================================

import {
  Color, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial,
  PlaneGeometry, SphereGeometry, BoxGeometry,
} from "three";
import { clothMaps } from "../materials/cloth";
import { createStitchMesh, type StitchMeshHandle } from "../stitch/mesh";
import { planCribBlanket, planStitchedLines } from "../design";
import { clearChartCache } from "../stitch/rasterize.js";

export interface CribBlanketDesign {
  /** The colourway swatch, as the product JSON stores it. */
  swatch?: { color?: string; dual?: string[] } | null;
  /** Optional name for the free square. */
  name?: string;
}

export interface CribBlanketRigOptions {
  textureSize?: number;
  /** The knit itself. Cream on every photographed piece. */
  clothColor?: string;
}

export interface CribBlanketRig {
  group: Group;
  apply: (design: CribBlanketDesign) => number;
  setRevealed: (count: number) => void;
  onRestitch: (cb: (total: number) => void) => void;
  dispose: () => void;
}

// Thirty by thirty-six inches, in stage units, laid flat. Sized so the
// whole piece — the picot edge included — fits the frame the camera pose
// shows, which is about 1.9 across and 1.9 deep once the near edge's
// perspective is allowed for. A blanket scaled to its real proportion of
// a bib runs its front hem out of the bottom of the picture.
const HEIGHT = 1.82;
const WIDTH = HEIGHT * (30 / 36);
const THICKNESS = 0.05;

/** The whole alphabet plus a grid is thousands of stitches. */
const CAPACITY = 9000;

const DEFAULT_CLOTH = "#F6F1E4";
const DEFAULT_THREAD = "#93B7D5";

/** How much of the blanket the worked grid covers, inside its border. */
const GRID_INSET = 0.86;

export function createCribBlanketRig(opts: CribBlanketRigOptions = {}): CribBlanketRig {
  const { textureSize = 1024, clothColor = DEFAULT_CLOTH } = opts;
  const group = new Group();

  // ---- the knit body ----
  const knit = clothMaps({ weave: "knit", color: "#FFFFFF", size: textureSize, repeat: 8 });
  const bodyMaterial = new MeshStandardMaterial({
    map: knit.map,
    normalMap: knit.normalMap,
    roughnessMap: knit.roughnessMap,
    color: new Color(clothColor),
    roughness: 0.9,
    metalness: 0,
    side: DoubleSide,
  });
  // A thin box rather than a plane: the blanket has an edge, and a plane
  // seen from the stage's low camera angle disappears.
  const bodyGeo = new BoxGeometry(WIDTH, THICKNESS, HEIGHT);
  const body = new Mesh(bodyGeo, bodyMaterial);
  body.receiveShadow = true;
  group.add(body);

  // ---- satin backing, matched to the thread ----
  // Not optional on the real piece, and it is a selling point, so it is
  // modelled even though it is only seen from a low angle or a lifted
  // corner.
  const satin = clothMaps({ weave: "satin", color: "#FFFFFF", size: Math.max(256, textureSize / 4), repeat: 4 });
  const backingMaterial = new MeshStandardMaterial({
    map: satin.map,
    normalMap: satin.normalMap,
    color: new Color(DEFAULT_THREAD),
    roughness: 0.3,
    metalness: 0.02,
  });
  const backingGeo = new PlaneGeometry(WIDTH * 0.99, HEIGHT * 0.99);
  backingGeo.rotateX(Math.PI / 2);
  const backing = new Mesh(backingGeo, backingMaterial);
  backing.position.y = -THICKNESS / 2 - 0.004;
  group.add(backing);

  // ---- crochet picot edge ----
  // A ring of small beads round the hem, the same trick as the burp
  // cloth: at this scale that is what reads as scalloped crochet, and a
  // normal map on a flat edge reads as nothing.
  const PICOT = 168;
  const beadGeo = new SphereGeometry(0.022, 6, 5);
  const beadMaterial = new MeshStandardMaterial({
    color: new Color(DEFAULT_THREAD), roughness: 0.55, metalness: 0,
  });
  const picot = new InstancedMesh(beadGeo, beadMaterial, PICOT);
  {
    const m = new Matrix4();
    const perimeter = 2 * (WIDTH + HEIGHT);
    for (let i = 0; i < PICOT; i += 1) {
      let d = (i / PICOT) * perimeter;
      let x; let z;
      if (d < WIDTH) { x = -WIDTH / 2 + d; z = -HEIGHT / 2; }
      else if ((d -= WIDTH) < HEIGHT) { x = WIDTH / 2; z = -HEIGHT / 2 + d; }
      else if ((d -= HEIGHT) < WIDTH) { x = WIDTH / 2 - d; z = HEIGHT / 2; }
      else { d -= WIDTH; x = -WIDTH / 2; z = HEIGHT / 2 - d; }
      m.makeTranslation(x, 0, z);
      picot.setMatrixAt(i, m);
    }
    picot.instanceMatrix.needsUpdate = true;
    picot.frustumCulled = false;
  }
  group.add(picot);

  // ---- the worked grid ----
  const pivot = new Group();
  const inner = new Group();
  const stitches: StitchMeshHandle = createStitchMesh(CAPACITY, { cell: 0.02 });
  for (const mesh of stitches.meshes) inner.add(mesh);
  pivot.add(inner);
  pivot.position.y = THICKNESS / 2 + 0.012;
  group.add(pivot);

  // The name in the free square gets its own mesh, worked at whatever
  // scale fits one square — a capital is thirteen chart cells wide and a
  // square is sixteen, so a name planned into the grid would come out as
  // a single initial.
  const namePivot = new Group();
  const nameInner = new Group();
  const nameStitches: StitchMeshHandle = createStitchMesh(900, { cell: 0.02 });
  for (const mesh of nameStitches.meshes) nameInner.add(mesh);
  namePivot.add(nameInner);
  namePivot.position.y = THICKNESS / 2 + 0.014;
  group.add(namePivot);

  const CELL = 0.02;
  let count = 0;
  let nameCount = 0;
  let thread = DEFAULT_THREAD;
  let name = "";
  let onRestitch: ((total: number) => void) | null = null;

  const restitch = (): number => {
    const planned = planCribBlanket({ color: thread, name });
    const gridW = planned.cols * planned.cellW * CELL;
    const gridH = planned.rows * planned.cellH * CELL;
    const scale = Math.min((WIDTH * GRID_INSET) / gridW, (HEIGHT * GRID_INSET) / gridH);
    pivot.scale.setScalar(scale);
    // Centre the grid on the blanket. Stitches run from the grid's
    // top-left corner outward, so shifting back by half its size
    // re-centres it — in the INNER group's own coordinates, inside the
    // scale the pivot carries.
    inner.position.set(-gridW / 2, 0, -gridH / 2);
    stitches.setStitches(planned.stitches);
    count = planned.stitches.length;

    // The name, fitted to its square on the blanket.
    nameCount = 0;
    nameStitches.setStitches([]);
    if (planned.nameSquare && name.length > 0) {
      const worked = planStitchedLines({ lines: [name], color: thread });
      if (worked.stitches.length > 0) {
        let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
        for (const st of worked.stitches) {
          if (st.x < minX) minX = st.x;
          if (st.x > maxX) maxX = st.x;
          if (st.y < minY) minY = st.y;
          if (st.y > maxY) maxY = st.y;
        }
        const cellsW = maxX - minX + 1;
        const cellsH = maxY - minY + 1;
        // Inside the square's own stitched outline, not on top of it.
        const boxW = (planned.nameSquare.w - 3) * CELL * scale;
        const boxH = (planned.nameSquare.h - 3) * CELL * scale;
        const nameScale = Math.min(boxW / (cellsW * CELL), boxH / (cellsH * CELL));
        namePivot.scale.setScalar(nameScale);
        // The square's centre, in the same frame the grid is drawn in.
        const cx = (planned.nameSquare.x + planned.nameSquare.w / 2) * CELL * scale - gridW / 2 * scale;
        const cz = (planned.nameSquare.y + planned.nameSquare.h / 2) * CELL * scale - gridH / 2 * scale;
        namePivot.position.set(cx, THICKNESS / 2 + 0.014, cz);
        nameInner.position.set(
          -(minX * CELL + (cellsW * CELL) / 2),
          0,
          -(minY * CELL + (cellsH * CELL) / 2),
        );
        nameStitches.setStitches(worked.stitches);
        nameCount = worked.stitches.length;
      }
    }
    return count + nameCount;
  };

  const apply = (design: CribBlanketDesign): number => {
    const swatch = design?.swatch;
    const picked = swatch?.color ?? swatch?.dual?.[0] ?? DEFAULT_THREAD;
    const nextName = String(design?.name ?? "").trim();
    const changed = picked !== thread || nextName !== name;
    thread = picked;
    name = nextName;
    backingMaterial.color.set(thread);
    beadMaterial.color.set(thread);
    if (changed || count === 0) return restitch();
    return count + nameCount;
  };

  restitch();

  const fonts = typeof document !== "undefined" ? document.fonts : undefined;
  let disposed = false;
  fonts?.load?.('600 48px "Fraunces"').then(() => {
    if (disposed) return;
    clearChartCache();
    onRestitch?.(restitch());
  }).catch(() => { /* the fallback face still draws the alphabet */ });

  return {
    group,
    apply,
    // The grid first, then the name — the order the piece is worked in.
    setRevealed: (shown: number) => {
      stitches.setRevealed(shown);
      nameStitches.setRevealed(shown - count);
    },
    onRestitch: (cb) => { onRestitch = cb; },
    dispose: () => {
      disposed = true;
      stitches.dispose();
      nameStitches.dispose();
      bodyGeo.dispose();
      bodyMaterial.dispose();
      backingGeo.dispose();
      backingMaterial.dispose();
      beadGeo.dispose();
      beadMaterial.dispose();
      picot.dispose();
      group.clear();
    },
  };
}
