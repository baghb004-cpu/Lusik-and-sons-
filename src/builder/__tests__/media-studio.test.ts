// Offline Media Studio Phase 1 foundation (plan §26): schemas, the
// offline format/help data pack, and the grab-bar/trim/split/save-as-
// new-clip logic — all pure, no FFmpeg, no UI.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  mediaItem, clip, mediaProject, privacyLevel,
  FORMATS, EXPORT_PRESETS, formatFor, isImportable, PHONE_AUDIO_EXTS,
  clipDuration, trimStart, trimEnd, moveClip, splitAtPlayhead, snapOffset, timelineDuration,
  newClipName, saveAsNewClip, detachAudioSpec,
  HELP, helpById, type Clip, type MediaItem,
} from "../media-studio/index.ts";

const SRC: MediaItem = mediaItem.parse({ id: "m1", kind: "video", path: "media/videos/trip.mp4", durationSec: 60, addedAt: 1 });
const C = (over: Partial<Clip> = {}): Clip => clip.parse({ id: "c1", sourceId: "m1", inSec: 10, outSec: 40, trackOffsetSec: 0, ...over });

// ── schemas + privacy ───────────────────────────────────────
test("schemas gate; tax-protected is a real privacy level; a clip's end must beat its start", () => {
  assert.equal(privacyLevel.options.includes("tax-protected"), true);
  assert.equal(mediaItem.safeParse({ id: "x", kind: "photo", path: "media/photos/a.jpg", addedAt: 1 }).success, true);
  assert.equal(clip.safeParse({ id: "c", sourceId: "m", inSec: 5, outSec: 3 }).success, false); // backwards
  assert.equal(mediaProject.safeParse({ id: "p", name: "My edit", kind: "video" }).success, true);
});

// ── the offline data pack is honest ─────────────────────────
test("formats carry honest support levels; everyday set is full, RAW/HEIC flagged", () => {
  assert.equal(formatFor("photo.JPG")?.support, "full");
  assert.equal(formatFor("clip.webm")?.support, "full");
  assert.equal(formatFor("IMG_1234.heic")?.support, "requires-component");
  assert.equal(formatFor("shot.dng")?.support, "preview-only");
  assert.equal(formatFor("weird.xyz"), null);
  assert.equal(isImportable("memo.m4a"), true);
  assert.equal(isImportable("nope.xyz"), false);
  for (const e of ["m4a", "amr", "caf"]) assert.ok(PHONE_AUDIO_EXTS.includes(e));
  for (const f of FORMATS) assert.ok(["photo", "video", "audio", "subtitle"].includes(f.kind));
});

test("export presets cover website / mobile-app / social / general", () => {
  const cats = new Set(EXPORT_PRESETS.map((p) => p.category));
  for (const c of ["website", "mobile-app", "social", "general"]) assert.ok(cats.has(c as never), c);
  assert.ok(EXPORT_PRESETS.some((p) => p.id === "app-icon" && p.width === 1024));
  assert.ok(EXPORT_PRESETS.some((p) => p.id === "web-transparent" && p.format === "png"));
});

// ── grab-bar handles ────────────────────────────────────────
test("trim handles clamp to the source and never invert", () => {
  assert.equal(clipDuration(C()), 30);
  assert.equal(trimStart(C(), 50, 0.1).inSec, 39.9);
  assert.equal(trimStart(C(), -5).inSec, 0);
  assert.equal(trimEnd(C(), 999, 60).outSec, 60);
  assert.equal(trimEnd(C(), 5, 60, 0.1).outSec, 10.1);
  assert.equal(moveClip(C(), -3).trackOffsetSec, 0);
});

test("split at the playhead makes two clips that meet exactly; outside = no-op", () => {
  let n = 0;
  const id = () => `c${++n + 1}`;
  const placed = moveClip(C(), 5);
  const [left, right] = splitAtPlayhead(placed, 20, id);
  assert.equal(left.outSec, 25);
  assert.equal(right.inSec, 25);
  assert.equal(right.trackOffsetSec, 20);
  assert.equal(clipDuration(left) + clipDuration(right), clipDuration(placed));
  assert.deepEqual(splitAtPlayhead(placed, 100, id), [placed]);
});

test("snapping is magnetic within the threshold and timeline length is the furthest end", () => {
  assert.equal(snapOffset(5.1, [5, 10], 0.25), 5);
  assert.equal(snapOffset(7, [5, 10], 0.25), 7);
  const dur = timelineDuration([{ id: "t", kind: "video", clips: [moveClip(C(), 5)] }]);
  assert.equal(dur, 35);
});

// ── save as new clip: originals preserved, names don't collide ─
test("save-as-new-clip names are collision-proof and keep the original", () => {
  assert.equal(newClipName("media/videos/trip.mp4", "trimmed"), "trip-trimmed-001.mp4");
  assert.equal(newClipName("media/videos/trip.mp4", "trimmed", ["trip-trimmed-001.mp4"]), "trip-trimmed-002.mp4");
  const spec = saveAsNewClip(SRC, C());
  assert.equal(spec.sourcePath, "media/videos/trip.mp4");
  assert.equal(spec.filename, "trip-trimmed-001.mp4");
  assert.equal(spec.destDir, "media/new-clips");
  assert.equal(spec.inSec, 10);
  assert.equal(spec.outSec, 40);
  const audio = detachAudioSpec(SRC);
  assert.match(audio.filename, /trip-audio-only-001\.wav/);
});

// ── offline help ────────────────────────────────────────────
test("the help pack explains formats + how-tos in plain language", () => {
  assert.ok(HELP.length >= 20);
  assert.match(helpById("codec")!.a, /language|packed/i);
  assert.match(helpById("voicememo")!.a, /m4a/i);
  assert.match(helpById("originals")!.a, /never overwrites/i);
  for (const h of HELP) assert.ok(h.a.length > 20, h.id);
});
