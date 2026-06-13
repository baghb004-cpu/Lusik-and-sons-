// ============================================================
// make-portable.mjs — assemble the thumb-drive folder (plan §16)
// ============================================================
// Run ON WINDOWS after `npm run tauri:build`:
//
//   node desktop/scripts/make-portable.mjs E:\LusikBuilder
//
// Produces:
//   <target>/
//   ├── builder.exe        the Tauri shell (splash + windows)
//   ├── node/node.exe      portable Node runtime (downloaded once)
//   ├── app/               the builder project, production-built
//   │   ├── .next/  node_modules/  builder/  content/  public/ …
//   └── README.txt
//
// Double-click builder.exe on any Windows machine: splash plays,
// the local server boots from app/, the editor opens. No installs.
// ============================================================

import { cpSync, existsSync, mkdirSync, writeFileSync, copyFileSync, readFileSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const target = process.argv[2];
if (!target) {
  console.error("Usage: node desktop/scripts/make-portable.mjs <target-folder>");
  process.exit(1);
}

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const exe = join(repo, "desktop", "src-tauri", "target", "release", "baghdos-workshop.exe");
if (!existsSync(exe)) {
  console.error("Build the shell first: cd desktop && npm run tauri:build (on Windows)");
  process.exit(1);
}
if (!existsSync(join(repo, ".next"))) {
  console.error("Build the app first: npm run next:build (in the repo root)");
  process.exit(1);
}

const NODE_VERSION = "v22.12.0"; // pin; update deliberately
const nodeZipUrl = `https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-win-x64.zip`;
// sha256 of node-v22.12.0-win-x64.zip from nodejs.org/dist/v22.12.0/SHASUMS256.txt
// (the publisher's signed manifest). Update this in lockstep with NODE_VERSION.
const NODE_ZIP_SHA256 = "2b8f2256382f97ad51e29ff71f702961af466c4616393f767455501e6aece9b8";

mkdirSync(target, { recursive: true });
copyFileSync(exe, join(target, "baghdos-workshop.exe"));

// Portable Node: download once, cache next to the script.
const nodeCache = join(repo, "desktop", ".node-cache", NODE_VERSION);
if (!existsSync(join(nodeCache, "node.exe"))) {
  console.log(`Downloading portable Node ${NODE_VERSION}…`);
  mkdirSync(nodeCache, { recursive: true });
  const zip = join(nodeCache, "node.zip");
  execSync(`curl -fL -o "${zip}" "${nodeZipUrl}"`, { stdio: "inherit" });
  // FAIL-CLOSED: verify against the publisher's pinned sha256 before extracting
  // — the runtime that executes everything on the drive must not be unverified.
  const actual = createHash("sha256").update(readFileSync(zip)).digest("hex");
  if (actual !== NODE_ZIP_SHA256) {
    rmSync(zip, { force: true });
    console.error(`Node download failed checksum: expected ${NODE_ZIP_SHA256}, got ${actual}. Not extracting.`);
    process.exit(1);
  }
  console.log("  Node sha256 verified ✓");
  execSync(`tar -xf "${zip}" -C "${nodeCache}" --strip-components=1`, { stdio: "inherit" });
}
mkdirSync(join(target, "node"), { recursive: true });
copyFileSync(join(nodeCache, "node.exe"), join(target, "node", "node.exe"));

// The app folder: production build + everything the server needs.
console.log("Copying the app…");
const appDir = join(target, "app");
for (const item of [
  ".next", "node_modules", "builder", "content", "public", "scripts", "src", "app",
  "netlify", "package.json", "package-lock.json", "next.config.mjs", "tailwind.config.mjs", "postcss.config.mjs", "tsconfig.json",
]) {
  const src = join(repo, item);
  if (existsSync(src)) cpSync(src, join(appDir, item), { recursive: true });
}

// Prune dev dependencies (Playwright, Lighthouse CI, type packages, the
// bundle analyzer…): `next start` needs only production deps, and the
// copied node_modules is ~800 MB otherwise. Offline-safe — prune just
// deletes from the tree, no network.
console.log("Pruning dev dependencies (smaller drive footprint)…");
try {
  execSync("npm prune --omit=dev", { cwd: appDir, stdio: "inherit" });
} catch {
  console.warn("  prune skipped (npm not on PATH) — the drive will be larger but still works.");
}

// Give the app folder its own git repo so the History panel works on the
// drive: fs-mode saves auto-commit (see src/builder/storage/fs.ts), and
// this is the repo they commit into. Best-effort.
console.log("Initializing version history…");
try {
  execSync("git init -q", { cwd: appDir, stdio: "inherit" });
  execSync('git -c user.email=workshop@local -c user.name=Workshop add builder content', { cwd: appDir, stdio: "ignore" });
  execSync('git -c user.email=workshop@local -c user.name=Workshop -c commit.gpgsign=false commit -q -m "Initial workshop state"', { cwd: appDir, stdio: "ignore" });
} catch {
  console.warn("  git not found on this machine — History will be empty on the drive (Backup/Restore still works).");
}

writeFileSync(
  join(target, "README.txt"),
  `Baghdo's Workshop — portable

Double-click baghdos-workshop.exe. The splash plays while the local server starts,
then the editor opens. Everything lives in this folder: your pages,
products, theme and shipping data are plain files under app\\builder and
app\\content — git-friendly, backup-friendly.

Local AI (optional): install Ollama on the host machine and the ✨ AI
panel lights up. Nothing else phones home — this folder works offline.
`
);
console.log(`Portable build assembled at ${target}`);

// ── Game Mode + portable environment skeleton (plan §23) ────
// The fun layer's home + the private data directory, created empty:
// the Godot PROJECT ships as source; the exported exe and all user
// data (profiles, saves, the Retro Game Room's media) live here.
{
  const dirs = [
    "game-mode/godot-export",
    "portable/profiles",
    "portable/quicksaves",
    "portable/backups",
    "portable/retro/library",
    "portable/retro/emulator-profiles",
    "portable/retro/controller-profiles",
    "portable/retro/emulators",
    "portable/retro/user-media/isos",
    "portable/retro/user-media/covers",
    "portable/retro/vm-images",
    "portable/retro/save-data",
    "portable/retro/screenshots",
    "portable/retro/logs",
  ];
  for (const d of dirs) mkdirSync(join(target, d), { recursive: true });
  const gmSrc = join(repo, "desktop", "game-mode");
  if (existsSync(gmSrc)) {
    cpSync(join(gmSrc, "godot-project"), join(target, "game-mode", "godot-project"), { recursive: true });
    cpSync(join(gmSrc, "CREDITS.md"), join(target, "game-mode", "CREDITS.md"));
  }
  writeFileSync(
    join(target, "portable", "settings.json"),
    JSON.stringify({ schemaVersion: 1, gameRoom: { enabled: false }, gameModeDefault: false }, null, 2) + "\n"
  );
  writeFileSync(
    join(target, "game-mode", "godot-export", "README.txt"),
    "Open ../godot-project in Godot 4.3+ (free, godotengine.org), Project > Export > Windows Desktop,\nand save the exe here. The launcher's Game Mode toggle finds it automatically.\n"
  );
  writeFileSync(
    join(target, "portable", "retro", "emulators", "README.txt"),
    "Place the open-source backends you installed yourself here (dosbox-x.exe, 86Box.exe, qemu-system-i386.exe).\nNo OS images, BIOSes, games or keys are ever bundled - the Retro Game Room only launches media YOU own.\n"
  );
  console.log("game-mode + portable environment skeleton created");
}
