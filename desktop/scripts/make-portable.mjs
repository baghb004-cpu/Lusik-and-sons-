// ============================================================
// make-portable.mjs — assemble the thumb-drive folder (plan §16)
// ============================================================
// Builds a self-contained drive for ONE target. Windows is the
// primary target; Raspberry Pi 5 / arm64 Linux is a secondary,
// future option that shares the SAME hierarchy.
//
//   node desktop/scripts/make-portable.mjs E:\LusikBuilder
//   node desktop/scripts/make-portable.mjs /media/pi/USB --target linux-arm64
//
// Shared layout (identical on both targets):
//   <target>/
//   ├── app/               the builder project, production-built
//   │   ├── .next/  node_modules/  builder/  content/  public/ …
//   ├── node/              the portable Node runtime (see below)
//   ├── portable/          private data (profiles, saves, retro, settings)
//   ├── game-mode/         Godot project + export slot
//   └── README.txt
//
// Per-target pieces:
//   win-x64      → baghdos-workshop.exe (Tauri shell) + node/node.exe
//                  Double-click the exe.
//   linux-arm64  → start.sh (launcher)              + node/bin/node
//                  Run ./start.sh on the Pi.
//
// The two runtimes can even coexist in one node/ folder (node.exe vs
// bin/node don't collide), but app/node_modules carries NATIVE binaries
// (@next/swc, etc.) that are architecture-specific — so build each target's
// drive ON that architecture (run this on Windows for win-x64, on the Pi or
// an arm64 box for linux-arm64), or reinstall app/node_modules on the target.
// ============================================================

