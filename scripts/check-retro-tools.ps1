# check-retro-tools.ps1 — readiness table for the flash-drive build.
$ErrorActionPreference = "Stop"
node "$PSScriptRoot\preflight-portable.mjs" @args
exit $LASTEXITCODE
