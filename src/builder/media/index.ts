// Media library — public surface (plan §20).

export { sniffImage, MAX_MEDIA_BYTES, type SniffedImage } from "./sniff.ts";
export {
  MEDIA_DIR,
  MEDIA_WEB_PREFIX,
  MediaPathError,
  sanitizeMediaBase,
  newMediaFileName,
  assertMediaFileName,
  mediaWebPath,
} from "./paths.ts";
export {
  createFsMediaStore,
  createGithubMediaStore,
  getMediaStore,
  type MediaStore,
  type MediaEntry,
  type GithubMediaConfig,
} from "./store.ts";
