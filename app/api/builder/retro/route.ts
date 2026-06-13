// ============================================================
// /api/builder/retro — the Retro Game Room (plan §23)
// ============================================================
// Infrastructure for USER-SUPPLIED, LEGALLY OWNED media only:
// nothing is bundled, downloaded, or scraped — this API organizes
// paths the owner points it at and launches user-installed
// open-source backends. DISABLED BY DEFAULT: portable/settings.json
// gameRoom.enabled must be flipped locally first.
//
// Launch is two-step by spec: confirm:false returns the resolved
// command for the "you're about to run this" warning; confirm:true
// spawns it — always spawn(bin,args,{shell:false}), never a shell
// string. Missing files come back as a per-field list so the UI
// can show "Locate File Again".
// ============================================================

import { join, isAbsolute, dirname } from "node:path";
import { existsSync, readdirSync } from "node:fs";
import { copyFile, stat, mkdir } from "node:fs/promises";

import { requireBuilderAdmin } from "../../../../src/builder/server/auth.ts";
import { getBuilderStorage } from "../../../../src/builder/storage/index.ts";
import {
  createPortableStore,
  portableSettingsSchema,
  gameEntrySchema,
  emulatorProfileSchema,
  controllerProfileSchema,
  composeLaunch,
  pathsToVerify,
  PortablePathError,
  GAME_TEMPLATES,
  ERA_CHECKLISTS,
  EMULATOR_CATALOG,
  emulatorProfileForTemplate,
  healthReport,
  healthSummary,
  isPortablePathAdvice,
  type GameEntry,
  type EmulatorProfile,
  type ControllerProfile,
  type HealthFacts,
} from "../../../../src/builder/portable/index.ts";

export const dynamic = "force-dynamic";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" },
  });
}

async function guard(req: Request, allowDisabled = false) {
  const auth = await requireBuilderAdmin(req);
  if (!auth.ok) return { denied: auth.response! };
  if (getBuilderStorage().backend !== "fs") {
    return { denied: json(501, { error: "The Retro Game Room is local-only — it is never served from a hosted site" }) };
  }
  const store = createPortableStore();
  await store.init();
  const settingsRaw = await store.read("settings.json");
  const settings = portableSettingsSchema.parse(settingsRaw ? JSON.parse(settingsRaw) : {});
  if (!settings.gameRoom.enabled && !allowDisabled) {
    return {
      denied: json(403, {
        error: "The Retro Game Room is switched off. The owner can enable it locally: portable/settings.json → gameRoom.enabled = true — or open the Setup wizard, which has the button.",
      }),
    };
  }
  return { store, settings };
}

type Families = { games: GameEntry[]; emulators: EmulatorProfile[]; controllers: ControllerProfile[] };

async function loadAll(store: NonNullable<Awaited<ReturnType<typeof guard>>["store"]>): Promise<Families> {
  const load = async <T>(dir: string, schema: { safeParse: (v: unknown) => { success: boolean; data?: T } }): Promise<T[]> => {
    const out: T[] = [];
    for (const f of await store.list(dir)) {
      const raw = await store.read(`${dir}/${f}`);
      if (!raw) continue;
      const parsed = schema.safeParse(JSON.parse(raw));
      if (parsed.success && parsed.data) out.push(parsed.data);
    }
    return out;
  };
  return {
    games: await load("retro/library", gameEntrySchema),
    emulators: await load("retro/emulator-profiles", emulatorProfileSchema),
    controllers: await load("retro/controller-profiles", controllerProfileSchema),
  };
}

const resolveUserPath = (root: string, p: string) => (isAbsolute(p) ? p : join(root, p));

/** Resolve a bare command name against PATH (system-installed emulator on
 *  Linux/Pi). Returns the absolute path or null. Never used on Windows. */
function resolveOnPath(bin: string): string | null {
  if (isAbsolute(bin)) return existsSync(bin) ? bin : null;
  for (const dir of (process.env.PATH ?? "").split(":")) {
    if (!dir) continue;
    const p = join(dir, bin);
    if (existsSync(p)) return p;
  }
  return null;
}

