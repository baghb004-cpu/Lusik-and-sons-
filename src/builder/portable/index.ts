// Portable environment + Game Mode + Retro Game Room — public surface (plan §23).

export {
  portableSettingsSchema,
  profileSchema,
  quickSaveSchema,
  controllerProfileSchema,
  emulatorProfileSchema,
  gameEntrySchema,
  CONTROLLER_PRESETS,
  CONTROLLER_INPUTS,
  EMULATOR_BACKENDS,
  SAVE_TIERS,
  GAME_CATEGORIES,
  type PortableSettings,
  type Profile,
  type QuickSave,
  type ControllerProfile,
  type EmulatorProfile,
  type GameEntry,
} from "./schemas.ts";

export { createPortableStore, PortablePathError, PORTABLE_DIR, PORTABLE_SKELETON, type PortableStore } from "./store.ts";
export { composeLaunch, pathsToVerify, dosboxMapperLines, type LaunchPlan } from "./retro.ts";
export { QUESTS, LEVELS, levelFor, awardQuest, type Quest } from "./quests.ts";

export {
  EMULATOR_CATALOG,
  ERA_CHECKLISTS,
  GAME_TEMPLATES,
  emulatorProfileForTemplate,
  type EmulatorInfo,
  type GameTemplate,
  type ChecklistItem,
} from "./gameTemplates.ts";
export { healthReport, healthSummary, detectedBackends, isPortablePathAdvice, type HealthFacts, type HealthItem } from "./health.ts";
