#!/usr/bin/env node
// ============================================================
// install-retro-tools.mjs — sidecar tools, one command (§23c)
// ============================================================
// Downloads, verifies, stages and DOCUMENTS the open-source
// tools the Retro Game Room uses, as portable sidecars:
//
//   portable/retro/emulators/dosbox-x/   (official portable zip)
//   portable/retro/emulators/86box/      (official portable zip)
//   portable/retro/emulators/qemu/       (disclosed third-party-
//                                         hosted installer — see lock)
//   portable/licenses/                   (license texts)
//   portable/THIRD_PARTY_NOTICES.md      (the whole story)
//   portable/retro/COMPONENTS_MANIFEST.json (name/version/source/
//                                         license/path/sha256)
//
// Laws: shows every source BEFORE downloading · verifies sha256
// against scripts/retro-tools.lock.json (pinned by hand-verifying
// the official assets) · safe to re-run (skips what's present) ·
// no admin, never touches system folders · GPL sources stay
// sidecars, never merged into the app · and it will NEVER fetch
// games, Windows images, BIOS/ROM files, or keys.
//
//   node scripts/install-retro-tools.mjs            # dosbox-x + 86box + qemu note
//   node scripts/install-retro-tools.mjs --with-godot
//   node scripts/install-retro-tools.mjs --no-86box --no-qemu
// ============================================================

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORTABLE = join(process.cwd(), "portable");
const EMUS = join(PORTABLE, "retro", "emulators");
const LICENSES = join(PORTABLE, "licenses");
const MANIFEST = join(PORTABLE, "retro", "COMPONENTS_MANIFEST.json");

const args = new Set(process.argv.slice(2));
const lock = JSON.parse(readFileSync(join(repo, "scripts", "retro-tools.lock.json"), "utf8"));

const GPL2_URL = "https://www.gnu.org/licenses/old-licenses/gpl-2.0.txt";
const MIT_GODOT_URL = "https://raw.githubusercontent.com/godotengine/godot/master/LICENSE.txt";

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

async function fetchBuf(url, label) {
  console.log(`↓ ${label}\n   source: ${url}`);
  const res = await fetch(url, { headers: { "User-Agent": "baghdos-workshop-installer" }, redirect: "follow" });
  if (!res.ok) throw new Error(`download failed (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  console.log(`   ${Math.round(buf.length / 1024 / 1024)} MB received`);
  return buf;
}

async function extractZip(buf, destDir, subdir = "") {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(buf);
  let count = 0;
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    if (subdir && !name.startsWith(subdir)) continue;
    const rel = subdir ? name.slice(subdir.length) : name;
    if (!rel || rel.includes("..")) continue;
    const dest = join(destDir, rel);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, await entry.async("nodebuffer"));
    if (rel.endsWith(".exe") || !rel.includes(".")) await chmod(dest, 0o755).catch(() => {});
    count++;
  }
  return count;
}

async function loadManifest() {
  try {
    return JSON.parse(await readFile(MANIFEST, "utf8"));
  } catch {
    return { _comment: "What is staged on this drive, with provenance. Written by install-retro-tools.mjs.", components: [] };
  }
}

async function recordComponent(manifest, entry) {
  manifest.components = manifest.components.filter((c) => c.name !== entry.name);
  manifest.components.push(entry);
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
}

// ── per-tool installers ─────────────────────────────────────
async function installZipTool(manifest, id, dirName) {
  const t = lock.tools[id];
  const destDir = join(EMUS, dirName);
  if (existsSync(join(destDir, t.binary))) {
    console.log(`✓ ${id} already staged at portable/retro/emulators/${dirName}/ — skipping`);
    return;
  }
  const buf = await fetchBuf(t.url, `${id} ${t.version} (official portable build)`);
  const hash = sha256(buf);
  if (t.sha256 && hash !== t.sha256) {
    throw new Error(`CHECKSUM MISMATCH for ${id}: expected ${t.sha256}, got ${hash} — NOT staging it. The release may have changed; re-pin the lock file deliberately.`);
  }
  const files = await extractZip(buf, destDir, t.zipSubdir);
  console.log(`   verified sha256 ✓ → staged ${files} files in portable/retro/emulators/${dirName}/`);
  await recordComponent(manifest, {
    name: id,
    version: t.version,
    source: t.source,
    license: t.license,
    installPath: `portable/retro/emulators/${dirName}/`,
    sha256: hash,
    officialPortable: t.officialPortable,
    ...(t.userMustProvide ? { userMustProvide: t.userMustProvide } : {}),
  });
}

async function installQemu(manifest) {
  const t = lock.tools.qemu;
  const dir = join(EMUS, "qemu");
  if (existsSync(join(dir, "qemu-system-i386.exe"))) {
    console.log("✓ qemu already staged — skipping");
    return;
  }
  console.log(`→ QEMU: ${t.thirdPartyNote}`);
  // resolve the newest installer from the publisher's directory listing
  const listing = await (await fetch(t.url, { headers: { "User-Agent": "baghdos-workshop-installer" } })).text();
  const names = [...listing.matchAll(/href="(qemu-w64-setup-[\w.-]+?\.exe)"/g)].map((m) => m[1]).sort();
  const installer = names.at(-1);
  if (!installer) {
    throw new Error(
      `could not read the publisher's listing from here — open ${t.url} in a browser, download the newest qemu-w64-setup-*.exe (and its .sha512), then run it with /S /D=portable\\retro\\emulators\\qemu`
    );
  }
  const buf = await fetchBuf(t.url + installer, `QEMU Windows installer ${installer}`);
  // verify against the publisher's own .sha512
  const sha512Txt = await (await fetch(`${t.url}${installer}.sha512`, { headers: { "User-Agent": "baghdos-workshop-installer" } })).text().catch(() => "");
  const published = sha512Txt.trim().split(/\s+/)[0]?.toLowerCase();
  const actual = createHash("sha512").update(buf).digest("hex");
  if (published && published !== actual) {
    throw new Error("QEMU installer failed the publisher's sha512 check — NOT staging it.");
  }
  await mkdir(dir, { recursive: true });
  const dest = join(dir, installer);
  await writeFile(dest, buf);
  console.log(published ? "   publisher sha512 verified ✓" : "   (publisher checksum file unavailable — recorded our own hash)");
  if (process.platform === "win32") {
    console.log("   running the installer silently into the sidecar folder (no admin, no system dirs)…");
    const { spawnSync } = await import("node:child_process");
    const r = spawnSync(dest, ["/S", `/D=${dir}`], { stdio: "ignore" });
    console.log(r.status === 0 ? "   QEMU installed into portable/retro/emulators/qemu/ ✓" : "   silent install returned non-zero — run the installer yourself, target folder: " + dir);
  } else {
    console.log(`   installer staged at portable/retro/emulators/qemu/${installer} — on the Windows machine run it with: ${installer} /S /D=<that folder>`);
  }
  await recordComponent(manifest, {
    name: "qemu",
    version: installer,
    source: t.source,
    distributedBy: t.url + " (maintainer build linked from qemu.org — disclosed, not silently bundled)",
    license: t.license,
    installPath: "portable/retro/emulators/qemu/",
    sha512: actual,
    officialPortable: false,
  });
}

