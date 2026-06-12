#!/usr/bin/env node
// ============================================================
// fetch-emulators.mjs — one-time, GPL-compliant backend install
// ============================================================
// Downloads the OFFICIAL Windows builds of the Retro Game Room's
// open-source backends into portable/retro/emulators/ — with the
// license obligations handled: each download gets its GPL-2.0
// license text and a SOURCES.md pointing at the official source
// code, which is what redistribution on your thumb drive requires.
//
//   node scripts/fetch-emulators.mjs            # QEMU + DOSBox-X
//   node scripts/fetch-emulators.mjs --with-86box
//
// What this script will NEVER download: Windows images, BIOS/ROM
// files, games, keys — your media stays yours to supply.
// (86Box's machine ROMs are exactly that kind of file: the script
// fetches the 86Box PROGRAM only and tells you where the official
// project distributes its ROM set.)
//
// Already-present backends are kept. Fully offline? Everything
// still works — download on any machine and copy the folder over.
// ============================================================

import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "portable", "retro", "emulators");
const want86 = process.argv.includes("--with-86box");

const GPL2_NOTE = `These binaries are official releases of GPL-2.0 software, redistributed
unmodified. The complete corresponding source code is available from each
project's official repository (see SOURCES.md). The GPL-2.0 license text:
https://www.gnu.org/licenses/old-licenses/gpl-2.0.txt
`;

async function latestGithubAsset(repo, match) {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: { "User-Agent": "baghdos-workshop-fetch", Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${repo}`);
  const release = await res.json();
  const asset = release.assets.find((a) => match.test(a.name));
  if (!asset) throw new Error(`no matching asset in ${repo} ${release.tag_name} (wanted ${match})`);
  return { url: asset.browser_download_url, name: asset.name, tag: release.tag_name };
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { "User-Agent": "baghdos-workshop-fetch" }, redirect: "follow" });
  if (!res.ok) throw new Error(`download failed (${res.status})`);
  const bytes = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, bytes);
  return bytes.length;
}

const TARGETS = [
  {
    id: "dosbox-x",
    label: "DOSBox-X (DOS + early Windows; real save-states)",
    skipIf: ["dosbox-x.exe"],
    get: () => latestGithubAsset("joncampbell123/dosbox-x", /win64.*\.zip$|windows.*x64.*\.zip$/i),
    source: "https://github.com/joncampbell123/dosbox-x",
    note: "Unzip the downloaded archive HERE so dosbox-x.exe sits directly in this folder.",
  },
  ...(want86
    ? [
        {
          id: "86box",
          label: "86Box (accuracy option for stubborn Win95/98 titles)",
          skipIf: ["86Box.exe", "86box.exe"],
          get: () => latestGithubAsset("86Box/86Box", /Windows.*64.*\.zip$/i),
          source: "https://github.com/86Box/86Box",
          note: "86Box also needs its machine ROM set — get it from the official 86Box project (github.com/86Box/roms). This script never downloads ROM files.",
        },
      ]
    : []),
  {
    id: "qemu",
    label: "QEMU (recommended Windows-era backend; SeaBIOS included — no BIOS hunting)",
    skipIf: ["qemu-system-i386.exe", "qemu-system-x86_64.exe"],
    // QEMU's Windows builds live on the maintainer's site, not GitHub releases.
    get: async () => ({ url: null, name: null, tag: "manual" }),
    source: "https://www.qemu.org",
    note: "Windows builds: https://qemu.weilnetz.de/w64/ — download the latest installer/zip and put qemu-system-i386.exe (plus its DLLs) in this folder. One download, no BIOS files needed (SeaBIOS is open-source and included).",
  },
];

await mkdir(OUT, { recursive: true });
let issues = 0;
for (const t of TARGETS) {
  if (t.skipIf.some((f) => existsSync(join(OUT, f)))) {
    console.log(`✓ ${t.id} already present — skipping`);
    continue;
  }
  try {
    const asset = await t.get();
    if (!asset.url) {
      console.log(`→ ${t.id}: manual step — ${t.note}`);
      continue;
    }
    process.stdout.write(`↓ ${t.id} ${asset.tag} (${asset.name})… `);
    const size = await download(asset.url, join(OUT, asset.name));
    console.log(`${Math.round(size / 1024 / 1024)} MB`);
    console.log(`   ${t.note}`);
  } catch (err) {
    issues++;
    console.error(`✗ ${t.id}: ${err.message}`);
    console.error(`   Offline right now? Download manually from ${t.source} and place it in portable/retro/emulators/.`);
  }
}

// the GPL obligations ride along with whatever landed
await writeFile(join(OUT, "LICENSE-NOTE.txt"), GPL2_NOTE);
await writeFile(
  join(OUT, "SOURCES.md"),
  `# Source availability (GPL-2.0 obligation)\n\n${TARGETS.map((t) => `- ${t.label}: ${t.source}`).join("\n")}\n\nNo Windows images, BIOS/ROM files, games, or keys are downloaded by this script — ever.\n`
);
console.log(issues ? "\nDone with warnings — see above." : "\nDone. License note + source list written beside the binaries.");
