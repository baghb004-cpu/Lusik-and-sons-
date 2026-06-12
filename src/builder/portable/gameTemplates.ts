// ============================================================
// Retro Game Room — backend catalog + game profile templates
// ============================================================
// The "least tinkering" layer (plan §23b). Three kinds of pure
// data the wizard/health screens are built from:
//
//   EMULATOR_CATALOG — the three open-source backends, each with
//     the HONEST licensing answer (all GPL-2.0: redistribution on
//     the thumb drive IS allowed, with obligations: ship the
//     license text and a source-availability note, change nothing
//     about the terms — scripts/fetch-emulators.mjs does exactly
//     that), official download sources, the binary names we
//     detect, and what the user must still provide.
//
//   ERA_CHECKLISTS — what a Windows 95/98/2000/XP setup needs
//     from the USER (their own install media/license, where the
//     virtual disk lives). QEMU ships open-source SeaBIOS, so it
//     needs NO BIOS files — that's why it's the recommended
//     default; 86Box is the accuracy option and its machine ROMs
//     come from ITS official project sources, never from us.
//
//   GAME_TEMPLATES — editable launch-profile templates for
//     Baghdo's own LEGO discs. Templates carry every setting
//     EXCEPT the media: adopting one asks for the ISO/disc and
//     only then becomes a real library entry. No game data, no
//     cover art, no downloads — settings only.
// ============================================================

import type { EmulatorProfile, GameEntry } from "./schemas.ts";

// ── backends ────────────────────────────────────────────────
export interface EmulatorInfo {
  backend: EmulatorProfile["backend"];
  label: string;
  license: "GPL-2.0";
  /** The honest bundling answer, spelled out. */
  bundling: string;
  officialUrl: string;
  /** Executable names detect() looks for in portable/retro/emulators/. */
  binaries: string[];
  /** What the user still has to supply, plainly. */
  userProvides: string[];
  bestFor: string;
}

export const EMULATOR_CATALOG: EmulatorInfo[] = [
  {
    backend: "dosbox-x",
    label: "DOSBox-X",
    license: "GPL-2.0",
    bundling:
      "Redistribution allowed (GPL-2.0): the fetch script may place the official binary on your drive as long as the license text rides along and the source stays available from the official project — both handled automatically.",
    officialUrl: "https://github.com/joncampbell123/dosbox-x/releases",
    binaries: ["dosbox-x.exe", "dosbox-x"],
    userProvides: ["Your game discs/ISOs", "Your own Windows 95/98 install media only if a game needs a real Windows guest"],
    bestFor: "DOS games and many early Windows titles; has real save-states; everything it needs is in the download.",
  },
  {
    backend: "qemu",
    label: "QEMU",
    license: "GPL-2.0",
    bundling:
      "Redistribution allowed (GPL-2.0) with the same obligations. QEMU includes the open-source SeaBIOS — NO BIOS or ROM files to hunt down, which makes it the lowest-friction Windows-era backend.",
    officialUrl: "https://qemu.weilnetz.de/w64/",
    binaries: ["qemu-system-i386.exe", "qemu-system-i386", "qemu-system-x86_64.exe", "qemu-system-x86_64"],
    userProvides: ["Your own Windows 95/98/2000/XP install CD + license", "A virtual disk (the wizard creates the folder; QEMU creates the file)"],
    bestFor: "Windows 95–XP era games. Recommended default: open-source BIOS included, qcow2 snapshots = real save points.",
  },
  {
    backend: "86box",
    label: "86Box",
    license: "GPL-2.0",
    bundling:
      "The 86Box program itself is GPL-2.0 and may be redistributed with the license text. Its machine ROMs are separate: get them from the official 86Box project sources yourself — this builder never fetches or bundles ROM files.",
    officialUrl: "https://github.com/86Box/86Box/releases",
    binaries: ["86Box.exe", "86box.exe", "86Box"],
    userProvides: ["The official 86Box ROM set (from the 86Box project)", "Your own Windows install media + license", "A machine you configure once in 86Box's own UI"],
    bestFor: "Maximum period accuracy for stubborn Windows 95/98 titles. The most setup of the three — use QEMU first.",
  },
];

// ── era checklists (the user-provides law, per era) ─────────
export interface ChecklistItem {
  id: string;
  label: string;
  /** Who supplies it. */
  who: "user" | "wizard" | "fetch-script";
}

