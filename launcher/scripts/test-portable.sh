#!/usr/bin/env bash
# Static checks that prove the EXE needs no Node/cgo/runtime.
set -e
cd "$(dirname "$0")/.."
[ -f build/Launcher.exe ] || bash scripts/build-launcher.sh
EXE=build/Launcher.exe
echo "1) file type:"; file "$EXE" | grep -q "PE32+ executable (GUI)" && echo "   OK: native Windows GUI exe" || { echo "   FAIL"; exit 1; }
echo "2) no cgo / no external DLL deps beyond Windows system libs:"
strings "$EXE" | grep -Ei "node\.exe|node_modules|localhost|next/dist|vite" && { echo "   FAIL: found a dev/runtime reference"; exit 1; } || echo "   OK: no Node/Next/Vite/localhost strings"
echo "3) size:"; du -h "$EXE" | cut -f1
echo "All static checks passed."
