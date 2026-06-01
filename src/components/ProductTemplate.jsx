// ============================================================
// ProductTemplate — SVG preview for the bib name embroidery
// ============================================================
// Renders a stylized bib with the typed name in the chosen
// thread color. Used in the CustomProductCard picker.
//
// MIRRORED FROM index.html (~line 9891).
// ============================================================

import React from "react";

export function ProductTemplate({ customName, nameColor, nameColors }) {
  // Baby bib silhouette: rounded shape with neck cutout at top, white
  // fill matches the real product, gold stroke keeps it visible against
  // the cream-gradient backdrop.
  const paths = [
    {
      d: "M 38 22 C 38 28 44 30 50 30 C 56 30 62 28 62 22 C 70 22 80 30 80 50 C 80 78 65 88 50 88 C 35 88 20 78 20 50 C 20 30 30 22 38 22 Z",
      fill: "#FFFFFF", stroke: "var(--accent)", strokeWidth: 0.4,
    },
    { d: "M 38 22 C 32 18 26 18 22 22", fill: "none", stroke: "var(--accent)", strokeWidth: 0.4 },
    { d: "M 62 22 C 68 18 74 18 78 22", fill: "none", stroke: "var(--accent)", strokeWidth: 0.4 },
  ];
  const stitchZone = { x: 35, y: 45, w: 30, h: 28 };
  const trimmedName = (customName ?? "").trim();
  const showZone = trimmedName.length === 0;

  // Scale font size with name length so short names (3 letters) look balanced
  // and long names (6 letters) still fit. Stitch zone is 30 SVG units wide;
  // each cursive letter takes roughly 0.55 × fontSize horizontally. Cap at
  // 12 (readable) and floor at 5 (stays inside the zone).
  const nameFontSize = trimmedName.length === 0
    ? 10
    : Math.max(5, Math.min(12, (stitchZone.w - 4) / (trimmedName.length * 0.55)));

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {showZone && (
        <rect
          x={stitchZone.x} y={stitchZone.y} width={stitchZone.w} height={stitchZone.h}
          fill="none" stroke="var(--accent)" strokeWidth={0.3} strokeDasharray="1 1" opacity="0.4"
        />
      )}
      {/* Typed-name preview — Allura cursive approximates the real
          machine-embroidered script Lusik uses (see Olen / Romeo reference
          photos). nameColors (array) is used by the Armenian Flag preset to
          cycle per-letter colors; nameColor (single hex) is the default. */}
      {trimmedName.length > 0 && (
        <text
          x={stitchZone.x + stitchZone.w / 2}
          y={stitchZone.y + stitchZone.h / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="Allura, cursive"
          fontSize={Math.round(nameFontSize * 1.8)}
          fontWeight="400"
          fill={nameColor ?? "#1A1612"}
          letterSpacing="1"
        >
          {Array.isArray(nameColors) && nameColors.length > 0
            ? trimmedName.split("").map((ch, idx) => (
                <tspan key={idx} fill={nameColors[idx % nameColors.length]}>{ch}</tspan>
              ))
            : trimmedName}
        </text>
      )}
    </svg>
  );
}
