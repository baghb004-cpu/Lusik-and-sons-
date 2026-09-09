// ============================================================
// designBus — the typed "what is the customer designing?" channel
// ============================================================
// The configurators (ProductShowcase for the alphabet blanket,
// CustomProductCard for the name bib) publish their full design state
// here on every change. Consumers subscribe to render it somewhere
// else: the 3D product engine planned in SITE_OVERHAUL_HANDOFF.md
// (Phase 1) restitches from this event. Nothing subscribes today.
//
// This replaced the untyped "stitch3d:live" / "stitch3d:hero"
// CustomEvents that used to feed the removed Embroidery Studio stage.
// The bus is one-way (configurator → viewers); the configurator's own
// React state stays the single source of truth for the cart.
// ============================================================

export interface BlanketDesign {
  product: "blanket-alphabet";
  letters: string[];          // the three letters, e.g. ["Ա", "Բ", "Գ"]
  alphabet: string;           // PRODUCT.alphabets[].key
  layoutKey: string;          // PRODUCT.layouts[].key
  preview: number[];          // 7x7 grid cells the letter cubes occupy
  name: string;               // personalization line 1 (may be "")
  year: string;               // personalization line 2 (may be "")
  blockHex?: string;
  letterHex?: string;
  letterHexes: string[] | null; // per-letter colors (Armenian-flag preset), else null
}

export interface BibDesign {
  product: "bib-single";
  name: string;
  threadHex?: string;
}

export type DesignChange = BlanketDesign | BibDesign | ({ product: string } & Record<string, unknown>);

const EVENT_NAME = "design:change";

export function publishDesign(design: DesignChange): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<DesignChange>(EVENT_NAME, { detail: design }));
}

export function subscribeDesign(listener: (design: DesignChange) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => listener((e as CustomEvent<DesignChange>).detail);
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
