# Full local verification: Rust workspace + extension build/tests.
$ErrorActionPreference = "Continue"
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
  $PSNativeCommandUseErrorActionPreference = $false
}
$root = Join-Path $PSScriptRoot ".."
Set-Location $root

& "$PSScriptRoot\test-rust.ps1"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Set-Location (Join-Path $root "extension")
npm run test:all
exit $LASTEXITCODE