// ============================================================
// designUrl — encode/decode a picker state as a shareable URL
// ============================================================
// Used by the share-design flow on the PDP. The encoded form
// is a base64-JSON blob holding the picker's choices (alphabet
// key, layout key, color DMC numbers, preset key, multi-color
// list, custom name lines).
//
// resolveDesign() takes a decoded compact + the PRODUCT object
// and hydrates the picker's typed state (or returns null for
// any slot whose ref is stale or missing).
//
// Wrapped in try/catch so a malformed ?d=... share URL never
// crashes the PDP mount.
//
// MIRRORED FROM index.html (~line 4250).
// ============================================================

// Minimal shapes used at the design-URL boundary. The picker's
// in-memory state has richer types upstream; we just need the
// dmc / key fields here.
export interface DesignThreadColor { dmc: string; name?: string; hex?: string; }
export interface DesignAlphabet   { key: string; letters: string[]; }
export interface DesignLayout     { key: string; enabled?: boolean; }

export interface DesignPickerState {
  alphabet:        DesignAlphabet | null;
  layout:          DesignLayout   | null;
  blockColor:      DesignThreadColor | null;
  letterColor:     DesignThreadColor | null;
  letterColorList: DesignThreadColor[] | null;
  activePresetKey: string | null;
  customLine1:     string;
  customLine2:     string;
}

export interface DesignCompact {
  a?:  string | null;
  l?:  string | null;
  b?:  string | null;
  c?:  string | null;
  p?:  string | null;
  m?:  string | null;
  n1?: string | null;
  n2?: string | null;
}

export interface ResolvedDesign {
  alphabet:        DesignAlphabet | null;
  layout:          DesignLayout   | null;
  blockColor:      DesignThreadColor | null;
  letterColor:     DesignThreadColor | null;
  letterColorList: DesignThreadColor[] | null;
  activePresetKey: string | null;
  customLine1:     string;
  customLine2:     string;
}

export interface ResolveProduct {
  alphabets:    DesignAlphabet[];
  layouts:      DesignLayout[];
  threadColors: DesignThreadColor[];
}

export function encodeDesignToUrl(state: DesignPickerState): string | null {
  try {
    const compact = {
      a:  state.alphabet?.key ?? null,
      l:  state.layout?.key ?? null,
      b:  state.blockColor?.dmc ?? null,
      c:  state.letterColor?.dmc ?? null,
      p:  state.activePresetKey ?? null,
      m:  Array.isArray(state.letterColorList) && state.letterColorList.length > 0
            ? state.letterColorList.map((x) => x.dmc).join("|")
            : null,
      n1: (state.customLine1 ?? "").trim() || null,
      n2: (state.customLine2 ?? "").trim() || null,
    };
    // btoa requires ASCII — JSON.stringify gives us that.
    return btoa(JSON.stringify(compact));
  } catch {
    return null;
  }
}

// Hard cap on `?d=` length. A legitimate compact design serializes
// to <200 base64 chars; a multi-KB string can only be a typo or
// a malicious share link probing for a parse-bomb. 4 KB is
// generous headroom for any future expansion and bounds the
// worst-case JSON.parse cost.
const MAX_ENCODED_LENGTH = 4096;

export function decodeDesignFromUrl(encoded: string | null | undefined): DesignCompact | null {
  if (!encoded || typeof encoded !== "string") return null;
  if (encoded.length > MAX_ENCODED_LENGTH) return null;
  try {
    const compact = JSON.parse(atob(encoded));
    if (!compact || typeof compact !== "object") return null;
    return compact as DesignCompact;
  } catch {
    return null;
  }
}

// Resolve a decoded design back into the typed entries the
// picker uses. Missing or stale refs return null for that slot
// so the picker can keep its default.
export function resolveDesign(
  compact: DesignCompact | null,
  product: ResolveProduct,
): ResolvedDesign | null {
  if (!compact) return null;
  const alphabet    = product.alphabets.find((a) => a.key === compact.a) ?? null;
  const layout      = product.layouts.find((l) => l.key === compact.l && l.enabled !== false) ?? null;
  const blockColor  = product.threadColors.find((t) => t.dmc === compact.b) ?? null;
  const letterColor = product.threadColors.find((t) => t.dmc === compact.c) ?? null;
  let letterColorList: DesignThreadColor[] | null = null;
  if (typeof compact.m === "string" && compact.m.length > 0) {
    const dmcs = compact.m.split("|");
    const resolved = dmcs
      .map((d) => product.threadColors.find((t) => t.dmc === d))
      .filter((x): x is DesignThreadColor => Boolean(x));
    if (resolved.length > 0) letterColorList = resolved;
  }
  return {
    alphabet, layout, blockColor, letterColor, letterColorList,
    activePresetKey: typeof compact.p === "string" ? compact.p : null,
    customLine1: typeof compact.n1 === "string" ? compact.n1.slice(0, 16) : "",
    customLine2: typeof compact.n2 === "string" ? compact.n2.slice(0, 16) : "",
  };
}
