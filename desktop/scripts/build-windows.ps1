# ============================================================
# build-windows.ps1 — the one Windows session, scripted
# ============================================================
# Run this in PowerShell on the Windows machine (right-click →
# "Run with PowerShell", or: powershell -File build-windows.ps1).
# It checks the tools, builds the launcher, assembles the
# portable folder, and tells you the two optional follow-ups
# (Godot export, emulator fetch). Re-runnable; skips what's done.
# ============================================================

$ErrorActionPreference = "Stop"
$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Write-Host "Baghdo's Workshop — Windows build" -ForegroundColor Cyan
Write-Host "Repo: $repo`n"

function Need($cmd, $hint) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Write-Host "MISSING: $cmd — $hint" -ForegroundColor Red
    exit 1
  }
  Write-Host "ok: $cmd"
}

# 1. toolchain
Need node "install Node 22 LTS from nodejs.org"
Need cargo "install Rust from rustup.rs (one click, the default options)"

# 2. app build (the engine the launcher serves)
Set-Location $repo
if (-not (Test-Path "$repo\node_modules")) { npm ci }
npm run next:build

# 3. the launcher exe
Set-Location "$repo\desktop\src-tauri"
cargo build --release
Write-Host "`nLauncher built: desktop\src-tauri\target\release\baghdos-workshop.exe" -ForegroundColor Green

# 4. portable folder (USB layout: exe + node/ + app/ + game-mode/ + portable/)
Set-Location $repo
node desktop\scripts\make-portable.mjs

# 5. preflight — the honest status table
node scripts\preflight-portable.mjs desktop\portable-build 2>$null
if ($LASTEXITCODE -ne 0) { node scripts\preflight-portable.mjs }

Write-Host @"

Optional follow-ups (both one-time):
  • Game Mode: install Godot 4.3+ (godotengine.org), open
    desktop\game-mode\godot-project, Project > Export > Windows Desktop,
    save the exe into <portable folder>\game-mode\godot-export\
    (Or headless, if godot is on PATH:
      godot --headless --path desktop\game-mode\godot-project --export-release "Windows Desktop" ..\godot-export\WorkshopGameMode.exe)
  • Retro backends: node scripts\fetch-emulators.mjs
    (downloads official open-source emulators + license notes; your
     games/Windows media stay yours to supply)
"@ -ForegroundColor Yellow
