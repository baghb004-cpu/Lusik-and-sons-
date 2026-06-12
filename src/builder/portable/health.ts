// ============================================================
// Retro Game Room — health check (pure, plan §23b)
// ============================================================
// One function turns filesystem facts into the wizard's status
// table: what's READY, what's MISSING, who fixes it (a Fix
// button, the fetch script, or only the user — their own media
// and licenses can never be a button). The API gathers the
// facts; this stays pure and unit-tested.
//
// Privacy is a first-class row: the room is offline/local-only
// BY CONSTRUCTION (no telemetry, no accounts, no cloud, reads
// nothing outside portable/), and the health screen says so
// instead of leaving it implied.
// ============================================================

import { EMULATOR_CATALOG, GAME_TEMPLATES } from "./gameTemplates.ts";
import type { EmulatorProfile, GameEntry } from "./schemas.ts";

export interface HealthFacts {
  /** File names found in portable/retro/emulators/. */
  emulatorFiles: string[];
  games: Array<Pick<GameEntry, "id" | "title"> & { missing: Array<{ field: string; path: string }> }>;
  emulatorProfiles: Array<Pick<EmulatorProfile, "id" | "backend" | "machinePath">>;
  controllerProfiles: number;
  gameRoomEnabled: boolean;
  /** Skeleton dirs that exist (relative names). */
  dirsPresent: string[];
  godotExportPresent: boolean;
  launcherExePresent: boolean | null; // null = not determinable (dev mode)
  vmImages: string[];
}

export type HealthStatus = "ready" | "missing" | "optional" | "info";

export interface HealthItem {
  id: string;
  label: string;
  status: HealthStatus;
  detail: string;
  /** A Fix-This button the API can actually perform. */
  fix?: { action: "enable-room" | "create-dirs" | "seed-profiles" | "seed-controller"; label: string };
  /** Official guidance when only the user can supply it. */
  guidance?: { label: string; url?: string };
}

export function detectedBackends(emulatorFiles: string[]): string[] {
  const lower = emulatorFiles.map((f) => f.toLowerCase());
  return EMULATOR_CATALOG.filter((e) => e.binaries.some((b) => lower.includes(b.toLowerCase()))).map((e) => e.backend);
}

