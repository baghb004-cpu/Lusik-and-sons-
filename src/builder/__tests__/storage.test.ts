import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createFsStorage, createGithubStorage, assertDocPath, DocPathError } from "../storage/index.ts";

// ── path safety (the wall) ──────────────────────────────────
test("doc paths: traversal, absolute, non-json and out-of-root are rejected", () => {
  for (const bad of [
    "../secrets.json",
    "builder/../netlify/schema.sql",
    "/etc/passwd",
    "builder/pages/x.js",
    "builder/pages/.hidden.json",
    "netlify/functions/_lib/trusted-products.mjs",
    "builder//pages/x.json",
    "builder\\pages\\x.json",
    "builder/pages/UPPER.json",
  ]) {
    assert.throws(() => assertDocPath(bad), DocPathError, bad);
  }
  assert.equal(assertDocPath("builder/pages/welcome.json"), "builder/pages/welcome.json");
  assert.equal(assertDocPath("builder/theme.json"), "builder/theme.json");
});

// ── fs adapter ──────────────────────────────────────────────
test("fs adapter: write → list → read → remove roundtrip in a temp root", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "builder-fs-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const storage = createFsStorage(root);

  assert.equal(await storage.read("builder/pages/a.json"), null);
  await storage.write("builder/pages/a.json", '{"x":1}\n', "msg");
  await storage.write("builder/templates/nav/main.json", '{"y":2}\n', "msg");

  assert.deepEqual(await storage.list("builder"), [
    "builder/pages/a.json",
    "builder/templates/nav/main.json",
  ]);
  assert.deepEqual(await storage.list("builder/pages"), ["builder/pages/a.json"]);
  assert.equal(await storage.read("builder/pages/a.json"), '{"x":1}\n');

  await storage.remove("builder/pages/a.json", "msg");
  assert.equal(await storage.read("builder/pages/a.json"), null);
  await storage.remove("builder/pages/a.json", "msg"); // no-op, no throw
});

test("fs adapter: listing a missing directory is empty, not an error", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "builder-fs-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  assert.deepEqual(await createFsStorage(root).list("builder/pages"), []);
});

// ── github adapter (fetch injected — no network) ────────────
function fakeGithub() {
  const store = new Map<string, string>(); // path → content
  const calls: Array<{ method: string; url: string; body?: Record<string, unknown> }> = [];

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, url, body });
    const path = url.replace(/^.*\/contents\//, "").replace(/\?.*$/, "");

    if (method === "GET") {
      if (store.has(path)) {
        return new Response(
          JSON.stringify({ sha: `sha-${path}`, content: Buffer.from(store.get(path)!).toString("base64") }),
          { status: 200 }
        );
      }
      // directory listing: entries directly under `path`
      const entries = [...store.keys()]
        .filter((k) => k.startsWith(path + "/"))
        .map((k) => {
          const rest = k.slice(path.length + 1);
          const top = rest.split("/")[0];
          const isFile = !rest.includes("/");
          return { type: isFile ? "file" : "dir", name: top, path: isFile ? k : `${path}/${top}` };
        });
      const unique = [...new Map(entries.map((e) => [e.path, e])).values()];
      if (unique.length === 0) return new Response("{}", { status: 404 });
      return new Response(JSON.stringify(unique), { status: 200 });
    }
    if (method === "PUT") {
      store.set(path, Buffer.from(body.content, "base64").toString("utf8"));
      return new Response("{}", { status: 200 });
    }
    if (method === "DELETE") {
      store.delete(path);
      return new Response("{}", { status: 200 });
    }
    return new Response("{}", { status: 500 });
  }) as typeof fetch;

  return { store, calls, fetchImpl };
}

test("github adapter: write sends base64 + branch; update includes the existing sha", async () => {
  const gh = fakeGithub();
  const storage = createGithubStorage({ repo: "owner/repo", token: "t", branch: "main" }, gh.fetchImpl);

  await storage.write("builder/pages/a.json", '{"x":1}', "builder: save a");
  const firstPut = gh.calls.find((c) => c.method === "PUT")!;
  assert.equal(firstPut.body!.branch, "main");
  assert.equal(firstPut.body!.message, "builder: save a");
  assert.equal(Buffer.from(String(firstPut.body!.content), "base64").toString("utf8"), '{"x":1}');
  assert.equal(firstPut.body!.sha, undefined); // create → no sha

  await storage.write("builder/pages/a.json", '{"x":2}', "builder: update a");
  const secondPut = gh.calls.filter((c) => c.method === "PUT")[1];
  assert.equal(secondPut.body!.sha, "sha-builder/pages/a.json"); // update → sha required

  assert.equal(await storage.read("builder/pages/a.json"), '{"x":2}');
});

test("github adapter: list recurses directories; remove of a missing file is a no-op", async () => {
  const gh = fakeGithub();
  const storage = createGithubStorage({ repo: "owner/repo", token: "t" }, gh.fetchImpl);
  await storage.write("builder/pages/a.json", "{}", "m");
  await storage.write("builder/templates/nav/x.json", "{}", "m");

  assert.deepEqual(await storage.list("builder"), [
    "builder/pages/a.json",
    "builder/templates/nav/x.json",
  ]);

  await storage.remove("builder/pages/missing.json", "m");
  assert.equal(gh.calls.filter((c) => c.method === "DELETE").length, 0); // 404 → never a DELETE call
});

test("github adapter: nonsense repo strings are rejected at construction", () => {
  assert.throws(() => createGithubStorage({ repo: "not-a-repo", token: "t" }));
});
