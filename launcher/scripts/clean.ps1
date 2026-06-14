Set-Location "$PSScriptRoot\.."
Remove-Item -Recurse -Force build,dist-portable -ErrorAction SilentlyContinue
Write-Host "Cleaned"