export function healthReport(facts: HealthFacts): HealthItem[] {
  const items: HealthItem[] = [];
  const backends = detectedBackends(facts.emulatorFiles);

  items.push({
    id: "privacy",
    label: "Privacy mode",
    status: "ready",
    detail:
      "Fully local: no telemetry, no accounts, no cloud, no internet needed. The room only ever reads inside portable/ — nothing else is scanned.",
  });

  items.push(
    facts.gameRoomEnabled
      ? { id: "room", label: "Retro Game Room", status: "ready", detail: "Enabled for this private build." }
      : {
          id: "room",
          label: "Retro Game Room",
          status: "missing",
          detail: "Switched off (the safe default). One click turns it on for this local build only.",
          fix: { action: "enable-room", label: "Enable the room" },
        }
  );

  const dirsOk = facts.dirsPresent.length > 0;
  items.push(
    dirsOk
      ? { id: "dirs", label: "Portable folders", status: "ready", detail: "Saves, backups, media and profile folders are in place." }
      : { id: "dirs", label: "Portable folders", status: "missing", detail: "The portable/retro skeleton hasn't been created yet.", fix: { action: "create-dirs", label: "Create the folders" } }
  );

  for (const emu of EMULATOR_CATALOG) {
    const found = backends.includes(emu.backend);
    items.push({
      id: `backend-${emu.backend}`,
      label: emu.label,
      status: found ? "ready" : emu.backend === "qemu" ? "missing" : "optional",
      detail: found
        ? `Detected in portable/retro/emulators/. ${emu.bestFor}`
        : `${emu.bestFor} ${emu.bundling}`,
      guidance: found ? undefined : { label: `Official ${emu.label} downloads (or run: node scripts/fetch-emulators.mjs)`, url: emu.officialUrl },
    });
  }

  const profileIds = new Set(facts.emulatorProfiles.map((p) => p.id));
  const templatesReady = GAME_TEMPLATES.every((t) => profileIds.has(`${t.era}-${t.recommendedBackend}`));
  items.push(
    templatesReady
      ? { id: "profiles", label: "Era machine profiles", status: "ready", detail: "Win95/98/XP profiles exist for the LEGO shelf templates." }
      : {
          id: "profiles",
          label: "Era machine profiles",
          status: "missing",
          detail: "One click creates the recommended Win95/98/XP profiles (QEMU snapshots, honest save tiers) + a starter controller profile.",
          fix: { action: "seed-profiles", label: "Create era profiles" },
        }
  );

  items.push(
    facts.controllerProfiles > 0
      ? { id: "controller", label: "Controller profile", status: "ready", detail: `${facts.controllerProfiles} brand-neutral profile(s) saved.` }
      : { id: "controller", label: "Controller profile", status: "optional", detail: "Optional: a starter Generic Modern Controller mapping (D-pad → arrows, A → Enter).", fix: { action: "seed-controller", label: "Add starter mapping" } }
  );

  const qemuProfiles = facts.emulatorProfiles.filter((p) => p.backend === "qemu");
  const needsWindows = qemuProfiles.some((p) => !p.machinePath || !facts.vmImages.includes(p.machinePath.split("/").pop() ?? ""));
  items.push({
    id: "windows-media",
    label: "Windows 95/98/XP guest",
    status: qemuProfiles.length === 0 ? "info" : needsWindows ? "missing" : "ready",
    detail:
      qemuProfiles.length === 0
        ? "Becomes relevant once era profiles exist."
        : needsWindows
          ? "Only YOU can supply this: your own Windows install CD/ISO + license. Install it once into a .qcow2 disk (the profile notes show the exact qemu-img command) — every Windows-era game then shares it."
          : "A virtual disk is in place — Windows-era games can mount their ISOs against it.",
    guidance: needsWindows && qemuProfiles.length > 0 ? { label: "Your own install media only — never downloaded, never bundled" } : undefined,
  });

  const broken = facts.games.filter((game) => game.missing.length > 0);
  items.push(
    facts.games.length === 0
      ? { id: "media", label: "Game media", status: "info", detail: "No games on the shelf yet — adopt a LEGO template or Add Game with your own ISO/disc." }
      : broken.length > 0
        ? { id: "media", label: "Game media", status: "missing", detail: `${broken.length} game(s) point at moved files (a re-plugged flash drive does this): ${broken.map((b) => b.title).join(", ")}. Use Locate File Again on each shelf card.` }
        : { id: "media", label: "Game media", status: "ready", detail: `${facts.games.length} game(s) linked and verified.` }
  );

  items.push({
    id: "godot",
    label: "Godot Game Mode",
    status: facts.godotExportPresent ? "ready" : "optional",
    detail: facts.godotExportPresent
      ? "Exported and detected — the launcher's 🎮 toggle will offer it."
      : "Optional fun layer: open desktop/game-mode/godot-project in Godot 4.3+ once, Export → game-mode/godot-export/. Everything works without it.",
    guidance: facts.godotExportPresent ? undefined : { label: "Godot (free, MIT license)", url: "https://godotengine.org/download" },
  });

  if (facts.launcherExePresent !== null) {
    items.push({
      id: "launcher",
      label: "Launcher .exe",
      status: facts.launcherExePresent ? "ready" : "missing",
      detail: facts.launcherExePresent
        ? "Built and in place."
        : "Compiles once on a Windows machine: desktop/scripts/build-windows.ps1 walks every step.",
    });
  }

  return items;
}

/** The wizard's one-line verdict. */
export function healthSummary(items: HealthItem[]): { ready: number; missing: number; verdict: string } {
  const ready = items.filter((i) => i.status === "ready").length;
  const missing = items.filter((i) => i.status === "missing").length;
  const verdict =
    missing === 0
      ? "Everything's in place — enjoy the room! 🕹"
      : `${missing} item(s) need attention — each one has a Fix button or tells you exactly what to provide.`;
  return { ready, missing, verdict };
}

/** Relative-path advice: keep media inside portable/ so the drive can move. */
export function isPortablePathAdvice(path: string): string | null {
  if (/^[A-Za-z]:[\\/]/.test(path) || path.startsWith("/")) {
    return "This is an absolute path — it will break when the flash drive gets a different letter. Consider Import ISO to copy it under portable/retro/user-media/ instead.";
  }
  return null;
}
