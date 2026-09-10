// ============================================================
// BlanketLayoutPreview — the canonical 7x7 grid preview
// ============================================================
// The blanket-shaped preview rendered everywhere a blanket
// design is visualized: PDP, saved designs, order cards. 7x7
// grid with alphabet cubes (top-right + bottom-left corners),
// optional name + year diagonals, scattered pomegranate
// motifs, waffle-weave fabric texture, and top + bottom
// fringe edges.
//
// All visual choices come from props (letters, layout,
// blockColor, letterColor, letterColors, customLine1,
// customLine2). No global state.
//
// component — placement comes from src/data/blanketLayout.js,
// shared with the 3D Loom so the two can never disagree.
// ============================================================

import React from "react";
import { GRID, buildLayoutCells } from "../data/blanketLayout.js";

export function BlanketLayoutPreview({ letters, layout, darkMode, size = 120, blockColor, letterColor, letterColors, customLine1, customLine2, showCustomTextHints = false }) {
  // Build the 7x7 cells array (49 positions). For each filled position
  // in layout.preview, record both the LETTER glyph and the LETTER-INDEX
  // (0, 1, 2, …). The letter-index lets us apply per-letter coloring
  // when `letterColors` is provided (e.g. Armenian Flag preset:
  // index 0 = red, 1 = blue, 2 = orange).
  //
  // Why 7x7 instead of 5x5: at 5x5 the diagonals crowded the canvas
  // edges and the cubes felt cramped. The 7x7 grid gives the parallel
  // ↘↘ diagonals room to extend toward (but not into) the corners,
  // matching how the real hand-stitched blanket reads — cubes occupy
  // a central band, with breathing room of plain fabric on both
  // sides. Cells are 1/7 of the canvas instead of 1/5, so cubes are
  // automatically smaller and don't crowd.
  // Placement is shared with the 3D Loom (src/data/blanketLayout.js) rather
  // than computed here. Two renderers each deciding where the letters go
  // would eventually disagree, and the customer would see one arrangement
  // while configuring and another on the stage beside it.
  const cells = buildLayoutCells({
    letters,
    layout,
    line1: customLine1,
    line2: customLine2,
    showHints: showCustomTextHints,
  });

  // Grid frame border (the blanket's own outline)
  const borderColor = darkMode ? "rgba(245,239,227,0.18)" : "rgba(26,22,18,0.12)";

  // Text alternative for the whole preview (see role="img" below).
  const previewLabel = [
    "Preview of the blanket",
    layout?.shortLabel ? `laid out ${layout.shortLabel}` : null,
    customLine1 ? `reading ${customLine1}` : null,
    customLine2 ? `and ${customLine2}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  // Block outline color — what the customer picked, or a gold default for the
  // "no colors selected" / catalog-card preview case.
  const outlineColor = blockColor ?? "var(--accent)";
  // Default letter color when no per-letter array is provided.
  const defaultLetterFg = letterColor ?? (darkMode ? "#F5EFE3" : "#1A1612");

  // Per-letter color lookup. If `letterColors` is an array of hexes, each
  // letter gets the color at `letterIdx % letterColors.length`. This makes
  // a 6-letter layout (alphabet stitched twice) cycle the same 3 colors
  // through both diagonals, which is what we want for Armenian Flag.
  const colorForLetter = (letterIdx) => {
    if (Array.isArray(letterColors) && letterColors.length > 0) {
      return letterColors[letterIdx % letterColors.length];
    }
    return defaultLetterFg;
  };

  // Build the depth-wedge for one alphabet cube. Direction
  // flips per diagonal so the two parallel diagonals visually
  // "face inward" toward each other — exactly how Lusik
  // stitches them on the real blanket (see the close-up photo
  // in the design notes). For the ↙↙ layout: the upper
  // diagonal (top-right region) shows its back-top corner
  // UP-AND-LEFT; the lower diagonal (bottom-left region)
  // shows it UP-AND-RIGHT.
  //
  // Step count scales with the per-cell pixel size rather than
  // raw canvas size so the wedge stays proportional when the
  // grid resolution changes. A 17px cube (7x7 at size=120) gets
  // 3 steps; a 6px cube (7x7 at size=44, catalog thumbnail) gets
  // a single step. Shadow color is the cube's outline color at
  // ~73% opacity so the depth lines read as paler siblings of
  // the front-face outline — same hue, less weight.
  const cellPx     = size / GRID;
  const depthSteps = cellPx < 10 ? 1 : (cellPx < 14 ? 2 : (cellPx < 22 ? 3 : 4));
  const depthColor = blockColor ? `${blockColor}BB` : "rgba(176,136,66,0.7)";
  const buildDepth = (xSign) => Array.from({ length: depthSteps }, (_, i) =>
    `${(i + 1) * xSign}px ${-(i + 1)}px 0 0 ${depthColor}`
  ).join(", ");

  // Symmetric padding on all four sides. Was previously asymmetric
  // (more on top, less on bottom) which caused CSS Grid's `1fr`
  // distribution to round unevenly — the bottom row of cells came
  // out 1px taller than the rest, which made the bottom Գ cube
  // visibly larger than its peers. Equal padding → equal cells.
  const padTopLR  = depthSteps + (size < 80 ? 3 : 6);
  const padBottom = padTopLR;

  // ============================================================
  // WAFFLE WEAVE background + grid lines
  // ============================================================
  // The real blanket fabric has a fine waffle weave — a regular
  // grid of tiny raised squares. The preview hints at this with
  // an SVG-tiled background under every non-alphabet cell, so
  // the customer reads "fabric" rather than "blank white canvas".
  //
  // Grid lines: the gap between cells is 1-2px and the grid
  // container's background-color shows through that gap as a
  // light grey line, delineating each cell. Visual purpose: lets
  // the customer see the structure their personalization sits
  // in — same effect as the printed grid on Lusik's planning
  // diagram.
  const gridLineColor = darkMode
    ? "rgba(245,239,227,0.18)"
    : "rgba(176,136,66,0.22)";
  // Waffle weave: a 12px SVG tile with four small raised squares
  // in a 2×2 cluster. Stroke is faint so the texture sits BEHIND
  // the cubes and text without competing.
  const waffleSvg = darkMode
    ? `<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12'><rect width='12' height='12' fill='transparent'/><rect x='1' y='1' width='4' height='4' fill='none' stroke='rgba(245,239,227,0.10)' stroke-width='0.5'/><rect x='7' y='1' width='4' height='4' fill='none' stroke='rgba(245,239,227,0.10)' stroke-width='0.5'/><rect x='1' y='7' width='4' height='4' fill='none' stroke='rgba(245,239,227,0.10)' stroke-width='0.5'/><rect x='7' y='7' width='4' height='4' fill='none' stroke='rgba(245,239,227,0.10)' stroke-width='0.5'/></svg>`
    : `<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12'><rect width='12' height='12' fill='%23FFFFFF'/><rect x='1' y='1' width='4' height='4' fill='none' stroke='rgba(0,0,0,0.06)' stroke-width='0.4'/><rect x='2' y='2' width='2' height='2' fill='rgba(0,0,0,0.025)'/><rect x='7' y='1' width='4' height='4' fill='none' stroke='rgba(0,0,0,0.06)' stroke-width='0.4'/><rect x='8' y='2' width='2' height='2' fill='rgba(0,0,0,0.025)'/><rect x='1' y='7' width='4' height='4' fill='none' stroke='rgba(0,0,0,0.06)' stroke-width='0.4'/><rect x='2' y='8' width='2' height='2' fill='rgba(0,0,0,0.025)'/><rect x='7' y='7' width='4' height='4' fill='none' stroke='rgba(0,0,0,0.06)' stroke-width='0.4'/><rect x='8' y='8' width='2' height='2' fill='rgba(0,0,0,0.025)'/></svg>`;
  const waffleBackground = `url("data:image/svg+xml;utf8,${waffleSvg}")`;

  // Pomegranate motif as a CSS background-image. Previously rendered
  // as an inline <svg> per cell, which meant 13–18 React-rendered SVG
  // elements per preview; serving it as a data URL on the cell's
  // background lets the browser handle one cached image and 0
  // additional React elements.
  const pomegranateStroke = darkMode ? "rgba(245,239,227,0.28)" : "rgba(176,136,66,0.45)";
  const pomegranateSvg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${pomegranateStroke}' stroke-width='1.1' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='14' r='6'/><path d='M 7.5 9 L 8.5 7 L 9.5 9 L 10.5 7 L 11.5 9 L 12.5 7 L 13.5 9 L 14.5 7 L 15.5 9'/><line x1='12' y1='5' x2='12' y2='7'/></svg>`;
  const pomegranateBackground = `url("data:image/svg+xml;utf8,${encodeURIComponent(pomegranateSvg)}")`;

  // ============================================================
  // FRINGE EDGES — yarn strands on the top + bottom of the blanket
  // ============================================================
  // The real waffle-acrylic blanket Lusik sells has fringe along
  // its top and bottom edges — short yarn strands hanging off the
  // woven body. The preview hints at this with an SVG-tiled strip
  // above and below the canvas, drawn as short vertical lines of
  // slightly varying length for an organic feel.
  //
  // Only shown when the preview is large enough (size >= 80) for
  // the fringe to read as fringe rather than visual noise. Catalog
  // thumbnails skip it so they stay clean and square.
  const showFringe = size >= 80;
  const fringeHeight = Math.max(8, Math.round(size * 0.07));
  const fringeColor = darkMode ? "rgba(245,239,227,0.45)" : "rgba(176,136,66,0.55)";
  // 8px-wide tile with 3 strands of slightly varying length —
  // strands attach to the TOP edge of the tile and extend downward
  // (used directly for the bottom fringe; top fringe applies a
  // vertical flip via transform: scaleY(-1) so the strands point up).
  const fringeStrandSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='8' height='12'><line x1='1.5' y1='0' x2='1.5' y2='11' stroke='${fringeColor}' stroke-width='0.6' stroke-linecap='round'/><line x1='4' y1='0' x2='4' y2='9' stroke='${fringeColor}' stroke-width='0.6' stroke-linecap='round'/><line x1='6.5' y1='0' x2='6.5' y2='10' stroke='${fringeColor}' stroke-width='0.6' stroke-linecap='round'/></svg>`;
  const fringeBackground = `url("data:image/svg+xml;utf8,${encodeURIComponent(fringeStrandSvg)}")`;

  // The canvas itself stays aspect-square; when fringe is enabled we
  // wrap it in an outer container that stacks: top fringe strip,
  // canvas, bottom fringe strip. That keeps the cell grid uniform and
  // avoids polluting the existing layout math; the only downside is the
  // wrapper's total height becomes (size + 2*fringeHeight), so callers
  // shouldn't constrain it to a square box if they want fringe to show.
  const canvas = (
    <div
      className="aspect-square w-full"
      // A picture of the finished blanket, not a text layout: the letters
      // inside are rendered in the customer's chosen THREAD color on the
      // chosen CLOTH, so their contrast is a truthful property of the
      // product (cream thread on cream waffle really does read softly) and
      // must not be "corrected". role="img" says so — assistive tech reads
      // the label instead of spelling out the grid, and the contrast audit
      // skips the subtree for the same reason. The color names and DMC
      // numbers are carried as text in the summary beside the preview, so
      // color is never the only signal.
      role="img"
      aria-label={previewLabel}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${GRID}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${GRID}, minmax(0, 1fr))`,
        // Gap doubles as the visible grid line between cells: the
        // container's grid-line color shows through the 1px gap, so
        // every cell has a clean grey separator on its right and
        // bottom edges (and the outer border handles the perimeter).
        gap: "1px",
        border: `1px solid ${gridLineColor}`,
        backgroundColor: gridLineColor,
        // Generous padding on top + both sides (every cube's depth
        // extends up; upper-diagonal extends right, lower extends
        // left after the facing-flip). Bottom can stay tight.
        padding: `${padTopLR}px ${padTopLR}px ${padBottom}px ${padTopLR}px`,
        maxWidth: `${size}px`,
        // overflow stays VISIBLE so depth shadows can extend naturally without
        // clipping the cube outlines themselves. The parent button container
        // handles any visual overflow at its own boundary.
        overflow: "visible",
        boxSizing: "border-box",
      }}
      aria-label={`Blanket layout preview: ${layout.label}, ${letters.join(", ")}`}
    >
      {cells.map((cell, i) => {
        const filled = cell !== null;
        const isAlphabetCube = filled && cell.kind === "alphabet";
        const isTextCell = filled && cell.kind === "text";
        const isPomegranate = filled && cell.kind === "pomegranate";

        // Per-cube depth direction. The preview array stores cubes
        // in two halves: the first `letters.length` entries are
        // the upper diagonal (top-right corner region), the rest
        // are the lower diagonal (bottom-left corner region).
        // Direction is MIRRORED between the two halves so the
        // diagonals look like a coherent pair rather than a
        // randomly-rotated set: upper-diagonal cubes (top-right)
        // show their back-top corner UP-AND-LEFT; lower-diagonal
        // cubes (bottom-left) show it UP-AND-RIGHT.
        const isLowerDiagonal = isAlphabetCube && cell.idx >= letters.length;
        const cellDepthShadow = isAlphabetCube
          ? buildDepth(isLowerDiagonal ? 1 : -1)
          : "none";

        // For alphabet cubes: single letter at ~55% of cell. For text cells
        // (optional name/year), the glyph may be multiple characters (up to 6),
        // so font size has to scale down as text length grows so it fits in
        // the cell. Estimate: each character takes ~0.55 × fontSize horizontally.
        // The /GRID divisor keeps cube proportions correct when the grid size
        // changes (was hardcoded /5 when the grid was 5x5).
        const cellInnerPx = (size - 10) / GRID;
        let letterPx;
        if (isTextCell) {
          const len = Math.max(1, cell.glyph.length);
          // Available width = cell minus 2px each side
          const safeW = cellInnerPx - 4;
          const ideal = safeW / (len * 0.55);
          // Text cells are allowed to grow a touch larger than alphabet
          // cubes since they're the customer's personalization — they
          // should be readable. Cap at half the cell so they still fit.
          letterPx = Math.max(5, Math.min(cellInnerPx * 0.5, ideal));
        } else {
          letterPx = Math.max(7, Math.round(cellInnerPx * 0.6));
        }

        const isPlaceholderText = isTextCell && cell.placeholder === true;
        const letterFg = isAlphabetCube
          ? colorForLetter(cell.letterIdx)
          : isTextCell
            ? (isPlaceholderText
                // Faded hint — still a "ghost of the text to come", but the
                // old 0.35/0.4 alphas read 2.1:1 on the white waffle tile,
                // under the 3:1 large-text gate. These clear it and still
                // sit well behind the real embroidered text below.
                ? (darkMode ? "rgba(245,239,227,0.55)" : "rgba(26,22,18,0.5)")
                : (darkMode ? "#F5EFE3" : "#1A1612"))                            // real embroidered text
            : "transparent";

        return (
          <div
            key={i}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              // Background: alphabet cubes get the white "cube face" (the
              // 3D cube reads as a clean square sitting on the fabric).
              // Pomegranate cells stack a centered pomegranate motif on
              // top of the waffle-weave fabric via CSS layered
              // backgrounds — saves rendering an inline <svg> per cell.
              // Every other cell shows just the waffle weave.
              background: isAlphabetCube
                ? (darkMode ? "transparent" : "#FFFFFF")
                : isPomegranate
                  ? `${pomegranateBackground} center / 70% no-repeat, ${waffleBackground} 0 0 / 12px repeat`
                  : waffleBackground,
              // Cube outline + depth only on alphabet cubes. Text cells get
              // no border so they read as "embroidered onto the blanket"
              // rather than another framed letter. Border width scales
              // with cell size so a tiny catalog-card thumbnail (cellPx < 10)
              // doesn't end up with a 2px border drowning a 6px cube.
              border: isAlphabetCube
                ? `${cellPx < 10 ? 1 : 2}px solid ${outlineColor}`
                : "none",
              // Inset alphabet cubes inside their grid cell so the cube
              // doesn't fill the cell edge-to-edge. The visible breathing
              // room makes every cube read at the same proportion as its
              // neighbors — without this the cell-edge cubes (e.g. the
              // bottom Գ at (6,2), right against the canvas's inner
              // border) visually appeared larger than mid-grid cubes.
              margin: isAlphabetCube ? (cellPx < 10 ? "1px" : "2px") : 0,
              boxShadow: cellDepthShadow,
              fontFamily: "Fraunces, serif",
              fontSize: `${letterPx}px`,
              fontWeight: isAlphabetCube ? 600 : (isPlaceholderText ? 400 : 500),
              fontStyle: isPlaceholderText ? "italic" : "normal",
              color: letterFg,
              lineHeight: 1,
              boxSizing: "border-box",
              // Letter-spacing slightly tightens multi-char text so 6-char
              // strings (e.g. "070524") don't crowd the cell edges.
              letterSpacing: isTextCell ? "-0.5px" : "normal",
            }}
          >
            {cell?.glyph ?? ""}
          </div>
        );
      })}
    </div>
  );

  if (!showFringe) return canvas;

  // Wrap the canvas in a vertical stack: top fringe + canvas + bottom
  // fringe. The fringe strips are full-width, fringeHeight tall, with
  // strands repeated horizontally. The top fringe is flipped on the Y
  // axis so its strands point upward (away from the canvas); the bottom
  // strip uses the SVG as-is so its strands point downward.
  const fringeStripStyle = {
    width: "100%",
    height: `${fringeHeight}px`,
    backgroundImage: fringeBackground,
    backgroundRepeat: "repeat-x",
    backgroundPosition: "top center",
    pointerEvents: "none",
  };
  return (
    <div style={{ width: "100%", maxWidth: `${size}px` }}>
      <div style={{ ...fringeStripStyle, transform: "scaleY(-1)" }} aria-hidden="true" />
      {canvas}
      <div style={fringeStripStyle} aria-hidden="true" />
    </div>
  );
}
