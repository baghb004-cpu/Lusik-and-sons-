// ============================================================
// Offline Media Studio — data model (pure, plan §26 Phase 1)
// ============================================================
// A private, offline photo/video/audio editor SECTION. This file
// is the foundation: the shapes for media items, non-destructive
// projects, the timeline (clips with grab-handle in/out points),
// privacy levels, and export presets. Pure + zod-gated; the
// FFmpeg sidecar + UI build on top later. Originals are NEVER
// overwritten — edits are operations + new files.
// ============================================================

import { z } from "zod";

// ── privacy: tax/document files never show in the gallery ───
export const PRIVACY_LEVELS = ["normal", "private", "sensitive", "tax-protected"] as const;
export const privacyLevel = z.enum(PRIVACY_LEVELS);
export type PrivacyLevel = (typeof PRIVACY_LEVELS)[number];

export const MEDIA_KINDS = ["photo", "video", "audio", "voice", "subtitle"] as const;
export const mediaKind = z.enum(MEDIA_KINDS);
export type MediaKind = (typeof MEDIA_KINDS)[number];

// One file in the local library (the index row — see plan §23 data dir).
export const mediaItem = z
  .object({
    id: z.string().min(1).max(64),
    kind: mediaKind,
    /** Relative path under portable/media — never uploaded anywhere. */
    path: z.string().min(1).max(400),
    label: z.string().max(160).optional(),
    privacyLevel: privacyLevel.default("normal"),
    // FFprobe-filled facts (optional until probed).
    container: z.string().max(20).optional(),
    codec: z.string().max(30).optional(),
    durationSec: z.number().min(0).optional(),
    width: z.number().int().min(0).optional(),
    height: z.number().int().min(0).optional(),
    frameRate: z.number().min(0).optional(),
    sampleRate: z.number().int().min(0).optional(),
    channels: z.number().int().min(0).optional(),
    bytes: z.number().int().min(0).optional(),
    addedAt: z.number().int(),
    /** True = a file the user made HERE (edited/new clip), preserve originals. */
    derived: z.boolean().optional(),
  })
  .strict();
export type MediaItem = z.infer<typeof mediaItem>;

// ── timeline: a clip references a source + an in/out window ──
// The grab-bar handles edit inSec/outSec; trackOffsetSec moves the clip.
export const clip = z
  .object({
    id: z.string().min(1).max(64),
    sourceId: z.string().min(1).max(64), // → MediaItem.id
    inSec: z.number().min(0), // left grab handle
    outSec: z.number().min(0), // right grab handle
    trackOffsetSec: z.number().min(0).default(0), // where it sits on the track
    /** Photo segments have no intrinsic duration — this sets it. */
    photoDurationSec: z.number().min(0).optional(),
    volume: z.number().min(0).max(4).optional(), // 1 = unchanged
    muted: z.boolean().optional(),
    fadeInSec: z.number().min(0).optional(),
    fadeOutSec: z.number().min(0).optional(),
  })
  .strict()
  .refine((c) => c.outSec > c.inSec, { message: "a clip's end must be after its start" });
export type Clip = z.infer<typeof clip>;

export const track = z
  .object({
    id: z.string().min(1).max(64),
    kind: z.enum(["video", "audio"]),
    clips: z.array(clip).max(200).default([]),
  })
  .strict();
export type Track = z.infer<typeof track>;

export const mediaProject = z
  .object({
    schemaVersion: z.number().int().min(1).default(1),
    id: z.string().min(1).max(64),
    name: z.string().min(1).max(160),
    kind: z.enum(["photo", "video", "audio"]),
    /** Non-destructive: timeline references sources, never edits them. */
    tracks: z.array(track).max(20).default([]),
    /** Output frame size for the render (video/photo projects). */
    width: z.number().int().min(1).max(8192).optional(),
    height: z.number().int().min(1).max(8192).optional(),
    exportPresetId: z.string().max(64).optional(),
    thumbnailPath: z.string().max(400).optional(),
    updatedAt: z.number().int().optional(),
  })
  .strict();
export type MediaProject = z.infer<typeof mediaProject>;

// ── export presets (the offline data pack references these) ─
export const exportPreset = z
  .object({
    id: z.string().min(1).max(64),
    label: z.string().min(1).max(80),
    category: z.enum(["website", "mobile-app", "social", "general"]),
    mediaType: z.enum(["image", "video", "audio"]),
    /** Target box (images/video); omit for audio. */
    width: z.number().int().min(1).optional(),
    height: z.number().int().min(1).optional(),
    format: z.string().min(1).max(12), // jpg, webp, avif, mp4, webm, wav…
    note: z.string().max(200).optional(),
  })
  .strict();
export type ExportPreset = z.infer<typeof exportPreset>;
