#!/usr/bin/env node
// ============================================================
// preflight-portable.mjs — "is the flash drive ready?" in one go
// ============================================================
// Run it against a portable build folder (or the repo for the
// dev view): prints the ideal-status table — launcher, Godot,
// backends, media, saves, privacy — with what to do for anything
// missing. Read-only; never touches the internet.
//
//   node scripts/preflight-portable.mjs [path-to-portable-folder]
// ============================================================

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] ? join(process.cwd(), process.argv[2]) : process.cwd();
const inPortableLayout = existsSync(join(root, "node")) && existsSync(join(root, "app"));
const appDir = inPortableLayout ? join(root, "app") : root;

const list = (p) => {
  try {
    return readdirSync(p);
  } catch {
    return [];
  }
};
const has = (p) => existsSync(join(root, p));

// emulators may sit flat or in per-tool sidecar folders
const emuRoot = join(root, "portable", "retro", "emulators");
const emus = list(emuRoot).flatMap((e) => {
  const sub = list(join(emuRoot, e));
  return sub.length > 0 ? sub : [e];
});
const games = list(join(root, "portable", "retro", "library")).filter((f) => f.endsWith(".json"));
const vms = list(join(root, "portable", "retro", "vm-images")).filter((f) => !f.startsWith("."));
const godot = list(join(root, "game-mode", "godot-export")).some((f) => f.endsWith(".exe") || f.endsWith(".x86_64"));

const rows = [
  ["Launcher .exe", inPortableLayout ? (has("baghdos-workshop.exe") ? "✅ built and detected" : "❌ missing — desktop/scripts/build-windows.ps1 on a Windows PC") : "ℹ dev checkout (run make-portable for the USB layout)"],
  ["Builder app + runtime", inPortableLayout ? "✅ app/ + node/ in place" : existsSync(join(appDir, "package.json")) ? "✅ repo checkout" : "❌ app folder missing"],
  ["Godot Game Mode", godot ? "✅ exported and detected" : "○ optional — export desktop/game-mode/godot-project once in Godot 4.3+"],
  ["DOSBox-X", emus.some((f) => /^dosbox-x/i.test(f)) ? "✅ detected" : "○ run: node scripts/install-retro-tools.mjs"],
  ["QEMU (Win-era)", emus.some((f) => /^qemu-system/i.test(f)) ? "✅ detected" : "○ one download — staged by: node scripts/install-retro-tools.mjs"],
  ["86Box (accuracy option)", emus.some((f) => /^86box/i.test(f)) ? "✅ detected" : "○ optional — install-retro-tools.mjs stages it (official ROM set stays user-supplied)"],
  ["Game media", games.length > 0 ? `✅ ${games.length} game(s) on the shelf` : "○ user-provided — adopt a LEGO template with your own ISO/disc"],
  ["Windows 95/98 guest", vms.length > 0 ? `✅ ${vms.length} virtual disk(s)` : "○ user-provided only — your own install media into a .qcow2 (profile notes show the command)"],
  ["Saves & backups", has("portable/retro/save-data") ? "✅ portable folders ready" : "○ created on first run (or the Setup wizard's Fix button)"],
  ["Offline fonts", existsSync(join(appDir, "public", "fonts", "armenian.woff2")) ? "✅ bundled" : "○ node scripts/fetch-fonts.mjs (one-time)"],
  ["Licenses & notices", has("portable/THIRD_PARTY_NOTICES.md") && has("portable/licenses") ? "✅ THIRD_PARTY_NOTICES.md + licenses/ present" : "○ written by: node scripts/install-retro-tools.mjs"],
  ["Components manifest", has("portable/retro/COMPONENTS_MANIFEST.json") ? "✅ provenance recorded (name/version/source/license/sha256)" : "○ written by the installer"],
  ["Privacy mode", "✅ offline/local-only by default — no telemetry, no accounts, no cloud; internet only for explicit install/update commands"],
];

// Forbidden-file scan: bundled locations must never contain media that
// only the user may supply. (portable/retro/user-media is THEIRS — allowed.)
const forbidden = [];
const scanDirs = ["portable/retro/emulators", "game-mode"];
const walk = (dir, depth = 0) => {
  if (depth > 3) return;
  for (const f of list(join(root, dir))) {
    const rel = `${dir}/${f}`;
    if (/\.(iso|img|wim|vhd)$/i.test(f) || /^win(dows)?.*\.(zip|exe)$/i.test(f) && /9[58]|xp|2000/i.test(f)) forbidden.push(rel);
    walk(rel, depth + 1);
  }
};
for (const d of scanDirs) walk(d);
rows.push([
  "No copyrighted media bundled",
  forbidden.length === 0 ? "✅ clean — bundled folders contain tools only" : `❌ found in bundled locations: ${forbidden.slice(0, 3).join(", ")} — user media belongs in portable/retro/user-media/`,
]);

const width = Math.max(...rows.map(([a]) => a.length));
console.log("\nFlash-drive build preflight — " + root + "\n");
for (const [k, v] of rows) console.log(`  ${k.padEnd(width)}  ${v}`);
const blockers = rows.filter(([, v]) => v.startsWith("❌")).length;
console.log(
  blockers
    ? `\n${blockers} blocker(s) above — everything marked ○ is optional or user-supplied media.\n`
    : "\nNo blockers. Anything marked ○ is optional (or media only you can supply).\n"
);
process.exitCode = blockers ? 1 : 0;
