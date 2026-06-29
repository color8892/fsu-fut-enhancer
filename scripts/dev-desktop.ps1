$ErrorActionPreference = "Continue"
Set-Location (Join-Path $PSScriptRoot "..\apps\fsu-desktop\src-tauri")
cargo tauri dev @args
exit $LASTEXITCODE