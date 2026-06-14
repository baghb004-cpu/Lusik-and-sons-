// ============================================================
// Embroidery (§31, Phase 5) — Janome JEF encoder/decoder (pure)
// ============================================================
// JEF is a header (stitch-data offset + color table) followed by 2-byte signed
// relative stitch records with 0x80-prefixed commands — close to EXP. The
// decoder (inverse) lets the unit tests prove the stitch geometry round-trips.
// The decoder reads the stitch-data offset from the header, so geometry is
// correct regardless of the optional middle header fields. EXPERIMENTAL: like
// every machine file here, test on your machine before a final piece.
// ============================================================

import type { StitchPlan } from "./stitches.ts";

const MAX = 127;
function i8(v: number): number { return v & 0xff; }
function s8(b: number): number { return b < 128 ? b : b - 256; }

function encodeBody(plan: StitchPlan): { body: number[]; stitches: number; colorChanges: number } {
  const body: number[] = [];
  let px = 0, py = 0, stitches = 0, colorChanges = 0;
  const move = (dx: number, dy: number, flag: "stitch" | "jump" | "stop") => {
    while (Math.abs(dx) > MAX || Math.abs(dy) > MAX) {
      const sx = Math.max(-MAX, Math.min(MAX, dx)), sy = Math.max(-MAX, Math.min(MAX, dy));
      body.push(0x80, 0x02, i8(sx), i8(sy)); dx -= sx; dy -= sy;
    }
    if (flag === "jump") body.push(0x80, 0x02, i8(dx), i8(dy));
    else if (flag === "stop") body.push(0x80, 0x01, i8(dx), i8(dy));
    else body.push(i8(dx), i8(dy));
  };
  for (const s of plan.stitches) {
    if (s.flag === "end") break;
    move(s.x - px, s.y - py, s.flag);
    px = s.x; py = s.y;
    if (s.flag === "stop") colorChanges++; else stitches++;
  }
  body.push(0x80, 0x10); // end
  return { body, stitches, colorChanges };
}

export function toJef(plan: StitchPlan): Uint8Array {
  const { body, stitches, colorChanges } = encodeBody(plan);
  const colors = Math.max(1, plan.colors.length);
  const stitchOffset = 0x74 + colors * 4;
  const out = new Uint8Array(stitchOffset + body.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0x00, stitchOffset, true);   // where stitches begin
  dv.setUint32(0x04, 0x14, true);           // format marker
  // date stamp (ASCII), informational
  const date = "20240101000000";
  for (let i = 0; i < date.length; i++) out[0x08 + i] = date.charCodeAt(i);
  dv.setUint32(0x18, colors, true);         // color count
  dv.setUint32(0x1c, stitches, true);       // stitch count
  dv.setUint32(0x20, 0, true);              // hoop code (0)
  // color table (Janome thread codes — placeholder sequential codes)
  for (let i = 0; i < colors; i++) dv.setUint32(0x74 + i * 4, (i % 78) + 1, true);
  out.set(body, stitchOffset);
  void colorChanges;
  return out;
}

export interface DecodedJef { dx: number; dy: number; flag: "stitch" | "jump" | "stop"; }
export function decodeJef(bytes: Uint8Array): DecodedJef[] {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let i = dv.getUint32(0x00, true);
  const recs: DecodedJef[] = [];
  while (i + 1 < bytes.length) {
    if (bytes[i] === 0x80) {
      const cmd = bytes[i + 1];
      if (cmd === 0x10) break; // end
      const dx = s8(bytes[i + 2] ?? 0), dy = s8(bytes[i + 3] ?? 0);
      recs.push({ dx, dy, flag: cmd === 0x01 ? "stop" : "jump" });
      i += 4;
    } else {
      recs.push({ dx: s8(bytes[i]), dy: s8(bytes[i + 1]), flag: "stitch" });
      i += 2;
    }
  }
  return recs;
}
