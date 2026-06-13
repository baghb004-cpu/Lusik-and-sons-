// ============================================================
// Embroidery (§31, Phase 5) — Tajima DST encoder/decoder (pure)
// ============================================================
// DST is the most openly-documented machine embroidery format: a 512-byte text
// header + 3-byte relative stitch records. We generate a valid DST from a
// StitchPlan. Coordinates are 0.1mm units. Large moves are split into ≤121-unit
// jumps. EXPERIMENTAL — the file is real DST, but always test on your own
// machine with stabilizer before stitching a final piece.
//
// The 3-byte bit layout (and the decode() inverse below) follow the public DST
// specification; decode() lets the unit tests prove encode() round-trips.
// ============================================================

import type { StitchPlan, StitchFlag } from "./stitches.ts";

const MAX = 121; // 81+27+9+3+1

// control byte (byte 2) bases
const CTL_STITCH = 0x03;
const CTL_JUMP = 0x83;
const CTL_STOP = 0xc3;

function encodeRecord(dx: number, dy: number, ctl: number): [number, number, number] {
  let b0 = 0, b1 = 0, b2 = ctl;
  // X
  if (dx > 40) { b2 |= 0x04; dx -= 81; } else if (dx < -40) { b2 |= 0x08; dx += 81; }
  if (dx > 13) { b1 |= 0x04; dx -= 27; } else if (dx < -13) { b1 |= 0x08; dx += 27; }
  if (dx > 4) { b0 |= 0x04; dx -= 9; } else if (dx < -4) { b0 |= 0x08; dx += 9; }
  if (dx > 1) { b1 |= 0x01; dx -= 3; } else if (dx < -1) { b1 |= 0x02; dx += 3; }
  if (dx > 0) { b0 |= 0x01; } else if (dx < 0) { b0 |= 0x02; }
  // Y (DST Y is up-positive)
  if (dy > 40) { b2 |= 0x20; dy -= 81; } else if (dy < -40) { b2 |= 0x10; dy += 81; }
  if (dy > 13) { b1 |= 0x20; dy -= 27; } else if (dy < -13) { b1 |= 0x10; dy += 27; }
  if (dy > 4) { b0 |= 0x20; dy -= 9; } else if (dy < -4) { b0 |= 0x10; dy += 9; }
  if (dy > 1) { b1 |= 0x80; dy -= 3; } else if (dy < -1) { b1 |= 0x40; dy += 3; }
  if (dy > 0) { b0 |= 0x80; } else if (dy < 0) { b0 |= 0x40; }
  return [b0, b1, b2];
}

function ctlFor(flag: StitchFlag): number {
  return flag === "jump" ? CTL_JUMP : flag === "stop" ? CTL_STOP : CTL_STITCH;
}

// Emit a move of (dx,dy), splitting any leg longer than ±MAX into jumps.
function pushMove(out: number[], dx: number, dy: number, flag: StitchFlag) {
  while (Math.abs(dx) > MAX || Math.abs(dy) > MAX) {
    const sx = Math.max(-MAX, Math.min(MAX, dx));
    const sy = Math.max(-MAX, Math.min(MAX, dy));
    const [a, b, c] = encodeRecord(sx, sy, CTL_JUMP);
    out.push(a, b, c);
    dx -= sx; dy -= sy;
  }
  const [a, b, c] = encodeRecord(dx, dy, ctlFor(flag));
  out.push(a, b, c);
}

function padNum(n: number, width: number): string {
  const s = String(n);
  return s.length >= width ? s.slice(0, width) : " ".repeat(width - s.length) + s;
}
function signed(n: number, width: number): string {
  return (n >= 0 ? "+" : "-") + padNum(Math.abs(n), width);
}

