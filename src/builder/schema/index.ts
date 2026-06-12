// Builder schema — public surface. Everything outside src/builder
// imports from here (or from ../engine), never from the internals.

export {
  richTextDoc,
  richTextNode,
  textDoc,
  safeHref,
  imageSrc,
  SAFE_HREF_RE,
  SAFE_IMAGE_SRC_RE,
  type RichTextDoc,
  type RichTextNode,
} from "./richtext.ts";

export { styleProps, tokenRef, cssLength, hexColor, type StyleProps } from "./style.ts";

export {
  blockSchema,
  blockId,
  newId,
  BLOCK_TYPES,
  CONTAINER_TYPES,
  BLOCK_ID_RE,
  PILL_ICONS,
  SOCIAL_PLATFORMS,
  productRef,
  PRODUCT_REF_RE,
  type Block,
} from "./block.ts";

export {
  pageSchema,
  pageKind,
  templateSchema,
  templateKind,
  overrideLayerSchema,
  revisionSchema,
  breakpoint,
  slug,
  SLUG_RE,
  type Page,
  type Template,
  type OverrideLayer,
  type BlockPatch,
  type Breakpoint,
  type Revision,
  chromeSchema,
  CHROME_PATH,
  type Chrome,
} from "./documents.ts";

export { themeSchema, glassPreset, appearanceSchema, candlelightSchema, type Theme, type GlassPreset, type Appearance, type Candlelight } from "./theme.ts";

export { CURRENT_SCHEMA_VERSION, migrateDocument, SchemaVersionError } from "./migrate.ts";
