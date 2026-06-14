// Offline Media Studio — public surface (plan §26).
export {
  PRIVACY_LEVELS, MEDIA_KINDS, privacyLevel, mediaKind,
  mediaItem, clip, track, mediaProject, exportPreset,
  type PrivacyLevel, type MediaKind, type MediaItem, type Clip, type Track, type MediaProject, type ExportPreset,
} from "./schemas.ts";
export {
  FORMATS, EXPORT_PRESETS, ASPECT_RATIOS, PHONE_AUDIO_EXTS,
  formatFor, isImportable, type FormatInfo, type SupportLevel,
} from "./formats.ts";
export {
  clipDuration, trimStart, trimEnd, moveClip, splitAtPlayhead, snapOffset,
  timelineDuration, newClipName, saveAsNewClip, detachAudioSpec, type NewClipSpec,
} from "./engine.ts";
export { HELP, helpById, type HelpEntry } from "./help.ts";
export { probeCmd, thumbnailCmd, extractFrameCmd, waveformCmd, trimCmd, detachAudioCmd, imageExportCmd, videoExportCmd, parseProbeJson, IMAGE_PRESETS, imagePresetCmd, type FfCommand, type ImagePreset } from "./ffmpeg.ts";
