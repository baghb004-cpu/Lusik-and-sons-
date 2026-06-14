// ============================================================
// /api/builder/gamelab — save a generated game to the drive
// ============================================================
// Admin-gated, fs-mode. Generates the Godot project server-side from the
// posted GameProject (so the browser can't smuggle arbitrary files) and
// writes it, plus any imported image assets, under portable/games/<name>/.
// Path-contained; asset filenames are strictly validated.
// ============================================================

import { join, dirname, resolve, sep } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

import { requireBuilderAdmin } from "../../../../src/builder/server/auth.ts";
import { getBuilderStorage } from "../../../../src/builder/storage/index.ts";
import { generateProject, gameProjectSchema } from "../../../../src/builder/gamelab/index.ts";

export const dynamic = "force-dynamic";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" } });
}

const slug = (s: string) => (s.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "game").slice(0, 60);
const ASSET_NAME = /^[a-z0-9][a-z0-9._-]{0,60}\.(png|jpg|jpeg|webp|gif)$/i;
const MAX_ASSET_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request): Promise<Response> {
  const auth = await requireBuilderAdmin(req);
  if (!auth.ok) return auth.response!;
  if (getBuilderStorage().backend !== "fs") return json(501, { error: "Saving games to the drive runs in local (fs) mode." });

  let body: { project?: unknown; assets?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Body must be JSON" });
  }
  const parsed = gameProjectSchema.safeParse(body.project);
  if (!parsed.success) return json(422, { error: "Invalid game project", detail: parsed.error.issues[0]?.message });

  const project = parsed.data;
  const base = join(process.cwd(), "portable", "games", slug(project.name));
  const contain = (abs: string) => abs === base || abs.startsWith(base + sep);

  try {
    const { files } = generateProject(project);
    for (const [rel, content] of Object.entries(files)) {
      // codegen paths are fixed ("game-project/…"); write them under base.
      const abs = resolve(base, rel);
      if (!contain(abs)) continue;
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, content, "utf8");
    }
    // Imported images → game-project/assets/<name> (strict filename + size).
    let assetCount = 0;
    for (const [name, b64] of Object.entries(body.assets ?? {})) {
      if (!ASSET_NAME.test(name)) continue;
      const bytes = Buffer.from(b64, "base64");
      if (bytes.byteLength === 0 || bytes.byteLength > MAX_ASSET_BYTES) continue;
      const abs = resolve(base, "game-project", "assets", name);
      if (!contain(abs)) continue;
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, bytes);
      assetCount++;
    }
    return json(200, { ok: true, path: `portable/games/${slug(project.name)}/game-project`, assets: assetCount });
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
}
