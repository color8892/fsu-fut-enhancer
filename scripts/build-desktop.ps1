$ErrorActionPreference = "Continue"
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
  $PSNativeCommandUseErrorActionPreference = $false
}
Set-Location (Join-Path $PSScriptRoot "..\apps\fsu-desktop\src-tauri")
& cargo tauri build @args 2>&1 | ForEach-Object { "$_" }
exit $LASTEXITCODE