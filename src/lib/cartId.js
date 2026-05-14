// ============================================================
// cartId — map cart row IDs to server-side product keys
// ============================================================
// **Load-bearing for Stripe checkout.** The browser composes a
// rich cart-row id that encodes the chosen alphabet, layout,
// and colors (so two orders with different colors stack as
// separate line items, not qty=2). The server-side
// TRUSTED_PRODUCTS map only knows the layout-level keys
// (`blanket-double_diag_br`, `bib`). This function bridges
// the two.
//
// The cart-ID shape MUST stay in sync with what
// netlify/functions/_lib/trusted-products.mjs accepts. The
// E2E smoke test "Pay with Stripe POSTs to create-checkout-
// session" guards the contract — keep that test green.
//
// Cart-ID format (current):
//   blanket: blanket-{alphabet}-{layoutKey}-{blockDmc}-{letterDmc}[-multi-{dmcs}][-c{checksum}]
//   bib:     bib-{...}
//
// Layout keys themselves use underscores, never dashes, so
// splitting on `-` and taking parts[2] reliably grabs the
// whole layout token.
//
// MIRRORED FROM index.html (~line 11849, inside CheckoutView).
// ============================================================

export function mapLegacyId(id) {
  if (!id) return null;
  if (id.startsWith?.("bib-")) return "bib";
  if (id.startsWith?.("blanket-")) {
    const parts = id.split("-");
    if (parts.length >= 3) return `blanket-${parts[2]}`;
    return "blanket";
  }
  return null;
}
