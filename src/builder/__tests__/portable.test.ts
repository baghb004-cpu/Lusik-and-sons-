// Portable environment + Game Mode + Retro Game Room (plan §23):
// schemas, the brand-neutral law, store walls, launch composition
// safety, quests/XP.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  portableSettingsSchema,
  profileSchema,
  quickSaveSchema,
  controllerProfileSchema,
  emulatorProfileSchema,
  gameEntrySchema,
  createPortableStore,
  PortablePathError,
  composeLaunch,
  pathsToVerify,
  dosboxMapperLines,
  QUESTS,
  awardQuest,
  levelFor,
} from "../portable/index.ts";

// ── settings & defaults ─────────────────────────────────────
test("settings: Retro Game Room is OFF by default; Game Mode optional", () => {
  const s = portableSettingsSchema.parse({});
  assert.equal(s.gameRoom.enabled, false);
  assert.equal(s.gameModeDefault, false);
});

// ── profiles + quests ───────────────────────────────────────
test("profiles validate; quests award once and never twice", () => {
  const p = profileSchema.parse({ id: "baghdo", kind: "owner", displayName: "Baghdo", createdAt: Date.now() });
  assert.equal(p.xp, 0);
  const after = awardQuest(p, "export-static", 123);
  assert.equal(after.xp, QUESTS.find((q) => q.id === "export-static")!.xp);
  assert.equal(after.quests["export-static"], 123);
  assert.equal(awardQuest(after, "export-static"), after, "second award is a no-op");
  assert.equal(awardQuest(p, "not-a-quest"), p);
  assert.equal(levelFor(0), 1);
  assert.ok(levelFor(600) > levelFor(0));
});

test("quick saves are profile-scoped state blobs", () => {
  assert.equal(quickSaveSchema.safeParse({ id: "qs-1", profileId: "baghdo", takenAt: 1, state: { openProject: "builder/pages/welcome.json" } }).success, true);
  assert.equal(quickSaveSchema.safeParse({ id: "qs 1", profileId: "baghdo", takenAt: 1 }).success, false); // bad id
});

// ── THE BRAND-NEUTRAL LAW ───────────────────────────────────
test("controller profiles refuse console brand names in UI labels", () => {
  const ok = controllerProfileSchema.safeParse({ id: "main-pad", label: "Generic Pro Controller", preset: "Generic Pro Controller" });
  assert.equal(ok.success, true);
  for (const label of ["Xbox Elite", "PlayStation 5 pad", "Nintendo Switch Pro", "DualSense Edge", "joy-con grip"]) {
    const r = controllerProfileSchema.safeParse({ id: "x", label, preset: "Generic Modern Controller" });
    assert.equal(r.success, false, label);
  }
  // bindings map to keyboard/mouse with plain names
  const mapped = controllerProfileSchema.safeParse({
    id: "kid-pad",
    label: "Generic Dual-Stick Controller",
    preset: "Generic Dual-Stick Controller",
    bindings: [
      { input: "dpad-up", target: { kind: "key", value: "up" } },
      { input: "a-button", target: { kind: "key", value: "enter" } },
      { input: "x-button", target: { kind: "mouse-button", value: "left" } },
      { input: "right-stick", target: { kind: "mouse-move", value: "xy" } },
    ],
  });
  assert.equal(mapped.success, true);
});

// ── library + emulator profiles ─────────────────────────────
const EMU = {
  id: "win98-machine",
  label: "Windows 98 era",
  backend: "dosbox-x" as const,
  era: "win98" as const,
  ramMB: 64,
  saveTier: "save-states" as const,
  extraArgs: [],
};
const GAME = {
  id: "spongebob-employee",
  title: "SpongeBob (my own disc backup)",
  category: "spongebob-era" as const,
  emulatorProfileId: "win98-machine",
  isoPath: "retro/user-media/isos/spongebob.iso",
  addedAt: 1,
};

