// ============================================================
// Photo Booth — booth templates (pure data)
// ============================================================
import { boothProjectSchema, type BoothProject } from "./schemas.ts";

interface Spec {
  key: string;
  name: string;
  patch: Partial<BoothProject>;
}

const SPECS: Spec[] = [
  { key: "selfie", name: "Simple selfie station", patch: { layout: "single", photoCount: 1, countdown: 3, filter: "none" } },
  { key: "strip", name: "3-photo strip", patch: { layout: "strip", photoCount: 3, countdown: 3, filter: "warm" } },
  { key: "collage", name: "4-photo collage", patch: { layout: "grid", photoCount: 4, countdown: 3, filter: "none" } },
  { key: "event", name: "Branded event booth", patch: { layout: "strip", photoCount: 3, countdown: 5, filter: "vintage", eventName: "Our Event" } },
  { key: "holiday", name: "Holiday booth", patch: { layout: "grid", photoCount: 4, countdown: 3, filter: "cool", eventName: "Happy Holidays" } },
  { key: "promo", name: "Product promo booth", patch: { layout: "single", photoCount: 1, countdown: 5, filter: "contrast", eventName: "New Arrival" } },
];

export function makeBoothPreset(key: string, id = `booth-${Date.now()}`): BoothProject | null {
  const spec = SPECS.find((s) => s.key === key);
  if (!spec) return null;
  return boothProjectSchema.parse({ id, name: spec.name, ...spec.patch });
}

export const BOOTH_PRESET_LIST = SPECS.map((s) => ({ key: s.key, name: s.name }));
