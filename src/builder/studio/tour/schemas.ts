// ============================================================
// Creation Studio — Virtual Tour (360) data model (§30, Phase 6)
// ============================================================
// Equirectangular 360 photo/video scenes with hotspots + scene links.
// 100% offline: the viewer is a tiny dependency-free WebGL renderer
// bundled into the export — no Three.js, no CDN. Media is the user's own.
// ============================================================

import { z } from "zod";

export const HOTSPOT_KINDS = ["info", "link", "scene"] as const;
export const hotspotSchema = z.object({
  id: z.string().min(1),
  // direction on the sphere, in degrees
  yaw: z.number().default(0), // -180..180, left/right
  pitch: z.number().min(-89).max(89).default(0), // up/down
  label: z.string().default(""),
  kind: z.enum(HOTSPOT_KINDS).default("info"),
  text: z.string().default(""), // info text / link href
  targetSceneId: z.string().default(""), // for kind "scene"
});
export type Hotspot = z.infer<typeof hotspotSchema>;

export const scene360Schema = z.object({
  id: z.string().min(1),
  name: z.string().default("Scene"),
  mediaType: z.enum(["photo", "video"]).default("photo"),
  // a relative asset path (export) — the dataURL is held separately in the UI
  src: z.string().default(""),
  startYaw: z.number().default(0),
  startPitch: z.number().default(0),
  autoplay: z.boolean().default(false), // video
  loop: z.boolean().default(true), // video
  hotspots: z.array(hotspotSchema).default([]),
});
export type Scene360 = z.infer<typeof scene360Schema>;

export const tourProjectSchema = z.object({
  schemaVersion: z.number().int().min(1).default(1),
  id: z.string().min(1),
  name: z.string().min(1).default("My Virtual Tour"),
  fov: z.number().min(40).max(110).default(75),
  enableGyro: z.boolean().default(true),
  scenes: z.array(scene360Schema).default([]),
});
export type TourProject = z.infer<typeof tourProjectSchema>;
