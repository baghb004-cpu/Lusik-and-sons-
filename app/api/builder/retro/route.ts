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

import { join, isAbsolute } from "node:path";
import { existsSync } from "node:fs";
import { copyFile, stat } from "node:fs/promises";

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
  type GameEntry,
  type EmulatorProfile,
  type ControllerProfile,
} from "../../../../src/builder/portable/index.ts";

export const dynamic = "force-dynamic";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" },
  });
}

async function guard(req: Request) {
  const auth = await requireBuilderAdmin(req);
  if (!auth.ok) return { denied: auth.response! };
  if (getBuilderStorage().backend !== "fs") {
    return { denied: json(501, { error: "The Retro Game Room is local-only — it is never served from a hosted site" }) };
  }
  const store = createPortableStore();
  await store.init();
  const settingsRaw = await store.read("settings.json");
  const settings = portableSettingsSchema.parse(settingsRaw ? JSON.parse(settingsRaw) : {});
  if (!settings.gameRoom.enabled) {
    return {
      denied: json(403, {
        error: "The Retro Game Room is switched off. The owner can enable it locally: portable/settings.json → gameRoom.enabled = true.",
      }),
    };
  }
  return { store };
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

export async function GET(req: Request): Promise<Response> {
  const g = await guard(req);
  if (g.denied) return g.denied;
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
  const g = await guard(req);
  if (g.denied) return g.denied;
  const store = g.store;
  let body: {
    action?: string;
    game?: unknown;
    emulator?: unknown;
    controller?: unknown;
    id?: string;
    newPath?: string;
    field?: string;
    confirm?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Body must be JSON" });
  }

  try {
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
      await copyFile(src, join(store.root, destRel));
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
      const binAbs = isAbsolute(plan.bin)
        ? plan.bin
        : join(store.root, "retro", "emulators", process.platform === "win32" ? `${plan.bin}.exe` : plan.bin);
      if (!existsSync(binAbs)) {
        return json(409, {
          error: `The ${emu.backend} backend isn't installed`,
          hint: `Download the open-source ${emu.backend} yourself and place it at portable/retro/emulators/`,
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