export const ERA_CHECKLISTS: Record<string, ChecklistItem[]> = {
  dos: [
    { id: "backend", label: "DOSBox-X in portable/retro/emulators/", who: "fetch-script" },
    { id: "media", label: "Your game files or disc image", who: "user" },
  ],
  win9x: [
    { id: "backend", label: "QEMU (recommended) or 86Box in portable/retro/emulators/", who: "fetch-script" },
    { id: "windows", label: "Your own Windows 95/98 install CD/ISO + license — never bundled", who: "user" },
    { id: "disk", label: "A virtual hard disk in portable/retro/vm-images/ (folder ready; QEMU creates the .qcow2)", who: "wizard" },
    { id: "media", label: "The game's disc or your own ISO backup", who: "user" },
    { id: "saves", label: "Snapshot/save folder in portable/retro/save-data/", who: "wizard" },
  ],
  winxp: [
    { id: "backend", label: "QEMU in portable/retro/emulators/", who: "fetch-script" },
    { id: "windows", label: "Your own Windows 2000/XP install CD/ISO + license — never bundled", who: "user" },
    { id: "disk", label: "A virtual hard disk (.qcow2 — enables snapshots)", who: "wizard" },
    { id: "media", label: "The game's disc or your own ISO backup", who: "user" },
  ],
};

// ── the LEGO shelf: launch-profile templates (settings only) ─
export interface GameTemplate {
  id: string;
  title: string;
  year: number;
  category: GameEntry["category"];
  era: EmulatorProfile["era"];
  recommendedBackend: EmulatorProfile["backend"];
  /** What media the adopt step asks for. */
  expects: string;
  graphicsNotes: string;
  audioNotes: string;
  saveNotes: string;
  compatNotes: string;
  ramMB: number;
  screenshotNotes: string;
  backupNotes: string;
}