import { cpSync, existsSync, mkdirSync, writeFileSync, copyFileSync, readFileSync, rmSync, chmodSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const argv = process.argv.slice(2);
const target = argv.find((a) => !a.startsWith("--"));
const targetIdx = argv.indexOf("--target");
const platform = targetIdx !== -1 ? argv[targetIdx + 1] : "win-x64";
// --scaffold-only: lay down just the launchers + folder skeleton (no Node
// runtime download, no app copy) — handy to refresh the launcher on an existing
// drive, or to inspect the drive layout quickly.
const scaffoldOnly = argv.includes("--scaffold-only");

if (!target) {
  console.error("Usage: node desktop/scripts/make-portable.mjs <target-folder> [--target win-x64|linux-arm64]");
  process.exit(1);
}

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const NODE_VERSION = "v22.12.0"; // pin; update deliberately

// Per-target config. Node sha256s are from nodejs.org's published
// SHASUMS256.txt for NODE_VERSION (verified before extraction — fail-closed).
const TARGETS = {
  "win-x64": {
    nodeAsset: `node-${NODE_VERSION}-win-x64.zip`,
    nodeSha256: "2b8f2256382f97ad51e29ff71f702961af466c4616393f767455501e6aece9b8",
    launcher: "exe",
  },
  "linux-arm64": {
    nodeAsset: `node-${NODE_VERSION}-linux-arm64.tar.xz`,
    nodeSha256: "8cfd5a8b9afae5a2e0bd86b0148ca31d2589c0ea669c2d0b11c132e35d90ed68",
    launcher: "sh",
  },
};
const cfg = TARGETS[platform];
if (!cfg) {
  console.error(`Unknown --target "${platform}". Use one of: ${Object.keys(TARGETS).join(", ")}`);
  process.exit(1);
}
console.log(`Assembling a ${platform} portable drive at ${target}\n`);

// The built app must exist (its .next is architecture-independent, but the
// app/node_modules we copy below is NOT — see the header note).
if (!scaffoldOnly && !existsSync(join(repo, ".next"))) {
  console.error("Build the app first: npm run next:build (in the repo root)");
  process.exit(1);
}
// The polished Tauri .exe is OPTIONAL — if it isn't built, the drive uses the
// no-compile start.bat launcher (launch.mjs) instead, which is perfect for review.
if (platform === "linux-arm64" && process.arch !== "arm64") {
  console.warn(
    "⚠ Building a linux-arm64 drive on a non-arm64 machine: app/node_modules will carry the WRONG\n" +
      "  architecture's native binaries (@next/swc, etc.). Run this on the Pi (or an arm64 Linux box),\n" +
      "  or reinstall app/node_modules on the Pi before first launch.\n"
  );
}

mkdirSync(target, { recursive: true });

// ── the portable Node runtime → node/ ───────────────────────
// Download once, cache by version+asset, verify against the pinned sha256,
// then stage: win-x64 as node/node.exe, linux-arm64 unpacked into node/
// (so node/bin/node). The two never collide, so a drive can hold both.
const nodeCache = join(repo, "desktop", ".node-cache", `${NODE_VERSION}-${platform}`);
const nodeDir = join(target, "node");
if (!scaffoldOnly) {
  mkdirSync(nodeDir, { recursive: true });
  if (platform === "win-x64") {
    if (!existsSync(join(nodeCache, "node.exe"))) stageNodeDownload(nodeCache);
    copyFileSync(join(nodeCache, "node.exe"), join(nodeDir, "node.exe"));
  } else {
    if (!existsSync(join(nodeCache, "bin", "node"))) stageNodeDownload(nodeCache);
    cpSync(nodeCache, nodeDir, { recursive: true });
  }
}

function stageNodeDownload(dest) {
  console.log(`Downloading portable Node ${NODE_VERSION} (${platform})…`);
  mkdirSync(dest, { recursive: true });
  const archive = join(dest, cfg.nodeAsset);
  const url = `https://nodejs.org/dist/${NODE_VERSION}/${cfg.nodeAsset}`;
  execSync(`curl -fL -o "${archive}" "${url}"`, { stdio: "inherit" });
  // FAIL-CLOSED: verify the publisher's pinned sha256 before extracting — the
  // runtime that executes everything on the drive must not be unverified.
  const actual = createHash("sha256").update(readFileSync(archive)).digest("hex");
  if (actual !== cfg.nodeSha256) {
    rmSync(archive, { force: true });
    console.error(`Node download failed checksum: expected ${cfg.nodeSha256}, got ${actual}. Not extracting.`);
    process.exit(1);
  }
  console.log("  Node sha256 verified ✓");
  execSync(`tar -xf "${archive}" -C "${dest}" --strip-components=1`, { stdio: "inherit" });
  rmSync(archive, { force: true });
}

// ── the launcher ────────────────────────────────────────────
// The cross-platform Node launcher (no compiler needed) goes on every drive.
copyFileSync(join(repo, "desktop", "scripts", "launch.mjs"), join(target, "launch.mjs"));

if (cfg.launcher === "exe") {
  // Windows: a double-clickable start.bat is always written (no Tauri build
  // required); the polished .exe is copied too if it happens to be built.
  const startBat = [
    "@echo off",
    "title Baghdo's Workshop",
    "echo Starting Baghdo's Workshop... a browser window will open shortly.",
    '"%~dp0node\\node.exe" "%~dp0launch.mjs"',
    "pause",
    "",
  ].join("\r\n");
  writeFileSync(join(target, "start.bat"), startBat);
  const exe = join(repo, "desktop", "src-tauri", "target", "release", "baghdos-workshop.exe");
  if (existsSync(exe)) {
    copyFileSync(exe, join(target, "baghdos-workshop.exe"));
    console.log("  bundled the Tauri .exe (polished launcher) + start.bat (no-compile fallback)");
  } else {
    console.log("  no Tauri .exe found — using start.bat (no compile needed). Double-click it to run.");
  }
} else {
  const sh = readFileSync(join(repo, "desktop", "scripts", "start-pi.sh"), "utf8");
  const out = join(target, "start.sh");
  writeFileSync(out, sh);
  chmodSync(out, 0o755);
}

// ── the app folder: production build + everything the server needs ──
const appDir = join(target, "app");
if (!scaffoldOnly) {
  console.log("Copying the app…");
  for (const item of [
    ".next", "node_modules", "builder", "content", "public", "scripts", "src", "app",
    "netlify", "package.json", "package-lock.json", "next.config.mjs", "tailwind.config.mjs", "postcss.config.mjs", "tsconfig.json",
  ]) {
    const src = join(repo, item);
    if (existsSync(src)) cpSync(src, join(appDir, item), { recursive: true });
  }

  // Prune dev dependencies (Playwright, Lighthouse CI, type packages, the
  // bundle analyzer…): `next start` needs only production deps, and the copied
  // node_modules is ~800 MB otherwise. Offline-safe — prune just deletes from
  // the tree. (Runs against THIS machine's arch; see the header note for arm64.)
  console.log("Pruning dev dependencies (smaller drive footprint)…");
  try {
    execSync("npm prune --omit=dev", { cwd: appDir, stdio: "inherit" });
  } catch {
    console.warn("  prune skipped (npm not on PATH) — the drive will be larger but still works.");
  }

  // Give the app folder its own git repo so the History panel works on the
  // drive: fs-mode saves auto-commit (see src/builder/storage/fs.ts), and this
  // is the repo they commit into. Best-effort.
  console.log("Initializing version history…");
  try {
    execSync("git init -q", { cwd: appDir, stdio: "inherit" });
    execSync('git -c user.email=workshop@local -c user.name=Workshop add builder content', { cwd: appDir, stdio: "ignore" });
    execSync('git -c user.email=workshop@local -c user.name=Workshop -c commit.gpgsign=false commit -q -m "Initial workshop state"', { cwd: appDir, stdio: "ignore" });
  } catch {
    console.warn("  git not found on this machine — History will be empty on the drive (Backup/Restore still works).");
  }
} else {
  console.log("Scaffold-only: skipped the Node runtime + app copy (launchers + skeleton only).");
}

const launchLine =
  cfg.launcher === "exe"
    ? "Double-click start.bat (or baghdos-workshop.exe if it's present)."
    : "Run ./start.sh (on a Raspberry Pi 5 or arm64 Linux).";
writeFileSync(
  join(target, "README.txt"),
  `Baghdo's Workshop — portable (${platform})

${launchLine} The local server starts, then the editor opens in the browser.
Everything lives in this folder: your pages, products, theme and shipping data
are plain files under app/builder and app/content — git-friendly, backup-friendly.

Layout:
  ${cfg.launcher === "exe" ? "start.bat              the launcher (Windows — double-click; no install)" : "start.sh               the launcher (Pi / Linux)"}
  launch.mjs             the cross-platform launcher the above calls
  node/                  the portable Node runtime
  app/                   the built builder project
  portable/              your private data (profiles, saves, settings)
  game-mode/             optional Godot companion

Local AI (optional): install Ollama on the host machine and the AI panel lights
up. Nothing else phones home — this folder works offline.

${platform === "linux-arm64"
  ? "Pi note: the optional Retro Game Room emulators + FFmpeg sidecar are staged\nfor your platform by the install scripts (run them on the Pi); the pinned\nWindows builds in scripts/retro-tools.lock.json don't apply to arm64.\n"
  : ""}`
);
console.log(`\nPortable build assembled at ${target}`);

// ── Game Mode + portable environment skeleton (plan §23) ────
// The fun layer's home + the private data directory, created empty: the Godot
// PROJECT ships as source; the exported binary and all user data (profiles,
// saves, the Retro Game Room's media) live here.
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
    "Open ../godot-project in Godot 4.3+ (free, godotengine.org), Project > Export > your platform,\nand save the binary here. The launcher's Game Mode toggle finds it automatically.\n"
  );
  writeFileSync(
    join(target, "portable", "retro", "emulators", "README.txt"),
    "Place the open-source backends you installed yourself here (dosbox-x, 86Box, qemu).\nNo OS images, BIOSes, games or keys are ever bundled - the Retro Game Room only launches media YOU own.\n"
  );
  console.log("game-mode + portable environment skeleton created");
}
