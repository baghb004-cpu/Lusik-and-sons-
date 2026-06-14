// ============================================================
// Virtual Tour — preset tours (pure data)
// ============================================================
import { tourProjectSchema, type TourProject, type Scene360 } from "./schemas.ts";

let n = 0;
const sc = (name: string, hotspots: Scene360["hotspots"] = []): Scene360 => ({ id: `scene-${++n}`, name, mediaType: "photo", src: "", startYaw: 0, startPitch: 0, autoplay: false, loop: true, hotspots });

interface Spec { key: string; name: string; scenes: Scene360[] }

const SPECS: Spec[] = [
  { key: "single", name: "Single 360 photo", scenes: [sc("Main view", [{ id: "h1", yaw: 30, pitch: 0, label: "Info", kind: "info", text: "Add a description here.", targetSceneId: "" }])] },
  { key: "tour", name: "Two-scene tour", scenes: [] }, // filled below (needs linked ids)
  { key: "showroom", name: "Showroom", scenes: [sc("Showroom", [{ id: "p1", yaw: -40, pitch: -5, label: "Product A", kind: "info", text: "Details about product A.", targetSceneId: "" }, { id: "p2", yaw: 50, pitch: -5, label: "Product B", kind: "info", text: "Details about product B.", targetSceneId: "" }])] },
];

export function makeTourPreset(key: string, id = `tour-${Date.now()}`): TourProject | null {
  if (key === "tour") {
    const a = sc("Entrance"); const b = sc("Back room");
    a.hotspots = [{ id: "go-b", yaw: 0, pitch: 0, label: "Go to back room →", kind: "scene", text: "", targetSceneId: b.id }];
    b.hotspots = [{ id: "go-a", yaw: 0, pitch: 0, label: "← Back to entrance", kind: "scene", text: "", targetSceneId: a.id }];
    return tourProjectSchema.parse({ id, name: "Two-scene tour", scenes: [a, b] });
  }
  const spec = SPECS.find((s) => s.key === key);
  if (!spec) return null;
  return tourProjectSchema.parse({ id, name: spec.name, scenes: spec.scenes.map((s) => ({ ...s })) });
}

export const TOUR_PRESET_LIST = [
  { key: "single", name: "Single 360 photo" },
  { key: "tour", name: "Two-scene tour" },
  { key: "showroom", name: "Showroom" },
];
