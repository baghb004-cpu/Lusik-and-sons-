// ============================================================
// ARRANGING A SET ON THE STAGE
// ============================================================
// Three products are sets: seven day bibs, a matched pair, a bib with its
// burp cloth. The stage's camera pose is fixed — it frames one bib — so a
// set has to lay itself out and then shrink to fit that frame rather than
// expect the camera to move. Getting this wrong does not throw; it puts
// half the set outside the picture, which is what the Hye Em Yes cap did
// before it learned to fit itself.
//
// Pure arithmetic, plain JavaScript with JSDoc, same reason as
// stitch/planner.js: CI runs the unit suite on Node 20, and layout that
// can be checked by a test should not need a GPU to check.
//
// Coordinates are the stage's: +x to the right, +z toward the viewer. A
// piece's own depth is its height laid flat.
// ============================================================

/**
 * Split a count into rows, the last row centred under the ones above.
 *
 * The seven-bib set is photographed three, three and one
 * (public/img/days-bib/02.jpg), which is what `perRow = 3` gives — and a
 * remainder row of one wants to sit in the middle, not hard against the
 * left edge.
 *
 * @param {number} count
 * @param {number} perRow
 * @returns {number[]} how many pieces are in each row
 */
export function rowsOf(count, perRow) {
  const n = Math.max(0, Math.floor(count));
  const per = Math.max(1, Math.floor(perRow));
  const rows = [];
  let left = n;
  while (left > 0) {
    rows.push(Math.min(per, left));
    left -= per;
  }
  return rows;
}

/**
 * Where each piece in a set sits, and how big the whole arrangement is.
 *
 * @param {object} input
 * @param {number} input.count
 * @param {number} input.perRow
 * @param {number} input.itemW  one piece's width
 * @param {number} input.itemD  one piece's depth (its height, laid flat)
 * @param {number} [input.gapX] space between pieces across a row
 * @param {number} [input.gapZ] space between rows
 * @returns {{ placements: {x: number, z: number, row: number, col: number}[], width: number, depth: number }}
 */
export function gridPlacements({ count, perRow, itemW, itemD, gapX = 0, gapZ = 0 }) {
  const rows = rowsOf(count, perRow);
  if (rows.length === 0) return { placements: [], width: 0, depth: 0 };

  const widest = Math.max(...rows);
  const width = widest * itemW + (widest - 1) * gapX;
  const depth = rows.length * itemD + (rows.length - 1) * gapZ;

  const placements = [];
  rows.forEach((inRow, row) => {
    const rowW = inRow * itemW + (inRow - 1) * gapX;
    // Rows are centred on each other, so a short last row sits in the
    // middle rather than leaving a hole on one side.
    const startX = -rowW / 2 + itemW / 2;
    const z = -depth / 2 + itemD / 2 + row * (itemD + gapZ);
    for (let col = 0; col < inRow; col += 1) {
      placements.push({ x: startX + col * (itemW + gapX), z, row, col });
    }
  });
  return { placements, width, depth };
}

/**
 * Lay pieces out in a single row, centred on the origin.
 *
 * @param {object} input
 * @param {number} input.count
 * @param {number} input.itemW
 * @param {number} [input.gapX]
 * @returns {{ placements: {x: number, z: number}[], width: number }}
 */
export function rowPlacements({ count, itemW, gapX = 0 }) {
  const n = Math.max(0, Math.floor(count));
  if (n === 0) return { placements: [], width: 0 };
  const width = n * itemW + (n - 1) * gapX;
  const startX = -width / 2 + itemW / 2;
  return {
    placements: Array.from({ length: n }, (_, i) => ({ x: startX + i * (itemW + gapX), z: 0 })),
    width,
  };
}

/**
 * The uniform scale that fits an arrangement into the box one piece used
 * to occupy, so the camera pose that framed a single bib still frames the
 * set.
 *
 * Takes the tighter of the two axes: a set that fits by width but not by
 * depth is a set with its front row cut off.
 *
 * @param {{ width: number, depth: number }} extent
 * @param {{ width: number, depth: number }} target
 * @returns {number}
 */
export function fitScale(extent, target) {
  if (!(extent.width > 0) || !(extent.depth > 0)) return 1;
  return Math.min(target.width / extent.width, target.depth / extent.depth);
}

/**
 * The footprint of a hand-placed arrangement — pieces at chosen spots and
 * angles rather than on a grid, the way the Bari Akhorzhak set is
 * photographed.
 *
 * Measured rather than guessed. Writing the extent out by hand next to the
 * placements is how that set first rendered with the bib off the right
 * edge and the burp cloth off the bottom: the two numbers were edited
 * independently and stopped agreeing.
 *
 * A rotated rectangle is measured by its axis-aligned bounding box, which
 * is what actually has to fit on screen.
 *
 * @param {{ x: number, z: number, width: number, depth: number, rotY?: number }[]} pieces
 * @returns {{ width: number, depth: number, centerX: number, centerZ: number }}
 */
export function boundsOf(pieces) {
  let minX = Infinity; let maxX = -Infinity; let minZ = Infinity; let maxZ = -Infinity;
  for (const piece of pieces ?? []) {
    const rot = piece.rotY ?? 0;
    const c = Math.abs(Math.cos(rot));
    const sn = Math.abs(Math.sin(rot));
    const halfW = (piece.width * c + piece.depth * sn) / 2;
    const halfD = (piece.width * sn + piece.depth * c) / 2;
    if (piece.x - halfW < minX) minX = piece.x - halfW;
    if (piece.x + halfW > maxX) maxX = piece.x + halfW;
    if (piece.z - halfD < minZ) minZ = piece.z - halfD;
    if (piece.z + halfD > maxZ) maxZ = piece.z + halfD;
  }
  if (!Number.isFinite(minX)) return { width: 0, depth: 0, centerX: 0, centerZ: 0 };
  return {
    width: maxX - minX,
    depth: maxZ - minZ,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
  };
}
