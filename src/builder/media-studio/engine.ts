// ============================================================
// Media Studio — timeline / trim / save-as-new-clip logic (pure)
// ============================================================
// The grab-bar handle math and clip operations, as pure
// functions the UI drives and tests pin down. Originals are
// never touched — these return NEW clip/track values and the
// naming for new files. Trims clamp to the source duration so a
// handle can't drag past the media.
// ============================================================

import type { Clip, MediaItem, Track } from "./schemas.ts";

const round = (n: number) => Math.round(n * 1000) / 1000; // ms precision

export function clipDuration(c: Clip): number {
  return round(c.outSec - c.inSec);
}

/** Drag the LEFT handle to `sec` (trim the start). Clamps to [0, out-min). */
export function trimStart(c: Clip, sec: number, minLenSec = 0.1): Clip {
  const next = Math.max(0, Math.min(sec, c.outSec - minLenSec));
  return { ...c, inSec: round(next) };
}

/** Drag the RIGHT handle to `sec` (trim the end). Clamps to (in+min, sourceDuration]. */
export function trimEnd(c: Clip, sec: number, sourceDurationSec: number, minLenSec = 0.1): Clip {
  const cap = sourceDurationSec > 0 ? sourceDurationSec : sec;
  const next = Math.min(cap, Math.max(sec, c.inSec + minLenSec));
  return { ...c, outSec: round(next) };
}

/** Drag the CENTER to move the clip along its track (offset can't go negative). */
export function moveClip(c: Clip, trackOffsetSec: number): Clip {
  return { ...c, trackOffsetSec: round(Math.max(0, trackOffsetSec)) };
}

/** Split a clip at an absolute timeline position; returns [left, right] or
 *  the original (in a 1-tuple) if the playhead isn't inside the clip. */
export function splitAtPlayhead(c: Clip, playheadSec: number, newId: () => string): Clip[] {
  const start = c.trackOffsetSec;
  const end = c.trackOffsetSec + clipDuration(c);
  if (playheadSec <= start || playheadSec >= end) return [c];
  const localCut = c.inSec + (playheadSec - start);
  const left: Clip = { ...c, outSec: round(localCut) };
  const right: Clip = { ...c, id: newId(), inSec: round(localCut), trackOffsetSec: round(playheadSec) };
  return [left, right];
}

/** Snap a clip's offset to the nearest target (track edges, playhead, other
 *  clip edges) within `thresholdSec`. Beginner-friendly magnetism. */
export function snapOffset(offsetSec: number, targets: number[], thresholdSec = 0.25): number {
  let best = offsetSec;
  let bestDist = thresholdSec;
  for (const t of targets) {
    const d = Math.abs(offsetSec - t);
    if (d < bestDist) {
      best = t;
      bestDist = d;
    }
  }
  return round(best);
}

/** Total timeline length = the furthest clip end across all tracks. */
export function timelineDuration(tracks: Track[]): number {
  let max = 0;
  for (const t of tracks) for (const c of t.clips) max = Math.max(max, c.trackOffsetSec + clipDuration(c));
  return round(max);
}

// ── Save as New Media Clip: naming + the cut spec ───────────
export interface NewClipSpec {
  /** Source file to cut from. */
  sourcePath: string;
  inSec: number;
  outSec: number;
  /** Suggested new filename — original is ALWAYS preserved. */
  filename: string;
  /** Where it lands (relative to portable/media). */
  destDir: string;
}

const baseName = (path: string) => (path.split("/").pop() ?? path).replace(/\.[^.]+$/, "");
const extOf = (path: string) => (path.split(".").pop() ?? "").toLowerCase();

/** Collision-proof "name-trimmed-001.ext" / "name-clip-001.ext" naming. */
export function newClipName(sourcePath: string, suffix: "trimmed" | "clip" | "audio-only" | "frame", existing: string[] = [], overrideExt?: string): string {
  const base = baseName(sourcePath);
  const ext = overrideExt ?? extOf(sourcePath);
  let n = 1;
  let name: string;
  do {
    name = `${base}-${suffix}-${String(n).padStart(3, "0")}.${ext}`;
    n++;
  } while (existing.includes(name));
  return name;
}

/** Build the save-as-new-clip spec for a trimmed clip (preserves the original). */
export function saveAsNewClip(source: MediaItem, c: Clip, existing: string[] = []): NewClipSpec {
  return {
    sourcePath: source.path,
    inSec: c.inSec,
    outSec: c.outSec,
    filename: newClipName(source.path, "trimmed", existing),
    destDir: "media/new-clips",
  };
}

/** Detach a video's audio into a new audio clip spec. */
export function detachAudioSpec(source: MediaItem, existing: string[] = []): NewClipSpec {
  return {
    sourcePath: source.path,
    inSec: 0,
    outSec: source.durationSec ?? 0,
    filename: newClipName(source.path, "audio-only", existing, "wav"),
    destDir: "media/edited",
  };
}
