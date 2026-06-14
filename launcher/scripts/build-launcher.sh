#!/usr/bin/env bash
# Build Launcher.exe (Windows x64) from any OS — needs only Go.
set -e
cd "$(dirname "$0")/.."
mkdir -p build
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags="-H windowsgui -s -w" -o build/Launcher.exe .
echo "Built build/Launcher.exe ($(du -h build/Launcher.exe | cut -f1))"
