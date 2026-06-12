// Builder renderer — public surface. Server-component-safe:
// nothing in this package uses hooks, state, or "use client".

export { BlockRenderer, type BlockRendererProps } from "./BlockRenderer.tsx";
export { RichText } from "./RichText.tsx";
export { BLOCK_COMPONENTS, type RenderContext } from "./blocks.tsx";
export { resolveStyle, visibilityClasses, tokenToCss, cx } from "./style.ts";
export { JUMPER_STOP_SELECTORS, jumperDomId, sectionJumperScript, sectionJumperCss } from "./jumperScript.ts";
