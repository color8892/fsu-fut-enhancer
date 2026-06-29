# Run Rust workspace tests without PowerShell treating cargo stderr as a failure.
$ErrorActionPreference = "Continue"
Set-Location (Join-Path $PSScriptRoot "..")
cargo test --workspace @args
exit $LASTEXITCODE