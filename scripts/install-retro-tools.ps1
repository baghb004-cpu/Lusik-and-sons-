# install-retro-tools.ps1 — Windows wrapper for the sidecar installer.
# Shows sources, verifies checksums, stages portable tools, writes the
# manifest + THIRD_PARTY_NOTICES. No admin, nothing outside this folder.
$ErrorActionPreference = "Stop"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js is required (nodejs.org) — or run from the thumb drive's node\node.exe" -ForegroundColor Red; exit 1
}
node "$PSScriptRoot\install-retro-tools.mjs" @args
# On Windows the QEMU step runs its (disclosed) installer silently into
# portable\retro\emulators\qemu — re-run this script after if it asked you
# to download the installer manually.
