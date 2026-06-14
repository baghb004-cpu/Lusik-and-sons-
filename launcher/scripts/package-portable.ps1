# Assemble the portable release folder on Windows.
$ErrorActionPreference="Stop"; Set-Location "$PSScriptRoot\.."
if(-not (Test-Path build\Launcher.exe)){ & "$PSScriptRoot\build-launcher.ps1" }
Remove-Item -Recurse -Force dist-portable -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path dist-portable\projects,dist-portable\app-data,dist-portable\resources,dist-portable\logs,dist-portable\exports | Out-Null
Copy-Item build\Launcher.exe dist-portable\Launcher.exe
Copy-Item templates\README_FIRST.txt dist-portable\README_FIRST.txt
"Put bundled assets here." | Out-File -Encoding ascii dist-portable\resources\README.txt
Write-Host "Packaged dist-portable\"
