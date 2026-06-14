# Build Launcher.exe on Windows — needs only Go (https://go.dev/dl/).
$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot\.."
New-Item -ItemType Directory -Force -Path build | Out-Null
$env:GOOS="windows"; $env:GOARCH="amd64"; $env:CGO_ENABLED="0"
go build -trimpath -ldflags="-H windowsgui -s -w" -o build\Launcher.exe .
Write-Host "Built build\Launcher.exe"
