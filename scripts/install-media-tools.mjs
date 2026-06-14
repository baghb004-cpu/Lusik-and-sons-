#!/usr/bin/env node
// ============================================================
// install-media-tools.mjs — the FFmpeg sidecar (offline §26)
// ============================================================
// Stages an official FFmpeg/FFprobe build into
// portable/media-studio/bin so the Media Studio can decode,
// trim, thumbnail and convert media locally. FAIL-CLOSED: it
// refuses to stage any download whose bytes don't match the
// sha256 pinned in scripts/media-tools.lock.json (and refuses
// outright when the pin is null). Versions/assets are pinned —
// no GitHub "latest" API guessing. Safe to re-run, no admin,
// nothing outside portable/.
//
//   node scripts/install-media-tools.mjs            # LGPL build (default)
//   node scripts/install-media-tools.mjs --gpl      # GPL build (more codecs)
//   node scripts/install-media-tools.mjs --pin      # print this asset's hash to pin
//
// Licensing (plan §26 §5): the DEFAULT is the LGPL build, whose
// permissive encoders (VP9/AV1/Opus) cover the studio's default
// WebM/AVIF exports cleanly. The --gpl build adds x264/x265 (H.264/
// H.265) but is GPL — only stage it if you accept those terms.
// Either way the binary is a SIDECAR, never linked into the app.
// ============================================================

import { createHash } from "node:crypto";
import { mkdir, writeFile, chmod, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(process.cwd(), "portable", "media-studio", "bin");
const gpl = process.argv.includes("--gpl");
const variant = gpl ? "gpl" : "lgpl";
const wantsPin = process.argv.includes("--pin");

const lock = JSON.parse(await readFile(join(repo, "scripts", "media-tools.lock.json"), "utf8"));
const SOURCE = lock.source;

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

/** The platform-arch lock key for this machine (win-x64 / linux-x64 /
 *  linux-arm64 — a Raspberry Pi 5 is linux-arm64), or null where unsupported. */
function platformKey() {
  if (process.platform === "win32") return "win-x64";
  if (process.platform === "linux") return process.arch === "arm64" ? "linux-arm64" : "linux-x64";
  return null; // macOS: see the note below
}

/** The pinned asset for this platform + variant, or null on macOS. */
function pinnedAsset() {
  const key = platformKey();
  if (!key) return null;
  const entry = lock.variants[variant]?.[key];
  if (!entry) return null;
  return {
    ...entry,
    key,
    url: `${SOURCE}/releases/download/${lock.tag}/${entry.asset}`,
  };
}

async function fetchBuf(url) {
  const res = await fetch(url, { headers: { "User-Agent": "baghdos-workshop" }, redirect: "follow" });
  if (!res.ok) throw new Error(`download failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

console.log(`Media Studio — FFmpeg sidecar installer (${variant.toUpperCase()} build)`);
console.log(`Source: ${SOURCE}  (official static builds)\n`);

const asset = pinnedAsset();
if (!asset) {
  console.log("macOS: install FFmpeg with Homebrew (`brew install ffmpeg`) or download an official static build,");
  console.log(`then copy ffmpeg + ffprobe into ${OUT}. The Media Studio finds them there automatically.`);
  process.exit(0);
}

// --pin: download + print the hash to cross-check and paste into the lock.
if (wantsPin) {
  console.log(`Pinning ${variant} build from:\n  ${asset.url}\n`);
  const buf = await fetchBuf(asset.url);
  console.log(`  ${Math.round(buf.length / 1024 / 1024)} MB`);
  console.log(`  sha256: ${sha256(buf)}`);
  console.log(`\nCross-check against ${SOURCE} (do NOT trust this number alone), then paste it as`);
  console.log(`variants.${variant}.${asset.key}.sha256 in scripts/media-tools.lock.json.`);
  process.exit(0);
}

if (existsSync(join(OUT, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"))) {
  console.log("✓ ffmpeg already staged in portable/media-studio/bin — skipping. (delete it to re-fetch)");
  process.exit(0);
}

await mkdir(OUT, { recursive: true });
try {
  // FAIL-CLOSED: a download is never staged unless its bytes match the pin.
  if (!asset.sha256) {
    throw new Error(
      `${asset.asset} isn't pinned in scripts/media-tools.lock.json — refusing to stage an unverified binary. ` +
        `Run: node scripts/install-media-tools.mjs ${gpl ? "--gpl " : ""}--pin, cross-check the hash against ${SOURCE}, then paste it into the lock.`
    );
  }
  console.log(`↓ ${asset.asset} (${lock.tag})\n   ${asset.url}`);
  const buf = await fetchBuf(asset.url);
  const sha = sha256(buf);
  if (sha.toLowerCase() !== String(asset.sha256).toLowerCase()) {
    throw new Error(`CHECKSUM MISMATCH for ${asset.asset}: expected ${asset.sha256}, got ${sha} — NOT staging it. Upstream rolled the build; re-pin deliberately.`);
  }
  const archive = join(OUT, asset.asset);
  await writeFile(archive, buf);
  console.log(`   ${Math.round(buf.length / 1024 / 1024)} MB · sha256 verified ✓`);
  console.log("   Archive saved. Unzip/untar it so ffmpeg + ffprobe sit directly in portable/media-studio/bin/.");
  if (process.platform !== "win32") await chmod(archive, 0o644).catch(() => {});

  await writeFile(
    join(OUT, "THIRD_PARTY_NOTICES.md"),
    `# FFmpeg — third-party notice\n\nFFmpeg (${variant.toUpperCase()} build) from ${SOURCE}, staged unmodified as a SIDECAR (never linked into the app).\nLicense: ${gpl ? "GPL-2.0+ (this build includes x264/x265 — H.264/H.265)" : "LGPL-2.1+ (permissive codecs; default web exports are clean)"}.\nLicense texts + source: https://ffmpeg.org/legal.html and ${SOURCE}.\nNo patent-encumbered codecs are bundled in the LGPL default.\n`
  );
  await writeFile(
    join(OUT, "MANIFEST.json"),
    JSON.stringify({ component: "ffmpeg", variant, asset: asset.asset, version: lock.tag, source: SOURCE, sha256: sha, installPath: "portable/media-studio/bin/" }, null, 2) + "\n"
  );
  console.log("\n✓ THIRD_PARTY_NOTICES.md + MANIFEST.json written. After unzipping, the Media Studio is ready.");
} catch (err) {
  console.error(`✗ ${err.message}`);
  console.error(`  Offline or blocked? Download an official ${variant} build from ${SOURCE} and put ffmpeg/ffprobe in ${OUT}.`);
  process.exitCode = 1;
}
