// ============================================================
// Embroidery (§31, Phase 5) — Melco/Bernina EXP encoder/decoder (pure)
// ============================================================
// EXP is the simplest documented machine format: a raw stream of 2-byte signed
// relative stitch records (0.1mm units), with 0x80-prefixed commands for jumps
// and color changes. Like the DST encoder, the decode() inverse lets the unit
// tests prove encode() round-trips. EXPERIMENTAL — test on your machine first.
// ============================================================

import type { StitchPlan } from "./stitches.ts";

const MAX = 127; // signed int8 range used per record

function i8(v: number): number { return v & 0xff; }       // → unsigned byte (two's complement)
function s8(b: number): number { return b < 128 ? b : b - 256; } // → signed

export function toExp(plan: StitchPlan): Uint8Array {
  const out: number[] = [];
  let px = 0, py = 0;

  const emit = (dx: number, dy: number, flag: "stitch" | "jump" | "stop") => {
    // split moves longer than ±127 into leading jumps
    while (Math.abs(dx) > MAX || Math.abs(dy) > MAX) {
      const sx = Math.max(-MAX, Math.min(MAX, dx));
      const sy = Math.max(-MAX, Math.min(MAX, dy));
      out.push(0x80, 0x04, i8(sx), i8(sy));
      dx -= sx; dy -= sy;
    }
    if (flag === "jump") out.push(0x80, 0x04, i8(dx), i8(dy));
    else if (flag === "stop") out.push(0x80, 0x01, i8(dx), i8(dy)); // color change
    else out.push(i8(dx), i8(dy));
  };

  for (const s of plan.stitches) {
    if (s.flag === "end") break;
    emit(s.x - px, s.y - py, s.flag);
    px = s.x; py = s.y;
  }
  return Uint8Array.from(out);
}

export interface DecodedExp { dx: number; dy: number; flag: "stitch" | "jump" | "stop"; }
export function decodeExp(bytes: Uint8Array): DecodedExp[] {
  const recs: DecodedExp[] = [];
  let i = 0;
  while (i + 1 < bytes.length) {
    if (bytes[i] === 0x80) {
      const cmd = bytes[i + 1];
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
