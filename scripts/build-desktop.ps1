$ErrorActionPreference = "Continue"
Set-Location (Join-Path $PSScriptRoot "..\apps\fsu-desktop\src-tauri")
cargo tauri build @args
exit $LASTEXITCODE