async function gatherFacts(store: NonNullable<Awaited<ReturnType<typeof guard>>["store"]>, enabled: boolean): Promise<HealthFacts> {
  const all = await loadAll(store);
  const safeList = (dir: string): string[] => {
    try {
      return readdirSync(join(store.root, dir));
    } catch {
      return [];
    }
  };
  const games = all.games.map((game) => {
    const emu = all.emulators.find((e) => e.id === game.emulatorProfileId);
    const missing = emu ? pathsToVerify(game, emu).filter((p) => !existsSync(resolveUserPath(store.root, p.path))) : [];
    return { id: game.id, title: game.title, missing };
  });
  // launcher/godot detection: portable layout puts them beside the app dir
  const portableRoot = join(store.root, "..");
  const godotDir = join(portableRoot, "game-mode", "godot-export");
  const godotExportPresent = safelyHasExecutable(godotDir);
  // The launcher is baghdos-workshop.exe on Windows, start.sh on the Pi/Linux
  // drive — accept either. null = no portable node/ dir at all (dev mode).
  const launcherExePresent =
    existsSync(join(portableRoot, "node"))
      ? existsSync(join(portableRoot, "baghdos-workshop.exe")) || existsSync(join(portableRoot, "start.sh"))
      : null;
  // emulator binaries may sit flat or in per-tool sidecar folders
  const emulatorFiles = safeList("retro/emulators").flatMap((entry) => {
    const sub = safeList(`retro/emulators/${entry}`);
    return sub.length > 0 ? sub : [entry];
  });
  return {
    emulatorFiles,
    games,
    emulatorProfiles: all.emulators.map((e) => ({ id: e.id, backend: e.backend, machinePath: e.machinePath })),
    controllerProfiles: all.controllers.length,
    gameRoomEnabled: enabled,
    dirsPresent: safeList("retro").length > 0 ? ["retro"] : [],
    godotExportPresent,
    launcherExePresent,
    vmImages: safeList("retro/vm-images"),
    noticesPresent: existsSync(join(store.root, "THIRD_PARTY_NOTICES.md")),
    romsPresent86box: safeList("retro/emulators/86box/roms").length > 0,
  };
}

function safelyHasExecutable(dir: string): boolean {
  try {
    return readdirSync(dir).some((f) => f.endsWith(".exe") || f.endsWith(".x86_64"));
  } catch {
    return false;
  }
}

export async function GET(req: Request): Promise<Response> {
  const wantsWizard = new URL(req.url).searchParams.get("wizard") === "1";
  const g = await guard(req, wantsWizard); // the wizard works while the room is off
  if (g.denied) return g.denied;
  if (wantsWizard) {
    const facts = await gatherFacts(g.store, g.settings!.gameRoom.enabled);
    const items = healthReport(facts);
    return json(200, {
      ok: true,
      health: items,
      summary: healthSummary(items),
      templates: GAME_TEMPLATES,
      checklists: ERA_CHECKLISTS,
      catalog: EMULATOR_CATALOG.map(({ binaries: _b, ...rest }) => rest),
    });
  }
  const all = await loadAll(g.store);
  // verification status rides along so shelves can show "Locate File Again"
  const verified = all.games.map((game) => {
    const emu = all.emulators.find((e) => e.id === game.emulatorProfileId);
    const missing = emu
      ? pathsToVerify(game, emu).filter((p) => !existsSync(resolveUserPath(g.store.root, p.path)))
      : [];
    return { ...game, missing, saveTier: emu?.saveTier ?? null };
  });
  return json(200, { ok: true, games: verified, emulators: all.emulators, controllers: all.controllers });
}