test("game entries need a media source; categories are the spec's five", () => {
  assert.equal(gameEntrySchema.safeParse(GAME).success, true);
  assert.equal(gameEntrySchema.safeParse({ ...GAME, isoPath: undefined }).success, false); // no source at all
  assert.equal(gameEntrySchema.safeParse({ ...GAME, isoPath: undefined, useDiscDrive: "D:" }).success, true);
  assert.equal(gameEntrySchema.safeParse({ ...GAME, category: "modern" }).success, false);
  assert.equal(emulatorProfileSchema.safeParse(EMU).success, true);
});

// ── launch composition: spawn-array safety ──────────────────
test("composeLaunch returns argv arrays (no shell strings); hostile paths stay inert", () => {
  const evil = { ...GAME, isoPath: 'retro/isos/x"; rm -rf ~; ".iso' };
  const plan = composeLaunch(gameEntrySchema.parse(evil), emulatorProfileSchema.parse(EMU));
  assert.ok(Array.isArray(plan.args));
  // the hostile path never appears in args as a shell fragment — dosbox
  // gets a generated conf file; the path lives INSIDE that file as data
  assert.deepEqual(plan.args.slice(0, 2), ["-conf", `retro/save-data/${GAME.id}.dosbox-x.conf`]);
  assert.equal(plan.saveTier, "save-states");

  const qemu = emulatorProfileSchema.parse({ ...EMU, id: "xp-vm", backend: "qemu", era: "winxp", ramMB: 512, saveTier: "snapshots", machinePath: "retro/vm-images/xp.qcow2" });
  const qplan = composeLaunch(gameEntrySchema.parse(GAME), qemu);
  assert.deepEqual(qplan.args.slice(0, 2), ["-m", "512"]);
  assert.ok(qplan.args.includes("-cdrom"));
  // a non-qcow2 disk honestly downgrades the snapshot promise
  const raw = emulatorProfileSchema.parse({ ...qemu, machinePath: "retro/vm-images/xp.img" });
  assert.ok(composeLaunch(gameEntrySchema.parse(GAME), raw).warnings.some((w) => w.includes("qcow2")));
});

test("pathsToVerify lists every configured file for the Locate-Again flow", () => {
  const emu = emulatorProfileSchema.parse({ ...EMU, machinePath: "retro/vm-images/win98" });
  const fields = pathsToVerify(gameEntrySchema.parse({ ...GAME, installPath: "retro/installed/sb" }), emu).map((p) => p.field).sort();
  assert.deepEqual(fields, ["installPath", "isoPath", "machinePath"]);
});

test("dosbox mapper lines come from bindings, nothing else", () => {
  const c = controllerProfileSchema.parse({
    id: "pad",
    label: "Generic USB Controller",
    preset: "Generic USB Controller",
    bindings: [{ input: "a-button", target: { kind: "key", value: "enter" } }],
  });
  const mapper = dosboxMapperLines(c);
  assert.match(mapper, /key_enter "jbutton 0 0"/);
});

// ── the store's walls ───────────────────────────────────────
test("portable store: init skeleton, atomic roundtrip, traversal refused", async () => {
  const root = await mkdtemp(join(tmpdir(), "portable-"));
  const store = createPortableStore(root);
  await store.init();
  assert.deepEqual(await store.list("profiles"), []);

  await store.write("profiles/baghdo.json", JSON.stringify({ hello: 1 }));
  assert.deepEqual(await store.list("profiles"), ["baghdo.json"]);
  assert.equal(JSON.parse((await store.read("profiles/baghdo.json"))!).hello, 1);
  await store.remove("profiles/baghdo.json");
  assert.equal(await store.read("profiles/baghdo.json"), null);

  await assert.rejects(store.write("../outside.json", "{}"), PortablePathError);
  await assert.rejects(store.write("profiles/../../etc/passwd.json", "{}"), PortablePathError);
  await assert.rejects(store.write("profiles/notes.txt", "{}"), PortablePathError);
  await assert.rejects(store.read("/absolute.json"), PortablePathError);
});
