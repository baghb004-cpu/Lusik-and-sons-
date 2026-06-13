#!/usr/bin/env bash
# ============================================================
# Baghdo's Workshop — Raspberry Pi / Linux launcher (secondary target)
# ============================================================
# The Linux equivalent of the Windows Tauri shell (baghdos-workshop.exe).
# Same idea: boot the local builder server from the portable Node runtime
# on this drive, open the browser at /builder with a one-time token, and
# take the server down when you close this launcher. No install, offline.
#
#   Layout it expects (next to this script):
#     node/bin/node        portable Node runtime (linux-arm64 on a Pi 5)
#     app/                 the built builder project (package.json, .next, …)
#
# Assemble the drive for a Pi with:
#   node desktop/scripts/make-portable.mjs <target-folder> --target linux-arm64
# (run that ON an arm64 machine — the Pi itself is fine — so app/node_modules
#  carries the arm64 native binaries.)
# ============================================================
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE="$HERE/node/bin/node"
APP="$HERE/app"
PORT="${WORKSHOP_PORT:-4799}"

if [ ! -x "$NODE" ]; then
  echo "Portable Node not found at node/bin/node."
  echo "Assemble this drive for arm64: node desktop/scripts/make-portable.mjs <folder> --target linux-arm64"
  exit 1
fi
if [ ! -f "$APP/package.json" ]; then
  echo "app/ not found next to this launcher."
  exit 1
fi

# One-time, unguessable token — the ONLY gate on a local server that reads and
# writes files on disk. 32 bytes from the OS RNG → 64 hex chars.
TOKEN="baghdo-pi-$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
URL="http://127.0.0.1:${PORT}/builder#token=${TOKEN}"

cd "$APP"
BUILDER_LOCAL_TOKEN="$TOKEN" NODE_ENV=production \
  "$NODE" node_modules/next/dist/bin/next start -p "$PORT" >/dev/null 2>&1 &
SERVER_PID=$!

# Always take the server down with us (Ctrl-C, window close, or normal exit).
cleanup() { kill "$SERVER_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

# Wait for the port to answer (up to ~120s) before opening the browser.
for _ in $(seq 1 240); do
  if (exec 3<>"/dev/tcp/127.0.0.1/${PORT}") 2>/dev/null; then
    exec 3>&- 3<&- || true
    break
  fi
  sleep 0.5
done

# Open a browser in app/kiosk style if we can; otherwise print the URL.
if command -v chromium-browser >/dev/null 2>&1; then
  chromium-browser --app="$URL" >/dev/null 2>&1 &
elif command -v chromium >/dev/null 2>&1; then
  chromium --app="$URL" >/dev/null 2>&1 &
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL" >/dev/null 2>&1 &
else
  echo "Open this in your browser: $URL"
fi

echo "Baghdo's Workshop is running at ${URL}"
echo "Leave this window open. Press Ctrl-C to stop."
wait "$SERVER_PID"
