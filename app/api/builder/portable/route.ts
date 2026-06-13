// ============================================================
// /api/builder/portable — profiles, quick saves, backup/restore
// ============================================================
// The private environment's data API (plan §23). Admin-gated,
// fs-mode only, everything zod-gated before it touches disk.
// Auto-save is just "the UI calls this often" — writes are atomic
// and cheap. Backups are plain zip archives in portable/backups
// (big media — ISOs, VM images — is excluded by design and the
// response says so; those copy by hand, they're the user's media).
// ============================================================

import { join } from "node:path";
import { readFile } from "node:fs/promises";

import { requireBuilderAdmin } from "../../../../src/builder/server/auth.ts";
import { getBuilderStorage } from "../../../../src/builder/storage/index.ts";
import {
  createPortableStore,
  portableSettingsSchema,
  profileSchema,
  quickSaveSchema,
  PortablePathError,
} from "../../../../src/builder/portable/index.ts";

export const dynamic = "force-dynamic";

const MAX_QUICKSAVE_BYTES = 256 * 1024;

// The only paths a restore may write — exactly what `backup` writes. Anything
// else in the zip (a crafted entry, a traversal attempt) is rejected in the
// validate phase, before a single file is written, keeping restore all-or-nothing.
const RESTORABLE_PATH =
  /^(settings\.json|profiles\/[\w-]+\.json|quicksaves\/[\w-]+\.json|retro\/(library|emulator-profiles|controller-profiles)\/[\w-]+\.json)$/;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" },
  });
}

async function guard(req: Request): Promise<Response | null> {
  const auth = await requireBuilderAdmin(req);
  if (!auth.ok) return auth.response!;
  if (getBuilderStorage().backend !== "fs") {
    return json(501, { error: "The portable environment lives where the files live — local (fs) mode only" });
  }
  return null;
}

export async function GET(req: Request): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  const store = createPortableStore();
  await store.init();
  try {
    const settingsRaw = await store.read("settings.json");
    const settings = portableSettingsSchema.parse(settingsRaw ? JSON.parse(settingsRaw) : {});
    const profiles = [];
    for (const f of await store.list("profiles")) {
      const raw = await store.read(`profiles/${f}`);
      if (raw) {
        const p = profileSchema.safeParse(JSON.parse(raw));
        if (p.success) profiles.push(p.data);
      }
    }
    const quicksaves = await store.list("quicksaves");
    const backups = await store.list("backups");
    return json(200, { ok: true, settings, profiles, quicksaves, backups });
  } catch (err) {
    return json(500, { error: err instanceof Error ? err.message : String(err) });
  }
}

export async function POST(req: Request): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  let body: { kind?: string; profile?: unknown; settings?: unknown; quicksave?: unknown; id?: string; file?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Body must be JSON" });
  }
  const store = createPortableStore();
  await store.init();

  try {
    if (body.kind === "settings") {
      const parsed = portableSettingsSchema.safeParse(body.settings);
      if (!parsed.success) return json(422, { error: parsed.error.issues[0]?.message });
      await store.write("settings.json", JSON.stringify(parsed.data, null, 2) + "\n");
      return json(200, { ok: true });
    }

    if (body.kind === "profile") {
      const parsed = profileSchema.safeParse(body.profile);
      if (!parsed.success) return json(422, { error: parsed.error.issues[0]?.message });
      await store.write(`profiles/${parsed.data.id}.json`, JSON.stringify(parsed.data, null, 2) + "\n");
      return json(200, { ok: true, id: parsed.data.id });
    }

    if (body.kind === "quicksave") {
      const parsed = quickSaveSchema.safeParse(body.quicksave);
      if (!parsed.success) return json(422, { error: parsed.error.issues[0]?.message });
      const text = JSON.stringify(parsed.data, null, 2) + "\n";
      if (text.length > MAX_QUICKSAVE_BYTES) return json(413, { error: "Quick save too large — it stores positions, not media" });
      await store.write(`quicksaves/${parsed.data.id}.json`, text);
      return json(200, { ok: true, id: parsed.data.id });
    }

    if (body.kind === "remove-profile" || body.kind === "remove-quicksave") {
      if (!body.id) return json(400, { error: "Expected { id }" });
      const dir = body.kind === "remove-profile" ? "profiles" : "quicksaves";
      await store.remove(`${dir}/${body.id}.json`);
      return json(200, { ok: true });
    }

    if (body.kind === "backup") {
      // metadata + profiles + saves + library — NOT isos/vm-images (the
      // response explains; those are big user media, copied by hand).
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const dirs = ["profiles", "quicksaves", "retro/library", "retro/emulator-profiles", "retro/controller-profiles"];
      let count = 0;
      const settingsRaw = await store.read("settings.json");
      if (settingsRaw) {
        zip.file("settings.json", settingsRaw);
        count++;
      }
      for (const dir of dirs) {
        for (const f of await store.list(dir)) {
          const raw = await store.read(`${dir}/${f}`);
          if (raw) {
            zip.file(`${dir}/${f}`, raw);
            count++;
          }
        }
      }
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const name = `backup-${stamp}.zip`;
      const buf = await zip.generateAsync({ type: "nodebuffer" });
      const { writeFile, mkdir } = await import("node:fs/promises");
      await mkdir(join(store.root, "backups"), { recursive: true });
      await writeFile(join(store.root, "backups", name), buf);
      return json(200, {
        ok: true,
        file: `backups/${name}`,
        entries: count,
        note: "ISO files and VM images are NOT in this zip (they can be many GB) — copy retro/user-media and retro/vm-images by hand if you want them backed up too.",
      });
    }

    if (body.kind === "restore") {
      if (!body.file || !/^backups\/backup-[\w-]+\.zip$/.test(body.file)) {
        return json(400, { error: "Expected { file: \"backups/backup-….zip\" }" });
      }
      const { default: JSZip } = await import("jszip");
      const zip = await JSZip.loadAsync(await readFile(join(store.root, body.file)));
      // ALL-OR-NOTHING: validate every entry's PATH and SCHEMA before writing
      // anything. A crafted backup can neither escape portable/ nor write a
      // path outside the known backup families — one bad entry, nothing restored.
      const writes: Array<{ rel: string; content: string }> = [];
      for (const [rel, entry] of Object.entries(zip.files)) {
        if (entry.dir) continue;
        if (!RESTORABLE_PATH.test(rel)) {
          return json(422, { error: `Backup entry isn't a restorable file: ${rel} — nothing was restored` });
        }
        const content = await entry.async("string");
        let data: unknown;
        try {
          data = JSON.parse(content);
        } catch {
          return json(422, { error: `Backup entry isn't valid JSON: ${rel} — nothing was restored` });
        }
        const okay =
          rel === "settings.json"
            ? portableSettingsSchema.safeParse(data).success
            : rel.startsWith("profiles/")
              ? profileSchema.safeParse(data).success
              : rel.startsWith("quicksaves/")
                ? quickSaveSchema.safeParse(data).success
                : true; // retro families re-validate on read in /retro
        if (!okay) return json(422, { error: `Backup entry fails validation: ${rel} — nothing was restored` });
        writes.push({ rel, content });
      }
      for (const w of writes) await store.write(w.rel, w.content);
      return json(200, { ok: true, restored: writes.length });
    }

    return json(400, { error: "Unknown kind" });
  } catch (err) {
    if (err instanceof PortablePathError) return json(400, { error: err.message });
    return json(500, { error: err instanceof Error ? err.message : String(err) });
  }
}