export async function POST(req: Request): Promise<Response> {
  let peek: { action?: string } = {};
  let rawBody = "";
  try {
    rawBody = await req.text();
    peek = JSON.parse(rawBody);
  } catch {
    return json(400, { error: "Body must be JSON" });
  }
  const g = await guard(req, peek.action === "fix"); // Fix buttons work while the room is off
  if (g.denied) return g.denied;
  const store = g.store;
  const body: {
    action?: string;
    game?: unknown;
    emulator?: unknown;
    controller?: unknown;
    id?: string;
    newPath?: string;
    field?: string;
    confirm?: boolean;
    fix?: string;
    templateId?: string;
    isoPath?: string;
    useDiscDrive?: string;
  } = peek;

  try {
    // ── the wizard's Fix-This buttons (plan §23b) ───────────
    if (body.action === "fix") {
      if (body.fix === "enable-room") {
        const next = { ...g.settings!, gameRoom: { enabled: true } };
        await store.write("settings.json", JSON.stringify(next, null, 2) + "\n");
        return json(200, { ok: true, fixed: "enable-room" });
      }
      if (body.fix === "create-dirs") {
        await store.init(); // idempotent skeleton
        return json(200, { ok: true, fixed: "create-dirs" });
      }
      if (body.fix === "seed-profiles") {
        let created = 0;
        for (const t of GAME_TEMPLATES) {
          const profile = emulatorProfileForTemplate(t);
          const rel = `retro/emulator-profiles/${profile.id}.json`;
          if (!(await store.read(rel))) {
            const parsed = emulatorProfileSchema.parse(profile);
            await store.write(rel, JSON.stringify(parsed, null, 2) + "\n");
            created++;
          }
        }
        return json(200, { ok: true, fixed: "seed-profiles", created });
      }
      if (body.fix === "seed-controller") {
        const starter = controllerProfileSchema.parse({
          id: "starter-pad",
          label: "Generic Modern Controller",
          preset: "Generic Modern Controller",
          bindings: [
            { input: "dpad-up", target: { kind: "key", value: "up" } },
            { input: "dpad-down", target: { kind: "key", value: "down" } },
            { input: "dpad-left", target: { kind: "key", value: "left" } },
            { input: "dpad-right", target: { kind: "key", value: "right" } },
            { input: "a-button", target: { kind: "key", value: "enter" } },
            { input: "b-button", target: { kind: "key", value: "escape" } },
            { input: "x-button", target: { kind: "mouse-button", value: "left" } },
            { input: "right-stick", target: { kind: "mouse-move", value: "xy" } },
          ],
        });
        await store.write(`retro/controller-profiles/${starter.id}.json`, JSON.stringify(starter, null, 2) + "\n");
        return json(200, { ok: true, fixed: "seed-controller" });
      }
      return json(400, { error: "Unknown fix" });
    }

    // ── adopt a LEGO template: settings + YOUR media = a shelf entry ─
    if (body.action === "adopt-template") {
      const t = GAME_TEMPLATES.find((x) => x.id === body.templateId);
      if (!t) return json(404, { error: "Template not found" });
      if (!body.isoPath && !body.useDiscDrive) {
        return json(400, { error: `Bring your own media: pass { isoPath } (your ISO of "${t.title}") or { useDiscDrive: "D:" }` });
      }
      const profile = emulatorProfileForTemplate(t);
      const profileRel = `retro/emulator-profiles/${profile.id}.json`;
      if (!(await store.read(profileRel))) {
        await store.write(profileRel, JSON.stringify(emulatorProfileSchema.parse(profile), null, 2) + "\n");
      }
      const entry = gameEntrySchema.safeParse({
        id: t.id,
        title: t.title,
        category: t.category,
        year: t.year,
        emulatorProfileId: profile.id,
        isoPath: body.isoPath,
        useDiscDrive: body.useDiscDrive,
        notes: `${t.compatNotes} Graphics: ${t.graphicsNotes} Audio: ${t.audioNotes} Saves: ${t.saveNotes}`,
        addedAt: Date.now(),
      });
      if (!entry.success) return json(422, { error: entry.error.issues[0]?.message });
      await store.write(`retro/library/${t.id}.json`, JSON.stringify(entry.data, null, 2) + "\n");
      const advice = body.isoPath ? isPortablePathAdvice(body.isoPath) : null;
      return json(200, { ok: true, id: t.id, ...(advice ? { advice } : {}) });
    }

    if (body.action === "upsert-game" || body.action === "upsert-emulator" || body.action === "upsert-controller") {
      const [schema, dir, value] =
        body.action === "upsert-game"
          ? ([gameEntrySchema, "retro/library", body.game] as const)
          : body.action === "upsert-emulator"
            ? ([emulatorProfileSchema, "retro/emulator-profiles", body.emulator] as const)
            : ([controllerProfileSchema, "retro/controller-profiles", body.controller] as const);
      const parsed = schema.safeParse(value);
      if (!parsed.success) return json(422, { error: parsed.error.issues[0]?.message, path: parsed.error.issues[0]?.path.join(".") });
      await store.write(`${dir}/${(parsed.data as { id: string }).id}.json`, JSON.stringify(parsed.data, null, 2) + "\n");
      return json(200, { ok: true, id: (parsed.data as { id: string }).id });
    }

    if (body.action === "remove-game") {
      if (!body.id) return json(400, { error: "Expected { id }" });
      await store.remove(`retro/library/${body.id}.json`);
      return json(200, { ok: true });
    }

    if (body.action === "locate") {
      // "Locate File Again": point a missing field at the file's new home.
      if (!body.id || !body.newPath || !body.field || !["isoPath", "exePath", "installPath", "coverPath"].includes(body.field)) {
        return json(400, { error: "Expected { id, field: isoPath|exePath|installPath|coverPath, newPath }" });
      }
      const raw = await store.read(`retro/library/${body.id}.json`);
      if (!raw) return json(404, { error: "Game not found" });
      const updated = gameEntrySchema.safeParse({ ...JSON.parse(raw), [body.field]: body.newPath });
      if (!updated.success) return json(422, { error: updated.error.issues[0]?.message });
      if (!existsSync(resolveUserPath(store.root, body.newPath))) {
        return json(404, { error: `Nothing exists at ${body.newPath}` });
      }
      await store.write(`retro/library/${body.id}.json`, JSON.stringify(updated.data, null, 2) + "\n");
      return json(200, { ok: true });
    }

    if (body.action === "import-iso") {
      // Optional copy of the user's own ISO into the environment's media
      // folder — explicit confirm, size shown first, file copied verbatim.
      if (!body.id) return json(400, { error: "Expected { id, confirm? }" });
      const raw = await store.read(`retro/library/${body.id}.json`);
      if (!raw) return json(404, { error: "Game not found" });
      const game = gameEntrySchema.parse(JSON.parse(raw));
      if (!game.isoPath) return json(400, { error: "This entry has no ISO path" });
      const src = resolveUserPath(store.root, game.isoPath);
      if (!existsSync(src)) return json(404, { error: "ISO not found — use Locate File Again first" });
      const size = (await stat(src)).size;
      const destRel = `retro/user-media/isos/${body.id}.iso`;
      if (!body.confirm) {
        return json(200, { ok: true, needsConfirm: true, sizeMB: Math.round(size / 1024 / 1024), dest: destRel });
      }
      const dest = join(store.root, destRel);
      await mkdir(dirname(dest), { recursive: true }); // the isos/ dir may not exist yet
      await copyFile(src, dest);
      const updated = { ...game, isoPath: destRel };
      await store.write(`retro/library/${body.id}.json`, JSON.stringify(updated, null, 2) + "\n");
      return json(200, { ok: true, imported: destRel });
    }

    if (body.action === "launch") {
      if (!body.id) return json(400, { error: "Expected { id, confirm? }" });
      const all = await loadAll(store);
      const game = all.games.find((x) => x.id === body.id);
      if (!game) return json(404, { error: "Game not found" });
      const emu = all.emulators.find((e) => e.id === game.emulatorProfileId);
      if (!emu) return json(422, { error: "This game's emulator profile is missing — open Configure" });
      const controller = all.controllers.find((c) => c.id === game.controllerProfileId);

      const missing = pathsToVerify(game, emu).filter((p) => !existsSync(resolveUserPath(store.root, p.path)));
      if (missing.length > 0) {
        return json(409, { error: "Files moved or missing", missing, hint: "Use Locate File Again" });
      }

      const plan = composeLaunch(game, emu, controller);
      // sidecar layout first (emulators/<tool>/<bin>), then legacy flat
      const binName = process.platform === "win32" ? `${plan.bin}.exe` : plan.bin;
      const toolDir = { "dosbox-x": "dosbox-x", "86box": "86box", qemu: "qemu" }[emu.backend];
      const candidates = isAbsolute(plan.bin)
        ? [plan.bin]
        : [
            join(store.root, "retro", "emulators", toolDir, binName),
            join(store.root, "retro", "emulators", toolDir, plan.bin === "86Box" ? "86Box.exe" : binName),
            join(store.root, "retro", "emulators", binName),
          ];
      // Prefer a staged sidecar; on Linux/Pi fall back to a system-installed
      // emulator on PATH (the natural model there — `apt install dosbox-x …`).
      let binAbs = candidates.find((c) => existsSync(c)) ?? null;
      if (!binAbs && process.platform !== "win32") binAbs = resolveOnPath(plan.bin);
      if (!binAbs) {
        return json(409, {
          error: `The ${emu.backend} backend isn't installed`,
          hint:
            process.platform === "win32"
              ? `One command stages it (verified): node scripts/install-retro-tools.mjs — or place it at portable/retro/emulators/${toolDir}/`
              : `Install it from your package manager (Raspberry Pi: sudo apt install dosbox-x qemu-system-x86), or place it at portable/retro/emulators/${toolDir}/`,
        });
      }

      // Spec: warn before running. confirm:false = show exactly what runs.
      if (!body.confirm) {
        return json(200, { ok: true, needsConfirm: true, command: { bin: binAbs, args: plan.args }, saveTier: plan.saveTier, warnings: plan.warnings });
      }
      // generated paths come from composeLaunch (built from the gated game
      // id), never from the request body — safe to write directly.
      const { writeFile } = await import("node:fs/promises");
      for (const gen of plan.generated) {
        await writeFile(join(store.root, gen.path), gen.content, "utf8");
      }
      const { spawn } = await import("node:child_process");
      const child = spawn(binAbs, plan.args, { cwd: store.root, detached: true, stdio: "ignore", shell: false });
      child.unref();
      return json(200, { ok: true, launched: true, pid: child.pid ?? null, saveTier: plan.saveTier, warnings: plan.warnings });
    }

    return json(400, { error: "Unknown action" });
  } catch (err) {
    if (err instanceof PortablePathError) return json(400, { error: err.message });
    return json(500, { error: err instanceof Error ? err.message : String(err) });
  }
}
