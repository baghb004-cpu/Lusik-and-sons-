export function haptic(ms = 10) {
  try { navigator?.vibrate?.(ms); } catch { /* silent — not all devices support */ }
}
