#!/usr/bin/env node
// ============================================================
// install-stt-tools.mjs — the offline speech-to-text sidecar
// ============================================================
// Stages a whisper.cpp GGML model into portable/stt/models so
// Communication Coach's Microphone Assist can transcribe ON-DEVICE
// (no cloud, no API). FAIL-CLOSED: a model is only staged if its
// bytes match the sha256 pinned in scripts/stt-tools.lock.json.
//
//   node scripts/install-stt-tools.mjs                 # stage the default (tiny.en)
//   node scripts/install-stt-tools.mjs --model base.en
//   node scripts/install-stt-tools.mjs --pin tiny.en   # download + print sha256 to pin
//
// The whisper BINARY isn't downloaded (no clean cross-platform pinned
// release): on Windows use the prebuilt whisper-cli from the whisper.cpp
// releases; on Linux/Raspberry Pi build it or install via your package
// manager; then put whisper-cli (or main) in portable/stt/bin/ or on PATH.
// ============================================================

import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(process.cwd(), "portable", "stt", "models");
const lock = JSON.parse(await readFile(join(repo, "scripts", "stt-tools.lock.json"), "utf8"));

const argv = process.argv.slice(2);
const modelArg = (() => {
  const i = argv.indexOf("--model");
  return i !== -1 ? argv[i + 1] : "tiny.en";
})();
const pinIdx = argv.indexOf("--pin");

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
async function fetchBuf(url) {
  const res = await fetch(url, { headers: { "User-Agent": "baghdos-workshop" }, redirect: "follow" });
  if (!res.ok) throw new Error(`download failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

console.log("Communication Coach — offline speech-to-text (whisper.cpp) installer");
console.log(`Source: ${lock.engineSource}  (model: ${lock.license})\n`);

// --pin: download + print the hash to cross-check + paste into the lock.
if (pinIdx !== -1) {
  const name = argv[pinIdx + 1];
  const m = lock.models[name];
  if (!m) {
    console.error(`--pin needs a model: ${Object.keys(lock.models).join(", ")}`);
    process.exit(1);
  }
  console.log(`Downloading ${m.file} (~${m.approxMB} MB) from:\n  ${m.url}\n`);
  const buf = await fetchBuf(m.url);
  console.log(`  sha256: ${sha256(buf)}`);
  console.log(`\nCross-check against the model card at ${lock.engineSource}, then paste it as`);
  console.log(`models.${name}.sha256 in scripts/stt-tools.lock.json.`);
  process.exit(0);
}

const model = lock.models[modelArg];
if (!model) {
  console.error(`Unknown --model "${modelArg}". Options: ${Object.keys(lock.models).join(", ")}`);
  process.exit(1);
}

await mkdir(OUT, { recursive: true });
const dest = join(OUT, model.file);
if (existsSync(dest)) {
  console.log(`✓ ${model.file} already staged in portable/stt/models — skipping.`);
} else {
  try {
    if (!model.sha256) {
      throw new Error(
        `${model.file} isn't pinned in scripts/stt-tools.lock.json — refusing to stage an unverified model. ` +
          `Run: node scripts/install-stt-tools.mjs --pin ${modelArg} (where Hugging Face is reachable), cross-check the hash, then paste it into the lock.`
      );
    }
    console.log(`↓ ${model.file} (~${model.approxMB} MB)\n   ${model.url}`);
    const buf = await fetchBuf(model.url);
    const got = sha256(buf);
    if (got.toLowerCase() !== String(model.sha256).toLowerCase()) {
      throw new Error(`CHECKSUM MISMATCH for ${model.file}: expected ${model.sha256}, got ${got} — NOT staging it.`);
    }
    await writeFile(dest, buf);
    console.log(`   sha256 verified ✓ → staged portable/stt/models/${model.file}`);
  } catch (err) {
    console.error(`✗ ${err.message}`);
    process.exitCode = 1;
  }
}

await writeFile(
  join(process.cwd(), "portable", "stt", "THIRD_PARTY_NOTICES.md"),
  `# Offline speech-to-text — third-party notice\n\nEngine: whisper.cpp (${lock.license}) — ${lock.engineSource}, used as a SIDECAR (a separate binary, never linked into the app).\nModels: OpenAI Whisper GGML weights, redistributed by the whisper.cpp project on Hugging Face.\n\nThe binary is provided by you (prebuilt on Windows, built or package-installed on Linux/Raspberry Pi) and placed in portable/stt/bin/ or on PATH.\nEverything runs offline; Microphone Assist sends no audio anywhere.\n`
).catch(() => {});

const haveBin = ["whisper-cli", "whisper", "main"].some((b) => existsSync(join(process.cwd(), "portable", "stt", "bin", process.platform === "win32" ? `${b}.exe` : b)));
console.log(
  haveBin
    ? "\n✓ A whisper binary is staged in portable/stt/bin. The Coach's offline voice is ready once a model is pinned + staged."
    : "\nNext: put a whisper binary (whisper-cli / main) in portable/stt/bin/ or on PATH. On Windows, grab the prebuilt whisper-cli from the whisper.cpp releases; on Linux/Pi build it (make) or install via your package manager."
);
