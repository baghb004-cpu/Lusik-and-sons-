import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { zipFiles, unzipFiles } from "../server/zip.ts";
import { collectAllDocs, restoreDocs } from "../server/backup.ts";
import { createFsStorage } from "../storage/index.ts";
import { createGitCliRevisions, createGithubRevisions } from "../storage/revisions.ts";
import { makePage } from "./fixtures.ts";

const exec = promisify(execFile);

test("zip roundtrip preserves paths and content", async () => {
  const files = [
    { path: "builder/pages/a.json", content: '{"x":1}' },
    { path: "content/products/b.json", content: '{"y":"Ա"}' }, // unicode survives
  ];
  const buf = await zipFiles(files);
  assert.deepEqual(await unzipFiles(buf), files);
});

test("backup collects both document roots through the storage adapter", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "builder-bk-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const storage = createFsStorage(root);
  await storage.write("builder/pages/a.json", "{}", "m");
  await storage.write("content/products/b.json", "{}", "m");
  const docs = await collectAllDocs(storage);
  assert.deepEqual(docs.map((d) => d.path), ["builder/pages/a.json", "content/products/b.json"]);
});

test("restore is ALL-OR-NOTHING: one invalid document and nothing is written", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "builder-rs-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const storage = createFsStorage(root);

  const good = { path: "builder/pages/good.json", content: JSON.stringify(makePage({ slug: "good" })) };
  const evil = {
    path: "builder/pages/evil.json",
    content: JSON.stringify({
      ...makePage({ slug: "evil" }),
      sections: [{ id: "b_evil00000001", type: "button", props: { label: "x", href: "javascript:alert(1)" } }],
    }),
  };
  const escape = { path: "builder/../netlify/x.json", content: "{}" };

  const bad = await restoreDocs(storage, [good, evil]);
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.written, []);
  assert.equal(await storage.read("builder/pages/good.json"), null, "the valid file was NOT written");

  const traversal = await restoreDocs(storage, [good, escape]);
  assert.equal(traversal.ok, false);
  assert.ok(traversal.problems.some((p) => p.issues[0].code === "bad_path"));

  const ok = await restoreDocs(storage, [good, { path: "backup-manifest.json", content: "{}" }]);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.written, ["builder/pages/good.json"]);
  assert.ok(await storage.read("builder/pages/good.json"));
});

test("fs revisions: a real temp git repo lists history and reads old content", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "builder-git-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const git = (...args: string[]) => exec("git", ["-C", root, ...args]);
  await git("init", "-q");
  await git("config", "user.email", "t@t");
  await git("config", "user.name", "T");
  await git("config", "commit.gpgsign", "false"); // CI/sandbox global config may enforce signing
  await mkdir(join(root, "builder/pages"), { recursive: true });
  await writeFile(join(root, "builder/pages/a.json"), '{"v":1}');
  await git("add", "-A");
  await git("commit", "-qm", "first save");
  await writeFile(join(root, "builder/pages/a.json"), '{"v":2}');
  await git("add", "-A");
  await git("commit", "-qm", "second save");

  const source = createGitCliRevisions(root);
  const revisions = await source.list("builder/pages/a.json");
  assert.equal(revisions.length, 2);
  assert.equal(revisions[0].message, "second save");
  assert.equal(await source.read("builder/pages/a.json", revisions[1].sha), '{"v":1}');
  // bad sha shapes never reach git
  assert.equal(await source.read("builder/pages/a.json", "HEAD; rm -rf /"), null);
  // missing history is empty, not an error
  assert.deepEqual(await createGitCliRevisions(tmpdir()).list("builder/pages/a.json"), []);
});

test("github revisions: commits API + contents-at-ref via injected fetch", async () => {
  const calls: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("/commits?")) {
      return new Response(
        JSON.stringify([
          { sha: "a".repeat(40), commit: { author: { date: "2026-06-12T00:00:00Z", name: "Lusik" }, message: "newer\n\nbody" } },
          { sha: "b".repeat(40), commit: { author: { date: "2026-06-11T00:00:00Z", name: "Lusik" }, message: "older" } },
        ]),
        { status: 200 }
      );
    }
    if (url.includes(`ref=${"b".repeat(40)}`)) {
      return new Response(JSON.stringify({ content: Buffer.from('{"v":1}').toString("base64") }), { status: 200 });
    }
    return new Response("{}", { status: 404 });
  }) as typeof fetch;

  const source = createGithubRevisions({ repo: "o/r", token: "t" }, fetchImpl);
  const revisions = await source.list("builder/pages/a.json");
  assert.equal(revisions.length, 2);
  assert.equal(revisions[0].message, "newer"); // first line only
  assert.equal(await source.read("builder/pages/a.json", "b".repeat(40)), '{"v":1}');
  assert.ok(calls[0].includes("path=builder%2Fpages%2Fa.json"));
});
