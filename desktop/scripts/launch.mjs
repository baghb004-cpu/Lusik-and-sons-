#!/usr/bin/env node
// ============================================================
// Baghdo's Workshop — cross-platform launcher (no compiler needed)
// ============================================================
// Boots the bundled builder server from this drive, opens the browser at
// /builder with a one-time token, and takes the server down when you close
// this window. Works on Windows, macOS, and Linux — it's launched by the
// portable Node runtime, so there's nothing to install or compile.
//
// On the assembled drive this sits next to:
//   node/        the portable Node runtime
//   app/         the built builder project (package.json, .next, node_modules)
// and is started by start.bat (Windows) or start.sh (macOS/Linux/Pi).
//
// Env overrides: WORKSHOP_PORT (default 4799), WORKSHOP_APP (default ./app).
// ============================================================

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = process.env.WORKSHOP_APP || join(HERE, "app");
const PORT = Number(process.env.WORKSHOP_PORT || 4799);
const NODE = process.execPath; // the portable node running this script

if (!existsSync(join(APP, "package.json"))) {
  console.error(`Could not find app/ at: ${APP}\nIs this the assembled Workshop drive?`);
  process.exit(1);
}

const token = "baghdo-" + randomBytes(32).toString("hex");
const url = `http://127.0.0.1:${PORT}/builder#token=${token}`;
const nextBin = join(APP, "node_modules", "next", "dist", "bin", "next");

const server = spawn(NODE, [nextBin, "start", "-p", String(PORT)], {
  cwd: APP,
  env: { ...process.env, BUILDER_LOCAL_TOKEN: token, NODE_ENV: "production" },
  stdio: "ignore",
});
server.on("error", (e) => { console.error("Failed to start the server:", e.message); process.exit(1); });

const stop = () => { try { server.kill(); } catch { /* */ } };
process.on("SIGINT", () => { stop(); process.exit(0); });
process.on("SIGTERM", () => { stop(); process.exit(0); });
process.on("exit", stop);

let opened = false;
function openBrowser() {
  if (opened) return; opened = true;
  try {
    if (process.platform === "win32") spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true });
    else if (process.platform === "darwin") spawn("open", [url], { stdio: "ignore", detached: true });
    else spawn("xdg-open", [url], { stdio: "ignore", detached: true }).on("error", () => { /* headless: just print */ });
  } catch { /* */ }
  console.log(`\n  Baghdo's Workshop is running:\n  ${url}\n\n  Leave this window open. Press Ctrl+C to stop.\n`);
}

// poll the port (up to ~120s), then open the browser
let tries = 0;
(function waitForServer() {
  const s = net.connect(PORT, "127.0.0.1");
  s.on("connect", () => { s.end(); openBrowser(); });
  s.on("error", () => { s.destroy(); if (++tries < 240) setTimeout(waitForServer, 500); else { console.error("Server did not start in time."); stop(); process.exit(1); } });
})();
