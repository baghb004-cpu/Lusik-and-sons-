// ============================================================
// Embroidery (§31, Phase 5) — thread palette (pure data)
// ============================================================
// Brand-neutral thread colors. The numeric "ref" is a functional color id
// (the de-facto stitching numbering), not any brand's logo/branding. Hex is an
// approximation for on-screen preview only — always confirm against a real
// thread card before stitching.
// ============================================================

export interface Thread { ref: string; name: string; hex: string; }

export const THREADS: Thread[] = [
  { ref: "blanc", name: "White", hex: "#fcfcfc" },
  { ref: "ecru", name: "Ecru", hex: "#f0e9d2" },
  { ref: "310", name: "Black", hex: "#1a1a1a" },
  { ref: "318", name: "Steel Grey", hex: "#b6b6b6" },
  { ref: "413", name: "Dark Grey", hex: "#565656" },
  { ref: "415", name: "Pearl Grey", hex: "#d4d6d9" },
  { ref: "321", name: "Red", hex: "#c72b3b" },
  { ref: "498", name: "Dark Red", hex: "#a01828" },
  { ref: "606", name: "Bright Orange-Red", hex: "#fb3f1f" },
  { ref: "740", name: "Tangerine", hex: "#ff7b1c" },
  { ref: "742", name: "Light Tangerine", hex: "#ffbf57" },
  { ref: "743", name: "Yellow", hex: "#fed26a" },
  { ref: "744", name: "Pale Yellow", hex: "#ffe690" },
  { ref: "747", name: "Sky", hex: "#d2f0ef" },
  { ref: "996", name: "Electric Blue", hex: "#1aa3d8" },
  { ref: "995", name: "Dark Electric Blue", hex: "#0d7fb5" },
  { ref: "517", name: "Wedgewood", hex: "#1d6f93" },
  { ref: "311", name: "Navy", hex: "#1c476d" },
  { ref: "820", name: "Royal Blue", hex: "#173a73" },
  { ref: "702", name: "Kelly Green", hex: "#3aa83a" },
  { ref: "700", name: "Bright Green", hex: "#159145" },
  { ref: "699", name: "Dark Green", hex: "#0a7a37" },
  { ref: "905", name: "Parrot Green", hex: "#5a8a1f" },
  { ref: "907", name: "Light Parrot Green", hex: "#9ccf4f" },
  { ref: "211", name: "Lavender", hex: "#d6bfe0" },
  { ref: "208", name: "Violet", hex: "#8e5aa6" },
  { ref: "550", name: "Dark Violet", hex: "#6a2c79" },
  { ref: "718", name: "Plum", hex: "#c52580" },
  { ref: "603", name: "Pink", hex: "#ff8fb6" },
  { ref: "601", name: "Dark Pink", hex: "#d62783" },
  { ref: "898", name: "Coffee Brown", hex: "#5a3a23" },
  { ref: "433", name: "Brown", hex: "#7a4a26" },
  { ref: "435", name: "Tan", hex: "#b07b45" },
  { ref: "437", name: "Light Tan", hex: "#dab384" },
  { ref: "738", name: "Beige", hex: "#e8cfa6" },
  { ref: "3771", name: "Skin", hex: "#f0c3a6" },
];

export function thread(i: number): Thread {
  return THREADS[((i % THREADS.length) + THREADS.length) % THREADS.length];
}
