// ============================================================
// Creation Studio — the tool registry (pure data, §30 Phase 1)
// ============================================================
// One list powering the hub at /tools. Every entry is an offline,
// on-device tool/mode in the same platform. hrefs are app-relative so
// the hub can carry the Workshop token forward (same origin).
// ============================================================

export interface StudioTool {
  href: string;
  name: string;
  blurb: string;
  group: "make" | "business" | "media";
  emoji: string;
}

export const STUDIO_TOOLS: StudioTool[] = [
  { href: "/builder", name: "Website & App Builder", blurb: "The main visual builder — pages, blocks, themes, and exports.", group: "make", emoji: "🧱" },
  { href: "/tools/immersive", name: "Immersive Builder", blurb: "Scroll-story 3D websites & app screens that reveal as you scroll.", group: "make", emoji: "✨" },
  { href: "/tools/game-lab", name: "Game Lab", blurb: "Make small original games and export real Godot projects.", group: "make", emoji: "🕹️" },
  { href: "/tools/store", name: "Store Manager", blurb: "Customers, inventory, barcodes, purchase history, CSV reports.", group: "business", emoji: "🏪" },
  { href: "/tools/coach", name: "Communication Coach", blurb: "Practice client outreach calls and interviews, honestly.", group: "business", emoji: "🗣️" },
  { href: "/tools/payroll", name: "Payroll & SE-Tax", blurb: "Calculate take-home and what to set aside, with verified figures.", group: "business", emoji: "💵" },
  { href: "/tools/tax", name: "Tax Assistant", blurb: "A private organizer — what to gather, which forms, encrypted save.", group: "business", emoji: "🧾" },
  { href: "/tools/media-studio", name: "Media Studio", blurb: "Trim and convert your photos, video, and recordings locally.", group: "media", emoji: "🎬" },
  { href: "/tools/photo-booth", name: "Photo Booth Builder", blurb: "Build an event photo booth — countdown, frames, local save.", group: "media", emoji: "📸" },
];

export const STUDIO_GROUPS: Array<{ id: StudioTool["group"]; title: string }> = [
  { id: "make", title: "Make" },
  { id: "business", title: "Run your business" },
  { id: "media", title: "Media & events" },
];
