// ============================================================
// Renderer — StyleProps → CSS, visibility → Tailwind classes
// ============================================================
// Token refs ("color.ink", "spacing.md") become CSS custom
// property references — the theme compiles tokens to the same
// --bt-* variables in Phase 5, so re-theming never touches
// documents. Raw values pass through (the schema already
// constrained them to safe shapes).
//
// Visibility uses COMPLETE class-string literals below because
// Tailwind's scanner only sees static strings (the repo-wide
// dynamic-class gotcha — see tailwind.config.mjs). Device
// buckets match the site: mobile <768, tablet 768–1023, lg+.
// ============================================================

import type { CSSProperties } from "react";
import type { Block, StyleProps } from "../schema/index.ts";
import { TOKEN_REF_RE } from "../schema/style.ts";

export function tokenToCss(value: string): string {
  if (TOKEN_REF_RE.test(value)) {
    return `var(--bt-${value.replace(/\./g, "-")})`;
  }
  if (value === "full") return "100%";
  return value; // raw CSS length/color/auto — schema-constrained
}

const side = (v?: string) => (v === undefined ? undefined : tokenToCss(v));

export function resolveStyle(style?: StyleProps): CSSProperties {
  if (!style) return {};
  const css: CSSProperties = {};
  if (style.margin) {
    css.marginTop = side(style.margin.top);
    css.marginRight = side(style.margin.right);
    css.marginBottom = side(style.margin.bottom);
    css.marginLeft = side(style.margin.left);
  }
  if (style.padding) {
    css.paddingTop = side(style.padding.top);
    css.paddingRight = side(style.padding.right);
    css.paddingBottom = side(style.padding.bottom);
    css.paddingLeft = side(style.padding.left);
  }
  if (style.width) css.width = tokenToCss(style.width);
  if (style.height) css.height = tokenToCss(style.height);
  if (style.maxWidth) css.maxWidth = tokenToCss(style.maxWidth);
  if (style.gap) css.gap = tokenToCss(style.gap);
  if (style.align) css.alignItems = style.align === "start" ? "flex-start" : style.align === "end" ? "flex-end" : style.align;
  if (style.textAlign) css.textAlign = style.textAlign;
  if (style.background) css.background = tokenToCss(style.background);
  if (style.textColor) css.color = tokenToCss(style.textColor);
  if (style.radius) css.borderRadius = tokenToCss(style.radius);
  if (style.shadow) css.boxShadow = style.shadow === "none" ? "none" : tokenToCss(style.shadow);
  return css;
}

// Full literals — statically visible to the Tailwind scanner.
const HIDE_MOBILE = "max-md:hidden";
const HIDE_TABLET = "md:max-lg:hidden";
const HIDE_DESKTOP = "lg:hidden";

export function visibilityClasses(v?: Block["visibility"]): string {
  if (!v) return "";
  const classes: string[] = [];
  if (v.mobile === false) classes.push(HIDE_MOBILE);
  if (v.tablet === false) classes.push(HIDE_TABLET);
  if (v.desktop === false) classes.push(HIDE_DESKTOP);
  return classes.join(" ");
}

export function cx(...parts: Array<string | undefined | false>): string {
  return parts.filter(Boolean).join(" ");
}
