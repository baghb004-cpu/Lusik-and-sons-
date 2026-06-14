// ============================================================
// Immersive Builder — mobile performance score (pure)
// ============================================================
// A friendly pre-export estimate: more sections, images, and heavy
// effects lower the score. Higher = lighter/faster. Returns honest
// warnings so a beginner can keep it fast on phones.
// ============================================================

import type { ScrollProject } from "./schemas.ts";

const HEAVY_ANIM = new Set(["parallax", "spin"]);
const IMG_TYPES = new Set(["image-reveal", "product-card", "showcase", "hero"]);
const QUALITY_PENALTY: Record<ScrollProject["quality"], number> = { lightweight: 0, balanced: 6, high: 16, desktop: 24 };

export interface PerfScore {
  score: number; // 0..100, higher is lighter
  grade: "great" | "okay" | "heavy";
  images: number;
  heavyEffects: number;
  warnings: string[];
}

export function scorePerformance(project: ScrollProject): PerfScore {
  const images = project.sections.filter((s) => IMG_TYPES.has(s.type) && s.imageUrl).length;
  const heavyEffects = project.sections.filter((s) => HEAVY_ANIM.has(s.animation)).length;
  let score = 100;
  score -= Math.max(0, project.sections.length - 5) * 4; // many sections add up
  score -= images * 6;
  score -= heavyEffects * 8;
  score -= QUALITY_PENALTY[project.quality];
  score = Math.max(0, Math.min(100, Math.round(score)));
  const grade = score >= 75 ? "great" : score >= 50 ? "okay" : "heavy";
  const warnings: string[] = [];
  if (images > 6) warnings.push(`${images} images — compress them and lazy-load (the export does this) so phones stay fast.`);
  if (heavyEffects > 3) warnings.push(`${heavyEffects} heavy effects (parallax/spin) — consider fewer, or the Lightweight quality on mobile.`);
  if (project.quality === "high" || project.quality === "desktop") warnings.push("High/Desktop quality is best left to big screens; phones default to Lightweight/Balanced.");
  if (project.sections.length > 8) warnings.push("Lots of sections — a shorter story usually feels better and loads faster.");
  if (warnings.length === 0) warnings.push("Looks light and fast. Remember: one beautiful effect beats ten busy ones.");
  return { score, grade, images, heavyEffects, warnings };
}
