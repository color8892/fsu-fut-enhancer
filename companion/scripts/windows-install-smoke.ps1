# H6: Windows clean install + uninstall smoke.
# Run on a Windows host after building an NSIS installer.
# Does NOT require EA login. Does not claim code-signing success.
#
# What this script exercises (when CI/Windows runner can run it):
#   - artifact presence/size/hash
#   - silent clean install
#   - installed binary presence
#   - silent uninstall (FAILS if uninstaller missing or exit != 0)
#
# Upgrade testing (install vN then vN+1 over it) is NOT automated here:
# CI builds a single artifact per job, so upgrade remains a manual matrix
# item in docs/EMBEDDED_MANUAL_CHECKLIST.md. Do not claim upgrade was tested
# when only this script ran.
#
# Usage (PowerShell; Administrator may be required for some install paths):
#   .\scripts\windows-install-smoke.ps1 -InstallerPath path\to\FSU_Companion_*.exe
#
# Exit codes: 0 ok, 1 missing args/artifact, 2 install/uninstall failed.

param(
  [Parameter(Mandatory = $true)]
  [string]$InstallerPath,
  [string]$InstallDir = "$env:LOCALAPPDATA\FSU Companion",
  [switch]$SkipUninstall
)

$ErrorActionPreference = "Stop"

function Fail([string]$Message, [int]$Code = 1) {
  Write-Error $Message
  exit $Code
}

if (-not (Test-Path -LiteralPath $InstallerPath)) {
  Fail "Installer not found: $InstallerPath"
}

$item = Get-Item -LiteralPath $InstallerPath
if ($item.Extension -ne ".exe") {
  Fail "Windows smoke currently supports the NSIS .exe installer only: $($item.FullName)"
}
if ($item.Length -lt 1024) {
  Fail "Installer suspiciously small: $($item.Length) bytes"
}

Write-Host "[windows-install-smoke] artifact=$($item.FullName) size=$($item.Length)"
$hash = Get-FileHash -Algorithm SHA256 -LiteralPath $item.FullName
Write-Host "[windows-install-smoke] sha256=$($hash.Hash)"

Write-Host "[windows-install-smoke] clean install (silent)..."
$proc = Start-Process -FilePath $item.FullName -ArgumentList "/S" -Wait -PassThru
if ($null -eq $proc.ExitCode -or $proc.ExitCode -ne 0) {
  Fail "install failed with exit code $($proc.ExitCode)" 2
}

$exeCandidates = @(
  (Join-Path $InstallDir "FSU Companion.exe"),
  (Join-Path $InstallDir "fsu-companion.exe"),
  (Join-Path $env:LOCALAPPDATA "Programs\FSU Companion\FSU Companion.exe"),
  (Join-Path $env:LOCALAPPDATA "Programs\FSU Companion\fsu-companion.exe")
)
# Also search common Tauri NSIS layouts under LocalAppData\Programs
$programsRoot = Join-Path $env:LOCALAPPDATA "Programs"
if (Test-Path $programsRoot) {
  Get-ChildItem -Path $programsRoot -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -in @("FSU Companion.exe", "fsu-companion.exe") } |
    ForEach-Object { $exeCandidates += $_.FullName }
}

$found = $exeCandidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
if (-not $found) {
  Write-Warning "Installed binary not found under expected paths; listing LOCALAPPDATA Programs:"
  Get-ChildItem "$env:LOCALAPPDATA\Programs" -ErrorAction SilentlyContinue | ForEach-Object { Write-Host $_.FullName }
  Fail "post-install binary missing" 2
}
Write-Host "[windows-install-smoke] installed binary: $found"

if (-not $SkipUninstall) {
  Write-Host "[windows-install-smoke] uninstall (silent; required)..."
  $installParent = Split-Path -Parent $found
  $uninst = Get-ChildItem -Path $installParent -Filter "uninstall*.exe" -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if (-not $uninst) {
    # Tauri sometimes names it Uninstall.exe / uninst.exe one level up
    $uninst = Get-ChildItem -Path $installParent -Filter "*uninstall*.exe" -ErrorAction SilentlyContinue |
      Select-Object -First 1
  }
  if (-not $uninst) {
    Fail "uninstaller not found next to installed binary ($installParent); uninstall is required for smoke pass" 2
  }
  Write-Host "[windows-install-smoke] uninstaller: $($uninst.FullName)"
  $u = Start-Process -FilePath $uninst.FullName -ArgumentList "/S" -Wait -PassThru
  if ($null -eq $u.ExitCode -or $u.ExitCode -ne 0) {
    Fail "uninstall failed with exit code $($u.ExitCode)" 2
  }
  Write-Host "[windows-install-smoke] uninstall exit=$($u.ExitCode)"
} else {
  Write-Host "[windows-install-smoke] SkipUninstall set — uninstall not exercised"
}

Write-Host "[windows-install-smoke] OK (clean install+uninstall when not skipped; upgrade is manual; signing is H7 external gate)"
exit 0
