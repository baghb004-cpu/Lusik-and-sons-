// ============================================================
// stitchPreviews — per-product config for the Live 3D panel
// ============================================================
// Each live product's signature moment on the 3D stitch stage
// (the same engine the /embroidery studio runs, embedded on the
// PDP via public/embroidery/stage.html). `text` is what stitches
// by default; `live: true` means the product is personalizable and
// the panel listens for the configurator's "stitch3d:live" events
// (typed name / chosen thread) and restitches in real time.
//
// panelMM drives the fabric size on stage (0.1mm units are handled
// stage-side); weave "terry" gives bibs/towels the looped-cloth
// surface. Colors are display-only — nothing here touches pricing.
// ============================================================

import { PRODUCT } from "./product.js";

// The blanket hero renders the REAL design — the canonical 7x7 layout the
// 2D BlanketLayoutPreview draws — not a name on a plain swatch. Defaults
// mirror the configurator's own initial state (first enabled layout, first
// alphabet, the "Boys" preset colors) so hero and configurator agree
// before the customer touches anything.
const BLANKET_LAYOUT = PRODUCT.layouts.find((l) => l.enabled) ?? PRODUCT.layouts[0];
const BLANKET_PRESET = PRODUCT.colorPresets[0];
const hexOf = (dmc) => PRODUCT.threadColors.find((c) => c.dmc === dmc)?.hex;
const BLANKET_DEFAULT = {
  letters: PRODUCT.alphabets[0].letters,
  preview: BLANKET_LAYOUT.preview,
  name: "", year: "",
  blockHex: hexOf(BLANKET_PRESET.block) ?? "#B5CEDE",
  letterHex: hexOf(BLANKET_PRESET.letter) ?? "#2B4C73",
  letterHexes: null,
};

export const STITCH_PREVIEWS = {
  // Configurator-led (live-wired to the inputs on the page)
  "blanket-alphabet": {
    text: "", thread: "#1f2f6b", fabric: "#efe6cf",
    panelMM: [250, 250], live: true,
    blanket: BLANKET_DEFAULT,
  },
  "bib-single": {
    text: "Օլէն", thread: "#1f2f6b", fabric: "#f4f2ec",
    panelMM: [180, 90], weave: "terry", live: true,
  },

  // Fixed-design pieces — their signature stitch
  "bib-hy-em": {
    text: "Հայ եմ ես", thread: "#d15c00", fabric: "#f4f2ec",
    panelMM: [190, 85], weave: "terry",
  },
  "bib-anushig-pair": {
    text: "Անուշիկ", thread: "#c26b8f", fabric: "#f4f2ec",
    panelMM: [180, 85], weave: "terry",
  },
  "bib-bari-akhorzhak-set": {
    text: "Բարի ախորժակ", thread: "#274b33", fabric: "#f4f2ec",
    panelMM: [230, 85], weave: "terry",
  },
  "bib-days-of-week": {
    text: "Երկուշաբթի", thread: "#1f2f6b", fabric: "#f4f2ec",
    panelMM: [210, 85], weave: "terry",
  },
  "blanket-full-alphabet": {
    text: "Ա Բ Գ Դ Ե Զ", thread: "#b8912e", fabric: "#efe6cf",
    panelMM: [260, 120],
  },
};

// The studio's thread board, mirrored for the PDP panel's swatch strip.
export const STITCH_THREADS = [
  ["Navy", "#1f2f6b"], ["Black", "#141414"], ["White", "#f4f2ea"],
  ["Gold", "#b8912e"], ["Burgundy", "#6d1b2e"], ["Flag orange", "#d15c00"],
];
