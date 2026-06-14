// ============================================================
// /api/builder/game — the Game Mode bridge (plan §23)
// ============================================================
// The ONLY door Godot needs. Same auth wall as everything else
// (requireBuilderAdmin: the launcher hands Godot the session
// token), loopback HTTP, fs-mode only (Game Mode is a desktop
// companion, not a hosted feature).
//
//   GET                 → hub status: stations, quests, profiles
//   POST {action:"mock", station}            → echo (step-8 testing)
//   POST {action:"quest", profileId, questId}→ award XP (idempotent)
//   POST {action:"list-projects"}            → real builder pages
//
// Real exports/edits go straight to the EXISTING endpoints
// (/api/builder/export, /api/builder/docs) — Game Mode never gets
// private shortcuts; the engine stays the source of truth.
// ============================================================

import { requireBuilderAdmin } from "../../../../src/builder/server/auth.ts";
import { getBuilderStorage } from "../../../../src/builder/storage/index.ts";
import {
  createPortableStore,
  profileSchema,
  QUESTS,
  awardQuest,
  levelFor,
} from "../../../../src/builder/portable/index.ts";

export const dynamic = "force-dynamic";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" },
  });
}

const STATIONS = [
  { id: "website", label: "Website Workshop" },
  { id: "mobile", label: "Mobile App Workshop" },
  { id: "export", label: "Export Portal" },
  { id: "room", label: "Retro Game Room" },
];

async function loadProfiles(store: ReturnType<typeof createPortableStore>) {
  const out = [];
  for (const f of await store.list("profiles")) {
    const raw = await store.read(`profiles/${f}`);
    if (!raw) continue;
    const parsed = profileSchema.safeParse(JSON.parse(raw));
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

export async function GET(req: Request): Promise<Response> {
  const auth = await requireBuilderAdmin(req);
  if (!auth.ok) return auth.response!;
  if (getBuilderStorage().backend !== "fs") {
    return json(501, { error: "Game Mode is a local (fs-mode) companion — it isn't served from the hosted site" });
  }
  const store = createPortableStore();
  await store.init();
  const profiles = await loadProfiles(store);
  return json(200, {
    ok: true,
    stations: STATIONS,
    quests: QUESTS,
    profiles: profiles.map((p) => ({ id: p.id, displayName: p.displayName, kind: p.kind, xp: p.xp, level: levelFor(p.xp), quests: p.quests })),
  });
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireBuilderAdmin(req);
  if (!auth.ok) return auth.response!;
  if (getBuilderStorage().backend !== "fs") {
    return json(501, { error: "Game Mode is a local (fs-mode) companion" });
  }
  let body: { action?: string; station?: string; profileId?: string; questId?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Body must be JSON" });
  }

  // Step 8 of the prototype plan: a safe mock every station calls first.
  if (body.action === "mock") {
    return json(200, { ok: true, mock: true, station: body.station ?? "unknown", at: Date.now() });
  }

  if (body.action === "list-projects") {
    const files = await getBuilderStorage().list("builder/pages");
    return json(200, { ok: true, projects: files.map((f) => f.replace("builder/pages/", "").replace(/\.json$/, "")) });
  }

  if (body.action === "quest") {
    if (!body.profileId || !body.questId) return json(400, { error: "Expected { profileId, questId }" });
    const store = createPortableStore();
    await store.init();
    const raw = await store.read(`profiles/${body.profileId}.json`);
    if (!raw) return json(404, { error: "Profile not found" });
    const parsed = profileSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return json(422, { error: "Profile file is damaged — restore from a backup" });
    const next = awardQuest(parsed.data, body.questId);
    if (next !== parsed.data) {
      await store.write(`profiles/${body.profileId}.json`, JSON.stringify(next, null, 2) + "\n");
    }
    return json(200, { ok: true, xp: next.xp, level: levelFor(next.xp), awarded: next !== parsed.data });
  }

  return json(400, { error: 'Expected action "mock" | "list-projects" | "quest"' });
}