export const GAME_TEMPLATES: GameTemplate[] = [
  {
    id: "lego-island",
    title: "LEGO Island",
    year: 1997,
    category: "other-retro",
    era: "win95",
    recommendedBackend: "qemu",
    expects: "Your own LEGO Island CD or the ISO you made from it",
    graphicsNotes: "Software renderer is the reliable path in a VM; keep the in-game draw distance modest.",
    audioNotes: "Standard Sound Blaster emulation works; voices are CD audio — mount the full ISO, not a file copy.",
    saveNotes: "Saves live inside the VM's Windows — snapshot the VM (qcow2) for real save points.",
    compatNotes: "Wants real Windows 95/98 — a guest VM with your own install media. Runs nicely at period settings.",
    ramMB: 64,

    screenshotNotes: "Screenshots land in portable/retro/screenshots/ (DOSBox-X: Ctrl+F5; QEMU: the monitor's screendump command).",
    backupNotes: "Covered by the room's backup zip (library/profiles/saves metadata); the VM disk is big - copy portable/retro/vm-images/ by hand for a full image backup.",
  },
  {
    id: "lego-island-2",
    title: "LEGO Island 2: The Brickster's Revenge",
    year: 2001,
    category: "other-retro",
    era: "winxp",
    recommendedBackend: "qemu",
    expects: "Your own LEGO Island 2 CD or ISO",
    graphicsNotes: "Direct3D title — give the VM more video memory; lower in-game resolution beats stutter.",
    audioNotes: "DirectSound via the VM's driver; no special setup.",
    saveNotes: "In-game save slots inside the VM + qcow2 snapshots on top.",
    compatNotes: "Happier on a Windows 98SE or XP guest than 95.",
    ramMB: 256,

    screenshotNotes: "Screenshots land in portable/retro/screenshots/ (DOSBox-X: Ctrl+F5; QEMU: the monitor's screendump command).",
    backupNotes: "Covered by the room's backup zip (library/profiles/saves metadata); the VM disk is big - copy portable/retro/vm-images/ by hand for a full image backup.",
  },
  {
    id: "legoland",
    title: "LEGOLAND",
    year: 1999,
    category: "other-retro",
    era: "win98",
    recommendedBackend: "qemu",
    expects: "Your own LEGOLAND CD or ISO",
    graphicsNotes: "Gentle 2.5D park builder — default VM graphics are fine.",
    audioNotes: "Standard; music from disc, keep the ISO mounted.",
    saveNotes: "Park saves inside the VM; snapshot before big park changes.",
    compatNotes: "Low requirements; one of the easiest of the set.",
    ramMB: 128,

    screenshotNotes: "Screenshots land in portable/retro/screenshots/ (DOSBox-X: Ctrl+F5; QEMU: the monitor's screendump command).",
    backupNotes: "Covered by the room's backup zip (library/profiles/saves metadata); the VM disk is big - copy portable/retro/vm-images/ by hand for a full image backup.",
  },
  {
    id: "lego-racers",
    title: "LEGO Racers",
    year: 1999,
    category: "other-retro",
    era: "win98",
    recommendedBackend: "qemu",
    expects: "Your own LEGO Racers CD or ISO",
    graphicsNotes: "Use the software renderer in-game if 3D acceleration in the guest misbehaves.",
    audioNotes: "Standard Sound Blaster emulation.",
    saveNotes: "Profile + unlocks saved in-game inside the VM; snapshots recommended before circuit finals 🏁.",
    compatNotes: "A controller maps well: D-pad → arrows, A → accelerate key. Pair it with a controller profile.",
    ramMB: 128,

    screenshotNotes: "Screenshots land in portable/retro/screenshots/ (DOSBox-X: Ctrl+F5; QEMU: the monitor's screendump command).",
    backupNotes: "Covered by the room's backup zip (library/profiles/saves metadata); the VM disk is big - copy portable/retro/vm-images/ by hand for a full image backup.",
  },
  {
    id: "lego-racers-2",
    title: "LEGO Racers 2",
    year: 2001,
    category: "other-retro",
    era: "winxp",
    recommendedBackend: "qemu",
    expects: "Your own LEGO Racers 2 CD or ISO",
    graphicsNotes: "Direct3D — XP guest with healthy video memory; cap the in-game resolution first if it chugs.",
    audioNotes: "Standard.",
    saveNotes: "In-game saves + qcow2 snapshots.",
    compatNotes: "Wants the XP-era profile; analog stick maps to the driving keys nicely.",
    ramMB: 256,

    screenshotNotes: "Screenshots land in portable/retro/screenshots/ (DOSBox-X: Ctrl+F5; QEMU: the monitor's screendump command).",
    backupNotes: "Covered by the room's backup zip (library/profiles/saves metadata); the VM disk is big - copy portable/retro/vm-images/ by hand for a full image backup.",
  },
  {
    id: "lego-rock-raiders",
    title: "LEGO Rock Raiders",
    year: 1999,
    category: "other-retro",
    era: "win98",
    recommendedBackend: "qemu",
    expects: "Your own LEGO Rock Raiders CD or ISO",
    graphicsNotes: "Notoriously picky renderer — software mode in-game is the dependable choice in a VM.",
    audioNotes: "Music is CD audio — mount the complete ISO.",
    saveNotes: "Mission progress saves in-game; snapshot between missions.",
    compatNotes: "The fussiest of the set; if QEMU misbehaves, this is the one that justifies an 86Box machine.",
    ramMB: 128,

    screenshotNotes: "Screenshots land in portable/retro/screenshots/ (DOSBox-X: Ctrl+F5; QEMU: the monitor's screendump command).",
    backupNotes: "Covered by the room's backup zip (library/profiles/saves metadata); the VM disk is big - copy portable/retro/vm-images/ by hand for a full image backup.",
  },
];

/** The era profile a template needs, created by the wizard's Fix button. */
export function emulatorProfileForTemplate(t: GameTemplate): Omit<EmulatorProfile, "machinePath"> & { machinePath?: string } {
  return {
    id: `${t.era}-${t.recommendedBackend}`,
    label: `${t.era.toUpperCase()} machine (${t.recommendedBackend})`,
    backend: t.recommendedBackend,
    era: t.era,
    ramMB: t.ramMB,
    saveTier: t.recommendedBackend === "qemu" ? "snapshots" : t.recommendedBackend === "dosbox-x" ? "save-states" : "disk-state",
    extraArgs: [],
    notes:
      t.recommendedBackend === "qemu"
        ? "Create the disk once: qemu-img create -f qcow2 portable/retro/vm-images/" + t.era + ".qcow2 4G — then install YOUR Windows into it."
        : undefined,
  };
}
