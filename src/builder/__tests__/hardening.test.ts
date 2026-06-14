import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { validateDocument } from "../server/validateDoc.ts";
import { requireBuilderAdmin } from "../server/auth.ts";
import { isLoopbackUrl, aiSettingsSchema } from "../ai/models.ts";
import { resolveBlocks } from "../engine/index.ts";
import { createFsStorage } from "../storage/index.ts";
import { createGitCliRevisions } from "../storage/revisions.ts";
import { makePage, makeMobileLayer } from "./fixtures.ts";

const exec = promisify(execFile);

// ── Review BLOCKER: the builder/ catch-all must FAIL CLOSED ──
test("unknown builder/ paths are rejected, not written unvalidated", async () => {
  for (const path of [
    "builder/x.json",
    "builder/data/datasetsX.json", // near-miss: no trailing slash
    "builder/data/ai-x.json",
    "builder/sneaky/thing.json",
  ]) {
    const issues = await validateDocument(path, { anything: true });
    assert.ok(issues.length > 0, `${path} must be refused`);
    assert.equal(issues[0].code, "unknown_family", path);
  }
  // every LEGITIMATE family still validates (not over-rejected)
  const theme = JSON.parse(await readFile(join(process.cwd(), "builder/theme.json"), "utf8"));
  assert.deepEqual(await validateDocument("builder/theme.json", theme), []);
});

// ── Review NICE: hosted backend must not honor a local token ─
test("a local token is refused when a GitHub backend is configured", async () => {
  const tok = "x".repeat(32);
  const req = () => new Request("http://localhost/api/builder/docs", { headers: { Authorization: `Bearer ${tok}` } });
  const gotrueDown = (async () => new Response("{}", { status: 401 })) as typeof fetch;

  // local mode: the token works
  const local = await requireBuilderAdmin(req(), { BUILDER_LOCAL_TOKEN: tok } as unknown as NodeJS.ProcessEnv, gotrueDown);
  assert.equal(local.ok, true);

  // hosted mode (github backend set): same token is refused — falls through
  // to Identity, which rejects it
  const hosted = await requireBuilderAdmin(
    req(),
    { BUILDER_LOCAL_TOKEN: tok, BUILDER_GITHUB_REPO: "o/r", BUILDER_GITHUB_TOKEN: "ght", URL: "https://x.com" } as unknown as NodeJS.ProcessEnv,
    gotrueDown
  );
  assert.equal(hosted.ok, false);
});

// ── Review SHOULD-FIX: AI baseUrl SSRF guard ────────────────
test("AI runner URL is constrained to loopback", () => {
  assert.equal(isLoopbackUrl("http://127.0.0.1:11434"), true);
  assert.equal(isLoopbackUrl("http://localhost:8080"), true);
  assert.equal(isLoopbackUrl("http://[::1]:8080"), true);
  assert.equal(isLoopbackUrl("http://169.254.169.254/latest/meta-data"), false);
  assert.equal(isLoopbackUrl("http://evil.example.com"), false);

  assert.equal(aiSettingsSchema.safeParse({ baseUrl: "http://127.0.0.1:11434" }).success, true);
  assert.equal(aiSettingsSchema.safeParse({ baseUrl: "http://169.254.169.254" }).success, false);
  assert.equal(aiSettingsSchema.safeParse({}).success, true); // optional
});

// ── Review SHOULD-FIX: override patch must not alias the base ─
test("a resolved mobile block shares no nested reference with the base", () => {
  const page = makePage();
  // give the hero a nested prop object the patch DOESN'T mention
  const hero = page.sections[0].children![0];
  (hero.props as Record<string, unknown>).meta = { tag: "keep" };
  const layer = makeMobileLayer({ patches: { b_hero00000001: { style: { textAlign: "center" } } } });

  const resolved = resolveBlocks(page.sections, [layer], "mobile").blocks;
  const find = (bs: typeof resolved): Record<string, unknown> | null => {
    for (const b of bs) {
      if (b.id === "b_hero00000001") return b.props as Record<string, unknown>;
      if (b.children) { const hit = find(b.children); if (hit) return hit; }
    }
    return null;
  };
  const resolvedProps = find(resolved)!;
  // mutating the resolved block's nested object must NOT touch the base
  (resolvedProps.meta as { tag: string }).tag = "MUTATED";
  assert.equal((hero.props as { meta: { tag: string } }).meta.tag, "keep");
});

// ── My finding: fs-mode auto-commit makes History real ──────
test("fs storage auto-commits, so revisions exist on the thumb drive", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "fs-commit-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await exec("git", ["-C", root, "init", "-q"]);
  await exec("git", ["-C", root, "config", "user.email", "t@t"]);
  await exec("git", ["-C", root, "config", "user.name", "T"]);
  await exec("git", ["-C", root, "config", "commit.gpgsign", "false"]);

  const storage = createFsStorage(root);
  await storage.write("builder/pages/a.json", '{"v":1}\n', "builder: save a");
  await storage.write("builder/pages/a.json", '{"v":2}\n', "builder: update a");

  const revisions = await createGitCliRevisions(root).list("builder/pages/a.json");
  assert.equal(revisions.length, 2, "two saves → two revisions");
  assert.equal(revisions[0].message, "builder: update a");
});

// ── My finding: atomic write leaves no .tmp turds behind ────
test("fs write is atomic (no leftover temp files)", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "fs-atomic-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const storage = createFsStorage(root); // not a git repo → commit no-ops, write still works
  await storage.write("builder/pages/a.json", "{}\n", "m");
  assert.equal(await storage.read("builder/pages/a.json"), "{}\n");
  const entries = await readdir(join(root, "builder/pages"));
  assert.deepEqual(entries, ["a.json"], "no .tmp files left behind");
});
