// Setup wizard + templates (plan §23b): the health report's honesty,
// Fix-button coverage, backend detection, and that every LEGO template
// becomes a valid library entry the moment the user supplies media.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  GAME_TEMPLATES,
  EMULATOR_CATALOG,
  ERA_CHECKLISTS,
  emulatorProfileForTemplate,
  healthReport,
  healthSummary,
  detectedBackends,
  isPortablePathAdvice,
  emulatorProfileSchema,
  gameEntrySchema,
  type HealthFacts,
} from "../portable/index.ts";

const BASE_FACTS: HealthFacts = {
  emulatorFiles: [],
  games: [],
  emulatorProfiles: [],
  controllerProfiles: 0,
  gameRoomEnabled: false,
  dirsPresent: [],
  godotExportPresent: false,
  launcherExePresent: null,
  vmImages: [],
  noticesPresent: false,
  romsPresent86box: false,
};

test("six LEGO templates: era profiles validate; adoption with user media yields a valid entry", () => {
  assert.equal(GAME_TEMPLATES.length, 6);
  for (const t of GAME_TEMPLATES) {
    const profile = emulatorProfileForTemplate(t);
    assert.equal(emulatorProfileSchema.safeParse(profile).success, true, t.id);
    const adopted = gameEntrySchema.safeParse({
      id: t.id,
      title: t.title,
      category: t.category,
      year: t.year,
      emulatorProfileId: profile.id,
      isoPath: `retro/user-media/isos/${t.id}.iso`, // the user's own backup
      notes: t.compatNotes,
      addedAt: 1,
    });
    assert.equal(adopted.success, true, t.id);
    // templates carry settings only — never media paths or download hints
    const text = JSON.stringify(t).toLowerCase();
    assert.ok(!/download|torrent|abandonware|crack|keygen/.test(text), `${t.id} must not hint at obtaining media`);
  }
  // QEMU is the recommended default for the Windows-era titles (SeaBIOS = no BIOS hunt)
  assert.ok(GAME_TEMPLATES.every((t) => t.recommendedBackend === "qemu"));
});

test("catalog: all three backends GPL-2.0 with the bundling answer spelled out; checklists mark user-vs-script", () => {
  assert.equal(EMULATOR_CATALOG.length, 3);
  for (const e of EMULATOR_CATALOG) {
    assert.equal(e.license, "GPL-2.0");
    assert.match(e.bundling, /Redistribution allowed|redistributed/i);
    assert.ok(e.officialUrl.startsWith("https://"));
  }
  // Windows media is ALWAYS the user's to provide — never a script's
  for (const era of Object.values(ERA_CHECKLISTS)) {
    for (const item of era) {
      if (/windows/i.test(item.label)) assert.equal(item.who, "user", item.label);
    }
  }
});

test("detection: binary names map to backends, case-insensitive", () => {
  assert.deepEqual(detectedBackends(["dosbox-x.exe", "readme.txt"]), ["dosbox-x"]);
  assert.deepEqual(detectedBackends(["QEMU-SYSTEM-I386.EXE"]), ["qemu"]);
  assert.deepEqual(detectedBackends([]), []);
});

test("health report: fresh install → fixable items have Fix buttons; user media never does", () => {
  const items = healthReport(BASE_FACTS);
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  assert.equal(byId.privacy.status, "ready"); // offline by construction, stated
  assert.equal(byId.room.status, "missing");
  assert.equal(byId.room.fix?.action, "enable-room");
  assert.equal(byId.dirs.fix?.action, "create-dirs");
  assert.equal(byId.profiles.fix?.action, "seed-profiles");
  // backends get GUIDANCE (official downloads), not a fake fix button
  assert.ok(byId["backend-qemu"].guidance?.url?.includes("qemu"));
  assert.equal(byId["backend-qemu"].fix, undefined);
  const summary = healthSummary(items);
  assert.ok(summary.missing > 0);
  assert.match(summary.verdict, /Fix button|provide/);
});

test("health report: configured environment reads ready; moved media calls out Locate-Again", () => {
  const facts: HealthFacts = {
    ...BASE_FACTS,
    gameRoomEnabled: true,
    dirsPresent: ["retro"],
    emulatorFiles: ["qemu-system-i386.exe", "dosbox-x.exe", "86Box.exe"],
    emulatorProfiles: GAME_TEMPLATES.map((t) => {
      const p = emulatorProfileForTemplate(t);
      return { id: p.id, backend: p.backend, machinePath: "retro/vm-images/win98.qcow2" };
    }),
    controllerProfiles: 1,
    vmImages: ["win98.qcow2"],
    games: [{ id: "lego-racers", title: "LEGO Racers", missing: [{ field: "isoPath", path: "E:/old/racers.iso" }] }],
    godotExportPresent: true,
    launcherExePresent: true,
    noticesPresent: true,
    romsPresent86box: false,
  };
  const items = healthReport(facts);
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  assert.equal(byId.room.status, "ready");
  assert.equal(byId["backend-qemu"].status, "ready");
  assert.equal(byId["windows-media"].status, "ready");
  assert.equal(byId.media.status, "missing");
  assert.match(byId.media.detail, /Locate File Again/);
  assert.equal(byId.godot.status, "ready");
  assert.equal(byId.launcher.status, "ready");
  assert.equal(byId.licenses.status, "ready");
  // 86Box present without its ROM set = installed but not configured
  assert.equal(byId["86box-roms"].status, "missing");
  assert.match(byId["86box-roms"].detail, /installed but not configured/);
  assert.ok(byId["86box-roms"].guidance?.url?.includes("86Box/roms"));
});

test("portable-path advice flags drive letters and absolute paths", () => {
  assert.ok(isPortablePathAdvice("E:\\\\isos\\\\game.iso"));
  assert.ok(isPortablePathAdvice("/mnt/usb/game.iso"));
  assert.equal(isPortablePathAdvice("retro/user-media/isos/game.iso"), null);
});
