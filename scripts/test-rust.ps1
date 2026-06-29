# Run Rust workspace tests without PowerShell treating cargo stderr as a failure.
$ErrorActionPreference = "Continue"
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
  $PSNativeCommandUseErrorActionPreference = $false
}
Set-Location (Join-Path $PSScriptRoot "..")
& cargo test --workspace @args 2>&1 | ForEach-Object { "$_" }
exit $LASTEXITCODE