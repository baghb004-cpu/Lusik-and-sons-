# Assemble \dist-portable (the thumb-drive folder) on Windows.
$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot\.."
if (-not (Test-Path build\Launcher.exe)) { & "$PSScriptRoot\build-launcher.ps1" }
Remove-Item -Recurse -Force dist-portable -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path dist-portable\app-data\logs,dist-portable\resources,dist-portable\runtime | Out-Null
Copy-Item build\Launcher.exe dist-portable\Launcher.exe
Copy-Item templates\README_FIRST.txt dist-portable\README_FIRST.txt
"This program is fully self-contained - no runtime is required here." | Out-File -Encoding ascii dist-portable\runtime\README.txt
"Put bundled local tools/assets in this folder." | Out-File -Encoding ascii dist-portable\resources\README.txt
Write-Host "Packaged dist-portable\  (copy this whole folder to a thumb drive)"
