// ============================================================
// tracking — getTrackingUrl(carrier, trackingNumber)
// ============================================================
// Maps the admin-entered carrier label + tracking number into
// the right public carrier-tracking URL. Substring match on the
// carrier label (case-insensitive) is more forgiving than
// equality if the labels evolve. Returns null when no carrier
// matched OR when either argument is missing.
//
// Used by the customer's OrderCard and the admin row to render
// a "Track package →" link. The same logic is mirrored on the
// server in netlify/functions/_lib/email.mjs for the shipped-
// notification email — if you change carrier coverage here,
// mirror it there.
//
// MIRRORED FROM index.html (~line 8000).
// ============================================================

export function getTrackingUrl(
  carrier: string | null | undefined,
  trackingNumber: string | null | undefined,
): string | null {
  if (!trackingNumber || !carrier) return null;
  const c = carrier.toLowerCase();
  if (c.includes("usps"))  return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(trackingNumber)}`;
  if (c.includes("ups"))   return `https://www.ups.com/track?tracknum=${encodeURIComponent(trackingNumber)}`;
  if (c.includes("fedex")) return `https://www.fedex.com/fedextrack/?tracknumbers=${encodeURIComponent(trackingNumber)}`;
  return null;
}
