#!/usr/bin/env node
// Renamed: the sidecar-tools installer now lives at install-retro-tools.mjs
// (per-tool folders, checksum pins, manifest + THIRD_PARTY_NOTICES).
console.log("This script moved → run: node scripts/install-retro-tools.mjs");
await import("./install-retro-tools.mjs");
