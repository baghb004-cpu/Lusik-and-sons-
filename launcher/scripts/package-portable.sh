#!/usr/bin/env bash
# Assemble the portable release folder (the thumb-drive folder).
set -e
cd "$(dirname "$0")/.."
[ -f build/Launcher.exe ] || bash scripts/build-launcher.sh
rm -rf dist-portable
mkdir -p dist-portable/app-data dist-portable/resources dist-portable/logs dist-portable/exports dist-portable/apps
cp build/Launcher.exe dist-portable/Launcher.exe
cp templates/README_FIRST.txt dist-portable/README_FIRST.txt
echo "Put bundled assets (icons, fonts, sample files) here." > dist-portable/resources/README.txt
echo "Drop any .html file here and it appears on the desktop as an app." > dist-portable/apps/README.txt
: > dist-portable/projects/.keep
: > dist-portable/logs/.keep
: > dist-portable/exports/.keep
echo "Packaged dist-portable/  (copy this whole folder to a thumb drive)"
