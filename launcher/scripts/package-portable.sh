#!/usr/bin/env bash
# Assemble /dist-portable (the thumb-drive folder).
set -e
cd "$(dirname "$0")/.."
[ -f build/Launcher.exe ] || bash scripts/build-launcher.sh
rm -rf dist-portable
mkdir -p dist-portable/app-data/logs dist-portable/resources dist-portable/runtime
cp build/Launcher.exe dist-portable/Launcher.exe
cp templates/README_FIRST.txt dist-portable/README_FIRST.txt
echo "This program is fully self-contained — no runtime is required here." > dist-portable/runtime/README.txt
echo "Put bundled local tools/assets in this folder." > dist-portable/resources/README.txt
echo "Packaged dist-portable/  (copy this whole folder to a thumb drive)"
