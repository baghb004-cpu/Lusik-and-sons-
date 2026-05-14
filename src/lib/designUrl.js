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

export function encodeDesignToUrl(state) {
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

export function decodeDesignFromUrl(encoded) {
  if (!encoded || typeof encoded !== "string") return null;
  try {
    const compact = JSON.parse(atob(encoded));
    if (!compact || typeof compact !== "object") return null;
    return compact;
  } catch {
    return null;
  }
}

// Resolve a decoded design back into the typed entries the
// picker uses. Missing or stale refs return null for that slot
// so the picker can keep its default.
export function resolveDesign(compact, product) {
  if (!compact) return null;
  const alphabet    = product.alphabets.find((a) => a.key === compact.a) ?? null;
  const layout      = product.layouts.find((l) => l.key === compact.l && l.enabled !== false) ?? null;
  const blockColor  = product.threadColors.find((t) => t.dmc === compact.b) ?? null;
  const letterColor = product.threadColors.find((t) => t.dmc === compact.c) ?? null;
  let letterColorList = null;
  if (typeof compact.m === "string" && compact.m.length > 0) {
    const dmcs = compact.m.split("|");
    const resolved = dmcs.map((d) => product.threadColors.find((t) => t.dmc === d)).filter(Boolean);
    if (resolved.length > 0) letterColorList = resolved;
  }
  return {
    alphabet, layout, blockColor, letterColor, letterColorList,
    activePresetKey: typeof compact.p === "string" ? compact.p : null,
    customLine1: typeof compact.n1 === "string" ? compact.n1.slice(0, 16) : "",
    customLine2: typeof compact.n2 === "string" ? compact.n2.slice(0, 16) : "",
  };
}
