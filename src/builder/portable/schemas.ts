// ============================================================
// Portable environment — schemas (plan §23)
// ============================================================
// Everything private/local: profiles for the family, quests/XP,
// the Retro Game Room library, emulator/VM profiles, controller
// mappings, quick saves, environment settings. This data lives
// under portable/ (NOT the git document roots — saves and XP
// ticks shouldn't spam history; ISO paths are machine-specific)
// but every byte still passes a zod gate in the API layer.
//
// Two laws encoded here:
//   - BRAND-NEUTRAL controller language: labels/presets refuse
//     console brand names (the schema enforces what the spec
//     demands of the UI).
//   - USER-SUPPLIED MEDIA ONLY: entries hold *paths* to media the
//     user owns. Nothing here downloads, bundles, or describes
//     how to obtain anything.
// ============================================================

import { z } from "zod";

const id = z.string().regex(/^[a-z0-9][a-z0-9-]{1,40}$/);

// ── settings ────────────────────────────────────────────────
export const portableSettingsSchema = z
  .object({
    schemaVersion: z.number().int().min(1).default(1),
    /** The Retro Game Room is OFF until the owner flips this locally. */
    gameRoom: z.object({ enabled: z.boolean().default(false) }).default({ enabled: false }),
    /** Open Game Mode by default from the launcher (still optional). */
    gameModeDefault: z.boolean().default(false),
  })
  .strict();
export type PortableSettings = z.infer<typeof portableSettingsSchema>;

// ── profiles ────────────────────────────────────────────────
export const profileSchema = z
  .object({
    id,
    kind: z.enum(["owner", "family", "guest"]),
    displayName: z.string().min(1).max(40),
    theme: z.enum(["light", "dark", "candle"]).optional(),
    controllerProfileId: id.optional(),
    xp: z.number().int().min(0).default(0),
    /** questId → completed-at (ms). */
    quests: z.record(z.string(), z.number()).default({}),
    recentGames: z.array(id).max(12).default([]),
    accessibility: z
      .object({ reducedMotion: z.boolean().optional(), textScale: z.number().min(0.8).max(1.6).optional() })
      .strict()
      .optional(),
    createdAt: z.number().int(),
  })
  .strict();
export type Profile = z.infer<typeof profileSchema>;

// ── quick saves ─────────────────────────────────────────────
// A snapshot of "where I was": open project, game-mode scene, retro
// state. The state blob is intentionally loose (forward-compatible)
// but size-capped at the API.
export const quickSaveSchema = z
  .object({
    id,
    profileId: id,
    takenAt: z.number().int(),
    note: z.string().max(200).optional(),
    state: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
export type QuickSave = z.infer<typeof quickSaveSchema>;

// ── brand-neutral controller language ───────────────────────
// Internal detection may see any hardware; the UI never names a brand.
const BRAND_WORDS = /xbox|playstation|dualshock|dualsense|nintendo|joy-?con|switch\s?pro|steam\s?deck|stadia|luna/i;
const brandNeutral = (max: number) =>
  z.string().min(1).max(max).refine((s) => !BRAND_WORDS.test(s), "use brand-neutral controller language (e.g. \"Generic Pro Controller\")");

export const CONTROLLER_PRESETS = [
  "Generic Modern Controller",
  "Generic Dual-Stick Controller",
  "Generic Pro Controller",
  "Generic Retro Gamepad",
  "Generic Flight Stick",
  "Generic Arcade Stick",
  "Generic Keyboard + Mouse",
  "Generic USB Controller",
  "Generic Bluetooth Controller",
] as const;

export const CONTROLLER_INPUTS = [
  "a-button", "b-button", "x-button", "y-button",
  "l1-button", "r1-button", "l2-trigger", "r2-trigger",
  "left-stick", "right-stick", "left-stick-click", "right-stick-click",
  "dpad-up", "dpad-down", "dpad-left", "dpad-right",
  "start-button", "select-button", "menu-button",
] as const;

const bindingTarget = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("key"), value: z.string().regex(/^[a-z0-9_]{1,16}$/i) }).strict(),
  z.object({ kind: z.literal("mouse-move"), value: z.enum(["x", "y", "xy"]) }).strict(),
  z.object({ kind: z.literal("mouse-button"), value: z.enum(["left", "right", "middle"]) }).strict(),
  z.object({ kind: z.literal("joy-axis"), value: z.enum(["x", "y", "rx", "ry"]) }).strict(),
]);

export const controllerProfileSchema = z
  .object({
    id,
    label: brandNeutral(48),
    preset: z.enum(CONTROLLER_PRESETS),
    bindings: z
      .array(z.object({ input: z.enum(CONTROLLER_INPUTS), target: bindingTarget }).strict())
      .max(40)
      .default([]),
    notes: z.string().max(300).optional(),
  })
  .strict();
export type ControllerProfile = z.infer<typeof controllerProfileSchema>;

// ── emulator / VM profiles ──────────────────────────────────
// Backends are USER-INSTALLED open-source binaries in
// portable/retro/emulators/. We compose configs and launch args;
// we never ship OS images, BIOSes, or games.
export const EMULATOR_BACKENDS = ["dosbox-x", "86box", "qemu"] as const;

/** What kind of saving each backend honestly supports. */
export const SAVE_TIERS = ["save-states", "snapshots", "disk-state", "in-game-only"] as const;

export const emulatorProfileSchema = z
  .object({
    id,
    label: z.string().min(1).max(60),
    backend: z.enum(EMULATOR_BACKENDS),
    era: z.enum(["dos", "win95", "win98", "win2000", "winxp"]),
    ramMB: z.number().int().min(4).max(4096),
    cpu: z.string().max(40).optional(),
    graphics: z.string().max(40).optional(),
    audio: z.string().max(40).optional(),
    /** Path (under portable/retro/) to the VM dir / disk image the USER created. */
    machinePath: z.string().max(400).optional(),
    saveTier: z.enum(SAVE_TIERS),
    extraArgs: z.array(z.string().max(120)).max(20).default([]),
    notes: z.string().max(400).optional(),
  })
  .strict();
export type EmulatorProfile = z.infer<typeof emulatorProfileSchema>;

// ── the game library ────────────────────────────────────────
export const GAME_CATEGORIES = [
  "spongebob-era",
  "disney-learning",
  "rayman",
  "reader-rabbit",
  "other-retro",
] as const;

export const gameEntrySchema = z
  .object({
    id,
    title: z.string().min(1).max(80),
    category: z.enum(GAME_CATEGORIES),
    year: z.number().int().min(1980).max(2010).optional(),
    emulatorProfileId: id,
    /** The user's own legally created backup image. */
    isoPath: z.string().max(400).optional(),
    /** Or read straight from a physical drive (e.g. "D:" / /dev/sr0). */
    useDiscDrive: z.string().max(40).optional(),
    installPath: z.string().max(400).optional(),
    exePath: z.string().max(400).optional(),
    coverPath: z.string().max(400).optional(), // user-provided image only
    controllerProfileId: id.optional(),
    notes: z.string().max(600).optional(),
    addedAt: z.number().int(),
  })
  .strict()
  .refine((g) => g.isoPath || g.useDiscDrive || g.exePath, {
    message: "a game needs an ISO path, a disc drive, or an executable path",
  });
export type GameEntry = z.infer<typeof gameEntrySchema>;