function buildHeader(label: string, stitchCount: number, colorCount: number, ext: { minX: number; maxX: number; minY: number; maxY: number }): string {
  const la = (label || "design").toUpperCase().replace(/[^A-Z0-9 ]/g, "").slice(0, 16).padEnd(16, " ");
  const CR = "\r";
  let h = "";
  h += "LA:" + la + CR;
  h += "ST:" + padNum(stitchCount, 7) + CR;
  h += "CO:" + padNum(colorCount, 3) + CR;
  h += "+X:" + padNum(Math.max(0, ext.maxX), 5) + CR;
  h += "-X:" + padNum(Math.max(0, -ext.minX), 5) + CR;
  h += "+Y:" + padNum(Math.max(0, ext.maxY), 5) + CR;
  h += "-Y:" + padNum(Math.max(0, -ext.minY), 5) + CR;
  h += "AX:" + signed(0, 5) + CR;
  h += "AY:" + signed(0, 5) + CR;
  h += "MX:" + signed(0, 5) + CR;
  h += "MY:" + signed(0, 5) + CR;
  h += "PD:******" + CR;
  return h;
}

export function toDst(plan: StitchPlan, label = "design"): Uint8Array {
  const body: number[] = [];
  let px = 0, py = 0;
  let stitches = 0, colorChanges = 0;
  let minX = 0, maxX = 0, minY = 0, maxY = 0;

  for (const s of plan.stitches) {
    if (s.flag === "end") break;
    const dx = s.x - px, dy = s.y - py;
    pushMove(body, dx, dy, s.flag);
    px = s.x; py = s.y;
    if (s.flag === "stop") colorChanges++; else stitches++;
    minX = Math.min(minX, px); maxX = Math.max(maxX, px);
    minY = Math.min(minY, py); maxY = Math.max(maxY, py);
  }
  // end-of-design record
  body.push(0x00, 0x00, 0xf3);

  const header = buildHeader(label, stitches, colorChanges, { minX, maxX, minY, maxY });
  const out = new Uint8Array(512 + body.length);
  out.fill(0x20, 0, 512);
  for (let i = 0; i < header.length; i++) out[i] = header.charCodeAt(i) & 0xff;
  out[header.length] = 0x1a; // header terminator
  out.set(body, 512);
  return out;
}

// --- decoder (inverse of encodeRecord) — used by tests + previews ----------

export interface DecodedStitch { dx: number; dy: number; flag: StitchFlag; }
export function decodeRecords(bytes: Uint8Array): DecodedStitch[] {
  const start = headerLength(bytes);
  const recs: DecodedStitch[] = [];
  for (let i = start; i + 2 < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = bytes[i + 1], b2 = bytes[i + 2];
    if (b2 === 0xf3) break; // end
    let dx = 0, dy = 0;
    if (b0 & 0x01) dx += 1; if (b0 & 0x02) dx -= 1;
    if (b0 & 0x04) dx += 9; if (b0 & 0x08) dx -= 9;
    if (b1 & 0x01) dx += 3; if (b1 & 0x02) dx -= 3;
    if (b1 & 0x04) dx += 27; if (b1 & 0x08) dx -= 27;
    if (b2 & 0x04) dx += 81; if (b2 & 0x08) dx -= 81;
    if (b0 & 0x80) dy += 1; if (b0 & 0x40) dy -= 1;
    if (b0 & 0x20) dy += 9; if (b0 & 0x10) dy -= 9;
    if (b1 & 0x80) dy += 3; if (b1 & 0x40) dy -= 3;
    if (b1 & 0x20) dy += 27; if (b1 & 0x10) dy -= 27;
    if (b2 & 0x20) dy += 81; if (b2 & 0x10) dy -= 81;
    const ctl = b2 & 0xc0;
    const flag: StitchFlag = ctl === 0xc0 ? "stop" : ctl === 0x80 ? "jump" : "stitch";
    recs.push({ dx, dy, flag });
  }
  return recs;
}

function headerLength(bytes: Uint8Array): number {
  // header is 512 bytes for files we write; tolerate by scanning for 0x1a < 512
  return 512;
}

export function dstStitchCount(bytes: Uint8Array): number {
  // parse "ST:nnnnnnn" from header
  let s = "";
  for (let i = 0; i < 512; i++) s += String.fromCharCode(bytes[i]);
  const m = s.match(/ST:\s*(\d+)/);
  return m ? Number(m[1]) : 0;
}
