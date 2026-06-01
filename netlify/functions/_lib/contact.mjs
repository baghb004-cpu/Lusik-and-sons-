// ============================================================
// Contact info — single source of truth for server-side emails
// ============================================================
// The browser side has CONFIG.SUPPORT_PHONE / SUPPORT_PHONE_DISPLAY
// in src/data/config.js. The server side previously hardcoded the same
// strings into _lib/email.mjs ~16 times — change the phone and
// you'd have to grep + replace across every email composer, and
// miss one means customers get an outdated number in some emails
// but not others. This module is the chokepoint.
//
// Browser + server still each have their own copy (browser can't
// import server modules), but the values are stable enough that a
// once-a-year human "grep and reconcile" is acceptable. If they
// ever start drifting frequently, mirror the pricing-drift test
// pattern from _lib/__tests__/pricing-drift.test.mjs and grep
// src/data/config.js for CONFIG.SUPPORT_PHONE.
// ============================================================

export const CONTACT = Object.freeze({
  email:        "hello@lusikandsons.com",
  phoneTel:     "+17608742333",     // E.164 for <a href="tel:..."> targets
  phoneDisplay: "(760) 874-2333",   // human-readable form for the visible text
});
