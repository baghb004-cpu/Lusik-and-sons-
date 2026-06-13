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
function sha512(buf) {
  return createHash("sha512").update(buf).digest("hex");
}

// FAIL-CLOSED verification: refuse to use any download that isn't pinned, or
// whose bytes don't match the pin. `algo` is "sha256" | "sha512".
function verifyOrThrow(buf, algo, expected, label) {
  const actual = algo === "sha512" ? sha512(buf) : sha256(buf);
  if (!expected) {
    throw new Error(
      `${label} has no pinned ${algo} in retro-tools.lock.json — refusing to stage an unverified binary. ` +
        `Pin a hand-verified hash first (node scripts/install-retro-tools.mjs --pin <tool>), then re-run.`
    );
  }
  if (actual.toLowerCase() !== String(expected).toLowerCase()) {
    throw new Error(`CHECKSUM MISMATCH for ${label}: expected ${expected}, got ${actual} — NOT staging it. The release changed; re-pin the lock deliberately.`);
  }
  return actual;
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
  const { resolve, sep } = await import("node:path");
  const zip = await JSZip.loadAsync(buf);
  const root = resolve(destDir);
  let count = 0;
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    if (subdir && !name.startsWith(subdir)) continue;
    const rel = (subdir ? name.slice(subdir.length) : name).replace(/\\/g, "/");
    if (!rel) continue;
    // Zip-slip guard: the resolved path must stay inside destDir (handles
    // "..", absolute names, and backslash separators — not just a substring test).
    const dest = resolve(root, rel);
    if (dest !== root && !dest.startsWith(root + sep)) {
      console.warn(`   ! skipped a zip entry that escapes the target: ${name}`);
      continue;
    }
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, await entry.async("nodebuffer"));
    if (rel.endsWith(".exe")) await chmod(dest, 0o755).catch(() => {}); // only mark known executables
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
  const hash = verifyOrThrow(buf, "sha256", t.sha256, id); // fail-closed: no pin / mismatch ⇒ throw
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
  // No directory scrape, no same-origin checksum: QEMU is staged ONLY from a
  // hand-pinned installer + hash in the lock. Missing either ⇒ refuse.
  if (!t.installer || !t.sha512) {
    throw new Error(
      "QEMU isn't pinned. Download a specific qemu-w64-setup-<ver>.exe from " +
        `${t.url}, verify it against Stefan Weil's published checksum, then set both \`installer\` and \`sha512\` ` +
        "for qemu in scripts/retro-tools.lock.json. (Or run with --no-qemu.)"
    );
  }
  const installer = t.installer;
  const buf = await fetchBuf(t.url + installer, `QEMU Windows installer ${installer}`);
  const actual = verifyOrThrow(buf, "sha512", t.sha512, "qemu"); // fail-closed against the PINNED hash
  await mkdir(dir, { recursive: true });
  const dest = join(dir, installer);
  await writeFile(dest, buf);
  console.log("   pinned sha512 verified ✓");
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
  const editorHash = verifyOrThrow(buf, "sha512", t.sha512, "godot editor"); // fail-closed
  const tpl = await fetchBuf(t.templatesUrl, "Godot export templates (large — this is the slow one)");
  verifyOrThrow(tpl, "sha512", t.templatesSha512, "godot export templates"); // fail-closed before staging
  await extractZip(buf, dir);
  await writeFile(join(dir, "export_templates.tpz"), tpl);
  console.log("   pinned sha512 verified ✓ → staged game-mode/godot-editor/ (install templates from the .tpz via Editor > Manage Export Templates, then Export)");
  await recordComponent(manifest, {
    name: "godot",
    version: t.version,
    source: t.source,
    license: "MIT",
    installPath: "game-mode/godot-editor/",
    sha512: editorHash,
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

// ── --pin <tool>: download an asset and print its hash so you can
//    cross-check it against the project's OWN published checksum and paste
//    it into the lock. This is the ONLY supported way to (re-)pin. ─────────
const pinIdx = process.argv.indexOf("--pin");
if (pinIdx !== -1) {
  const tool = process.argv[pinIdx + 1];
  const t = lock.tools[tool];
  if (!t) {
    console.error(`--pin needs a tool name: ${Object.keys(lock.tools).join(", ")}`);
    process.exit(1);
  }
  const url = tool === "qemu" ? (t.installer ? t.url + t.installer : t.url) : t.url;
  console.log(`Pinning ${tool} from:\n  ${url}\n`);
  const buf = await fetchBuf(url, `${tool} (for pinning)`);
  console.log(`\n  sha256: ${sha256(buf)}`);
  console.log(`  sha512: ${sha512(buf)}`);
  if (t.templatesUrl) {
    const tpl = await fetchBuf(t.templatesUrl, `${tool} templates (for pinning)`);
    console.log(`\n  templates sha256: ${sha256(tpl)}`);
    console.log(`  templates sha512: ${sha512(tpl)}`);
  }
  console.log(
    `\nCross-check these against ${t.source}'s OWN published checksums (do NOT trust this number on its own),\n` +
      `then paste the verified hash into scripts/retro-tools.lock.json in a deliberate commit.`
  );
  process.exit(0);
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
