// ============================================================
// cartItems — canonical cart-item builders (Stripe contract)
// ============================================================
// The blanket + custom (bib) cart-item shapes whose `id` / `productKey`
// the server's trusted-products map keys off (mapLegacyId → TRUSTED_PRODUCTS).
// Changing the id shape here means changing _lib/trusted-products.mjs too;
// the e2e "Pay with Stripe POSTs to create-checkout-session" guards it.
//
// MIGRATION NOTE (Vite→Next, Phase 5): these are copied verbatim from the
// inline builders in src/App.jsx so the Next-side SiteProvider produces the
// IDENTICAL cart-id shape. App.jsx is intentionally left untouched (it is the
// live production code and is removed at the Phase 8 flip), so for now the two
// copies must stay in sync — keep this file and the App.jsx inline versions
// identical until App.jsx is retired, at which point this becomes the only copy.
// ============================================================

import { PRODUCT } from "../data/product.js";

export function buildBlanketCartItem(color, qty = 1, selection = null, layout = null, colors = null) {
  // `selection` is either a `letter` (legacy single-letter bib) or an
  // `alphabet` (current — Armenian/English). When alphabet, `layout` carries
  // the spatial arrangement, the letter count, and the price for this variant.
  // `colors` is { block, letter, letterColors?, presetKey? }.
  const isAlphabet = selection && typeof selection === "object" && Array.isArray(selection.letters);
  const isLetter = selection && typeof selection === "object" && "display" in selection;

  let id, subtitle, price;
  if (isAlphabet) {
    const layoutKey = layout?.key ?? "default";
    const blockDmc = colors?.block?.dmc ?? "default";
    const letterDmc = colors?.letter?.dmc ?? "default";
    const multiSig = Array.isArray(colors?.letterColors)
      ? "-multi-" + colors.letterColors.map((c) => c.dmc).join("_")
      : "";
    id = `blanket-${selection.key}-${layoutKey}-${blockDmc}-${letterDmc}${multiSig}`;
    const lettersStr = selection.letters.join(", ");
    const layoutLabel = layout?.shortLabel ?? "";
    let colorStr = "";
    if (colors) {
      if (Array.isArray(colors.letterColors) && colors.letterColors.length > 0) {
        const letterNames = colors.letterColors.map((c) => c.name).join(", ");
        colorStr = ` · ${colors.block.name} cube, letters in ${letterNames}`;
      } else {
        colorStr = ` · ${colors.block.name} cube, ${colors.letter.name} letter`;
      }
    }
    const cLine1 = (colors?.customLine1 ?? "").trim();
    const cLine2 = (colors?.customLine2 ?? "").trim();
    let customStr = "";
    if (cLine1 || cLine2) {
      const parts = [cLine1, cLine2].filter(Boolean).map((p) => `"${p}"`).join(" + ");
      customStr = ` · personalized ${parts}`;
      id += `-c${cLine1}_${cLine2}`;
    }
    subtitle = `${selection.label} alphabet — ${lettersStr} · ${layoutLabel}${colorStr}${customStr}`;
    price = layout ? layout.priceCents / 100 : PRODUCT.price;
  } else if (isLetter) {
    id = `blanket-${selection.language}-${selection.display}`;
    subtitle = `Letter: ${selection.display} (${selection.transliteration}, ${selection.language})`;
    price = PRODUCT.price;
  } else {
    id = `blanket-${color.name}`;
    subtitle = `Letter color: ${color.name}`;
    price = PRODUCT.price;
  }

  return {
    id, name: PRODUCT.name, subtitle,
    price, image: PRODUCT.gallery[0],
    qty, colorHex: color.hex,
    alphabet: isAlphabet ? selection : null,
    letter: isLetter ? selection : null,
    layout: isAlphabet ? layout : null,
    threadColors: isAlphabet && colors ? colors : null,
    customMetadata: isAlphabet ? {
      alphabet_key: selection.key,
      alphabet_label: selection.label,
      letters: selection.letters.join(","),
      layout_key: layout?.key ?? null,
      layout_label: layout?.label ?? null,
      layout_short_label: layout?.shortLabel ?? null,
      layout_description: layout?.description ?? null,
      letter_count: layout?.letterCount ?? null,
      block_color_name: colors?.block?.name ?? null,
      block_color_hex: colors?.block?.hex ?? null,
      block_color_ref: colors?.block?.dmc ?? null,
      letter_color_name: colors?.letter?.name ?? null,
      letter_color_hex: colors?.letter?.hex ?? null,
      letter_color_ref: colors?.letter?.dmc ?? null,
      letter_colors_multi: Array.isArray(colors?.letterColors)
        ? colors.letterColors.map((c) => `${c.name} (${c.hex})`).join(" | ")
        : null,
      color_preset_key: colors?.presetKey ?? null,
      custom_line_1: (colors?.customLine1 ?? "").trim() || null,
      custom_line_2: (colors?.customLine2 ?? "").trim() || null,
    } : null,
  };
}

export function buildCustomCartItem({ productKey, name, price, size, customImage, customImageName, subtitleOverride, customMetadata }) {
  return {
    // Each custom upload gets a unique id so multiple custom items don't merge.
    id: `${productKey}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    subtitle: subtitleOverride || `Size: ${size}`,
    price,
    image: customImage || PRODUCT.gallery[0],
    qty: 1,
    isCustom: true,
    productKey,
    size,
    customImageName,
    customMetadata: customMetadata || null,
  };
}
