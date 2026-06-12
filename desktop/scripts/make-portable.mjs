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

import { cpSync, existsSync, mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const target = process.argv[2];
if (!target) {
  console.error("Usage: node desktop/scripts/make-portable.mjs <target-folder>");
  process.exit(1);
}

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const exe = join(repo, "desktop", "src-tauri", "target", "release", "lusik-builder.exe");
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

mkdirSync(target, { recursive: true });
copyFileSync(exe, join(target, "builder.exe"));

// Portable Node: download once, cache next to the script.
const nodeCache = join(repo, "desktop", ".node-cache", NODE_VERSION);
if (!existsSync(join(nodeCache, "node.exe"))) {
  console.log(`Downloading portable Node ${NODE_VERSION}…`);
  mkdirSync(nodeCache, { recursive: true });
  const zip = join(nodeCache, "node.zip");
  execSync(`curl -L -o "${zip}" "${nodeZipUrl}"`, { stdio: "inherit" });
  execSync(`tar -xf "${zip}" -C "${nodeCache}" --strip-components=1`, { stdio: "inherit" });
}
mkdirSync(join(target, "node"), { recursive: true });
copyFileSync(join(nodeCache, "node.exe"), join(target, "node", "node.exe"));

// The app folder: production build + everything the server needs.
console.log("Copying the app (this is the big one — node_modules ride along)…");
const appDir = join(target, "app");
for (const item of [
  ".next", "node_modules", "builder", "content", "public", "scripts", "src", "app",
  "netlify", "package.json", "next.config.mjs", "tailwind.config.mjs", "postcss.config.mjs", "tsconfig.json",
]) {
  const src = join(repo, item);
  if (existsSync(src)) cpSync(src, join(appDir, item), { recursive: true });
}

writeFileSync(
  join(target, "README.txt"),
  `Lusik Builder — portable

Double-click builder.exe. The splash plays while the local server starts,
then the editor opens. Everything lives in this folder: your pages,
products, theme and shipping data are plain files under app\\builder and
app\\content — git-friendly, backup-friendly.

Local AI (optional): install Ollama on the host machine and the ✨ AI
panel lights up. Nothing else phones home — this folder works offline.
`
);
console.log(`Portable build assembled at ${target}`);
