// ============================================================
// Builder schema — style properties
// ============================================================
// Block styling references THEME TOKENS by default ("color.ink",
// "spacing.md") with a raw-CSS-value escape hatch. Token-first is
// what makes the theme panel and global restyling possible; the
// regexes below are also the guard that keeps arbitrary CSS (and
// therefore CSS-based layout breakage/injection) out of documents.
// ============================================================

import { z } from "zod";

export const TOKEN_REF_RE = /^(?:color|spacing|radius|shadow|font|typeScale)\.[A-Za-z0-9_.-]+$/;
export const tokenRef = z.string().regex(TOKEN_REF_RE);

export const CSS_LENGTH_RE = /^-?\d+(?:\.\d+)?(?:px|rem|em|%|vw|vh|svh|dvh)$/;
export const cssLength = z.string().regex(CSS_LENGTH_RE);

export const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
export const hexColor = z.string().regex(HEX_COLOR_RE);

const sizeValue = z.union([tokenRef, cssLength, z.literal("auto"), z.literal("full")]);
const colorValue = z.union([tokenRef, hexColor, z.literal("transparent")]);

const boxSides = z
  .object({
    top: sizeValue.optional(),
    right: sizeValue.optional(),
    bottom: sizeValue.optional(),
    left: sizeValue.optional(),
  })
  .strict();

export const styleProps = z
  .object({
    margin: boxSides.optional(),
    padding: boxSides.optional(),
    width: sizeValue.optional(),
    height: sizeValue.optional(),
    maxWidth: sizeValue.optional(),
    gap: sizeValue.optional(),
    align: z.enum(["start", "center", "end", "stretch"]).optional(),
    textAlign: z.enum(["left", "center", "right"]).optional(),
    background: colorValue.optional(),
    textColor: colorValue.optional(),
    radius: z.union([tokenRef, cssLength]).optional(),
    shadow: z.union([tokenRef, z.literal("none")]).optional(),
  })
  .strict();

export type StyleProps = z.infer<typeof styleProps>;
