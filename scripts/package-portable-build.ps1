# package-portable-build.ps1 — assemble the complete flash-drive folder:
# launcher + runtime + app + game-mode + portable skeleton, then preflight.
$ErrorActionPreference = "Stop"
$repo = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repo
node desktop\scripts\make-portable.mjs
node scripts\preflight-portable.mjs
Write-Host "`nIf preflight shows blockers, desktop\scripts\build-windows.ps1 is the full guided build." -ForegroundColor Yellow
