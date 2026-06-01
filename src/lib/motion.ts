// ============================================================
// motion — shared Framer Motion presets (the movement language)
// ============================================================
// Framer Motion is used ONLY for movement — entrances/exits, springs,
// and tap/press feedback. The Liquid Glass *material* (blur, tint,
// bevel, sheen, shadow) is pure CSS in src/styles/index.css; nothing
// here paints glass.
//
// Everything Apple-feeling about the motion lives in these few
// constants so the whole app shares one cadence. Springs for things
// the finger drives (drawers, sheets, the cart swipe); eased curves
// for content that simply appears (page/section reveals).
//
// Reduced motion is handled globally by <MotionConfig reducedMotion="user">
// in MotionProvider, so individual components don't each re-check the
// media query — Framer drops the transforms and keeps opacity.
// ============================================================

import type { Transition, Variants } from "framer-motion";

// Apple's signature "ease-out-quint"-ish curve — quick to leave, long
// to settle. Used for content that appears (no physics needed).
export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

// ── Springs (for finger-driven / physical surfaces) ──────────
// Soft: drawers + sheets — weighty but not floaty.
export const springSoft: Transition = { type: "spring", stiffness: 320, damping: 34, mass: 0.9 };
// Snappy: small controls settling back (swipe row snap, badge pop).
export const springSnappy: Transition = { type: "spring", stiffness: 520, damping: 36, mass: 0.7 };
// Gentle: the lens / large position glides.
export const springGentle: Transition = { type: "spring", stiffness: 210, damping: 30, mass: 1 };

// ── Eased transitions (for content that simply reveals) ──────
export const easeBase: Transition = { duration: 0.42, ease: EASE_OUT };
export const easeFast: Transition = { duration: 0.26, ease: EASE_OUT };

// ── Press feedback (whileTap) ────────────────────────────────
// Two depths: orbs/buttons press in a touch more than large cards.
export const tapScale = { scale: 0.92 };
export const tapScaleSubtle = { scale: 0.97 };

// ── Variants ─────────────────────────────────────────────────

// Page / section content: a small rise + fade. Deliberately subtle —
// the chrome stays put, only the content settles in.
export const fadeRise: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: easeBase },
  exit: { opacity: 0, y: -6, transition: easeFast },
};

// Modal / popover: scale up from 96% with a fade.
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: { ...springSoft, opacity: easeFast } },
  exit: { opacity: 0, scale: 0.98, transition: easeFast },
};

// Scrim / backdrop behind any overlay.
export const backdrop: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: easeFast },
  exit: { opacity: 0, transition: easeFast },
};

// Right-edge drawer (desktop cart).
export const drawerRight: Variants = {
  hidden: { x: "100%" },
  show: { x: 0, transition: springSoft },
  exit: { x: "100%", transition: { duration: 0.28, ease: EASE_OUT } },
};

// Bottom sheet (mobile).
export const sheetUp: Variants = {
  hidden: { y: "100%" },
  show: { y: 0, transition: springSoft },
  exit: { y: "100%", transition: { duration: 0.28, ease: EASE_OUT } },
};

// Staggered list reveal — parent orchestrates, children use fadeRise.
export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};
