// ============================================================
// haptics — parity with ios/LusikSons/Theme/Haptics.swift (which
// itself mirrors the website's haptic.js touchpoints).
// ============================================================
// navigator.vibrate fires on Android browsers; iOS Safari has no
// vibration API and silently ignores it — visual feedback carries
// iPhones until WebKit ships one. Same vocabulary, same call sites
// as the Swift enum, so the two apps stay one design.

const buzz = (pattern) => {
  try {
    navigator?.vibrate?.(pattern);
  } catch {
    /* silent — not all devices support it */
  }
};

export const haptics = {
  /** Add to bag / buy now (Swift .add, web haptic(12)). */
  add: () => buzz(12),
  /** Removing a bag row (Swift .remove, web haptic(8)). */
  remove: () => buzz(8),
  /** Quantity / option stepping (Swift .step). */
  step: () => buzz(8),
  /** Chrome taps — tab switches (Swift .tap). */
  tap: () => buzz(6),
  /** A completed moment — order placed, waitlist joined (Swift .success). */
  success: () => buzz([10, 60, 14]),
};
