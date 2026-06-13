#!/usr/bin/env node
// ============================================================
// install-media-tools.mjs — the FFmpeg sidecar (offline §26)
// ============================================================
// Stages an official FFmpeg/FFprobe build into
// portable/media-studio/bin so the Media Studio can decode,
// trim, thumbnail and convert media locally. Same honest pattern
// as install-retro-tools: shows the source first, verifies what
// it can, records a manifest + THIRD_PARTY_NOTICES, safe to
// re-run, no admin, nothing outside portable/.
//
//   node scripts/install-media-tools.mjs            # LGPL build (default)
//   node scripts/install-media-tools.mjs --gpl      # GPL build (more codecs)
//
// Licensing (plan §26 §5): the DEFAULT is the LGPL build, whose
// permissive encoders (VP9/AV1/Opus) cover the studio's default
// WebM/AVIF exports cleanly. The --gpl build adds x264/x265 (H.264/
// H.265) but is GPL — only stage it if you accept those terms.
// Either way the binary is a SIDECAR, never linked into the app.
// ============================================================

import { createHash } from "node:crypto";
import { mkdir, writeFile, chmod } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";

const OUT = join(process.cwd(), "portable", "media-studio", "bin");
const gpl = process.argv.includes("--gpl");
const variant = gpl ? "gpl" : "lgpl";

// Official cross-platform static builds (BtbN, GitHub releases — widely used,
// reproducible, with both LGPL and GPL variants). The script resolves the
// latest asset and records its hash; nothing patent-encumbered is bundled in
// the LGPL default.
const REPO = "BtbN/FFmpeg-Builds";
const SOURCE = `https://github.com/${REPO}`;

const platformMatch = () => {
  if (process.platform === "win32") return new RegExp(`win64-${variant}-shared\\.zip$|win64-${variant}\\.zip$`);
  if (process.platform === "linux") return new RegExp(`linux64-${variant}\\.tar\\.xz$`);
  return null; // macOS users: see the note below
};

async function latestAsset(match) {
  const tag = await (await fetch(`https://github.com/${REPO}/releases/latest`, { headers: { "User-Agent": "baghdos-workshop" } })).text().catch(() => "");
  void tag;
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { "User-Agent": "baghdos-workshop", Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const rel = await res.json();
  const asset = rel.assets.find((a) => match.test(a.name));
  if (!asset) throw new Error(`no ${variant} asset for this platform in ${rel.tag_name}`);
  return { url: asset.browser_download_url, name: asset.name, tag: rel.tag_name };
}

console.log(`Media Studio — FFmpeg sidecar installer (${variant.toUpperCase()} build)`);
console.log(`Source: ${SOURCE}  (official static builds)\n`);

const match = platformMatch();
if (!match) {
  console.log("macOS: install FFmpeg with Homebrew (`brew install ffmpeg`) or download an official static build,");
  console.log(`then copy ffmpeg + ffprobe into ${OUT}. The Media Studio finds them there automatically.`);
  process.exit(0);
}

if (existsSync(join(OUT, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"))) {
  console.log("✓ ffmpeg already staged in portable/media-studio/bin — skipping. (delete it to re-fetch)");
  process.exit(0);
}

await mkdir(OUT, { recursive: true });
try {
  const asset = await latestAsset(match);
  console.log(`↓ ${asset.name} (${asset.tag})\n   ${asset.url}`);
  const buf = Buffer.from(await (await fetch(asset.url, { headers: { "User-Agent": "baghdos-workshop" }, redirect: "follow" })).arrayBuffer());
  const sha = createHash("sha256").update(buf).digest("hex");
  const archive = join(OUT, asset.name);
  await writeFile(archive, buf);
  console.log(`   ${Math.round(buf.length / 1024 / 1024)} MB · sha256 ${sha.slice(0, 16)}…`);
  console.log("   Archive saved. Unzip/untar it so ffmpeg + ffprobe sit directly in portable/media-studio/bin/.");
  if (process.platform !== "win32") await chmod(archive, 0o644).catch(() => {});

  await writeFile(
    join(OUT, "THIRD_PARTY_NOTICES.md"),
    `# FFmpeg — third-party notice\n\nFFmpeg (${variant.toUpperCase()} build) from ${SOURCE}, staged unmodified as a SIDECAR (never linked into the app).\nLicense: ${gpl ? "GPL-2.0+ (this build includes x264/x265 — H.264/H.265)" : "LGPL-2.1+ (permissive codecs; default web exports are clean)"}.\nLicense texts + source: https://ffmpeg.org/legal.html and ${SOURCE}.\nNo patent-encumbered codecs are bundled in the LGPL default.\n`
  );
  await writeFile(
    join(OUT, "MANIFEST.json"),
    JSON.stringify({ component: "ffmpeg", variant, asset: asset.name, version: asset.tag, source: SOURCE, sha256: sha, installPath: "portable/media-studio/bin/" }, null, 2) + "\n"
  );
  console.log("\n✓ THIRD_PARTY_NOTICES.md + MANIFEST.json written. After unzipping, the Media Studio is ready.");
} catch (err) {
  console.error(`✗ ${err.message}`);
  console.error(`  Offline or blocked? Download an official ${variant} build from ${SOURCE} and put ffmpeg/ffprobe in ${OUT}.`);
  process.exitCode = 1;
}