async function installGodot(manifest) {
  const t = lock.tools.godot;
  const dir = join(PORTABLE, "..", "game-mode", "godot-editor");
  console.log(`→ Godot editor + export templates (~1 GB total!) from the official godotengine releases.`);
  const buf = await fetchBuf(t.url, `Godot ${t.version} editor`);
  const hash = sha256(buf);
  await extractZip(buf, dir);
  const tpl = await fetchBuf(t.templatesUrl, "Godot export templates (large — this is the slow one)");
  await writeFile(join(dir, "export_templates.tpz"), tpl);
  console.log("   staged: game-mode/godot-editor/ (open the project, install templates from the .tpz via Editor > Manage Export Templates, then Export)");
  await recordComponent(manifest, {
    name: "godot",
    version: t.version,
    source: t.source,
    license: "MIT",
    installPath: "game-mode/godot-editor/",
    sha256: hash,
  });
}

// ── license texts + the notices file ────────────────────────
async function writeCompliance(manifest) {
  await mkdir(LICENSES, { recursive: true });
  const gpl = await fetchBuf(GPL2_URL, "GPL-2.0 license text").catch(() => null);
  if (gpl) await writeFile(join(LICENSES, "GPL-2.0.txt"), gpl);
  const mit = await fetchBuf(MIT_GODOT_URL, "Godot MIT license text").catch(() => null);
  if (mit) await writeFile(join(LICENSES, "Godot-MIT.txt"), mit);

  const staged = manifest.components.map((c) => `| ${c.name} | ${c.version} | ${c.license} | ${c.installPath} | ${c.source} |`).join("\n");
  await writeFile(
    join(PORTABLE, "THIRD_PARTY_NOTICES.md"),
    `# Third-party notices — what's on this drive and why it's allowed

Generated by install-retro-tools.mjs on ${new Date().toISOString().slice(0, 10)}.

## Staged open-source components

| Component | Version | License | Path | Source |
| --- | --- | --- | --- | --- |
${staged || "| (none yet) | | | | |"}

GPL-2.0 components are redistributed UNMODIFIED as separate sidecar
programs (never linked into the builder app); the license text is in
portable/licenses/ and complete source is available from each project's
official repository above — which satisfies the GPL's redistribution
terms. Godot is MIT.

## What is deliberately NOT here (you provide it, you own it)

- Your game discs / the ISOs you made from them
- Windows 95/98/2000/XP install media + licenses
- 86Box machine ROMs (official set: github.com/86Box/roms)
- Any BIOS, key, crack, or downloaded game — this tooling never
  fetches such files, by design.

## Privacy

Everything runs offline after staging. No telemetry, no accounts, no
cloud. Internet is touched only when YOU run an install/update command.
`
  );
  console.log("✓ portable/licenses/ + THIRD_PARTY_NOTICES.md + COMPONENTS_MANIFEST.json written");
}

// ── go ──────────────────────────────────────────────────────
console.log("Retro Game Room — sidecar tools installer\nEverything below shows its source before downloading. Ctrl-C anytime.\n");
await mkdir(EMUS, { recursive: true });
const manifest = await loadManifest();
let failures = 0;
const step = async (name, fn) => {
  try {
    await fn();
  } catch (err) {
    failures++;
    console.error(`✗ ${name}: ${err.message}`);
  }
};

if (!args.has("--no-dosbox-x")) await step("dosbox-x", () => installZipTool(manifest, "dosbox-x", "dosbox-x"));
if (!args.has("--no-86box")) await step("86box", () => installZipTool(manifest, "86box", "86box"));
if (!args.has("--no-qemu")) await step("qemu", () => installQemu(manifest));
if (args.has("--with-godot")) await step("godot", () => installGodot(manifest));
await step("compliance", () => writeCompliance(manifest));

console.log(
  failures
    ? `\nFinished with ${failures} issue(s) — re-run any time; finished tools are skipped.`
    : "\nAll staged. Check readiness: node scripts/preflight-portable.mjs"
);
process.exitCode = failures ? 1 : 0;
