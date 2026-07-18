# Embedded Mode — manual smoke checklist

Do **not** attach screenshots, HAR, cookies, or account identifiers to issues.

## Prerequisites

```bash
cd companion
npm ci
npm run package:runtime
npm run tauri dev
# or open the built .app
```

### Maintainer build evidence (automated, not EA login)

| Check | Result | Notes |
|-------|--------|-------|
| `npm run tauri build -- --bundles app` | done (local) | ad-hoc codesign `-` |
| `npm run check:bundle:macos` | pass | runtime embedded in binary via `include_str!` |
| Info.plist version | `0.2.0-beta.1` | |
| Notarization | **not run** | blocked by Apple secrets (H7) |
| Windows NSIS clean install/uninstall | **wired in CI; awaiting a recorded green run** | see `windows-install-smoke.ps1`; upgrade not in CI |
| Live WebView fixture integration | **pending** | pure-function tests only in-repo |

## Settings

- [ ] Default: Embedded Mode is **OFF**
- [ ] Enable Embedded Mode → Save → badge shows Embedded
- [ ] Disable Embedded Mode → Save → browser fallback path works

## FUT window (Embedded ON)

- [ ] **Show FUT** opens a single `FSU · FUT` window (not Chrome)
- [ ] Second **Show FUT** focuses the same window (no duplicate)
- [ ] Close button **hides** the window; Show FUT restores it
- [ ] In-webview toolbar visible: ← → ↻ ⌂
- [ ] Toolbar Back / Forward / Reload / Home work without breaking EA text input
- [ ] Clean profile: EA login page loads
- [ ] macOS: quitting Companion clears the non-persistent Embedded login session
- [ ] After login, FUT web-app path loads
- [ ] `document.documentElement[data-fsu-embedded="1"]` present (devtools)
- [ ] `window.__FSU_EMBEDDED_RUNTIME_V1__` has `host: true` on FUT app pages
- [ ] Reload FUT does not double-install (marker flags stay true; no crash)

## Navigation policy

- [ ] External links do not navigate the FUT webview
- [ ] Diagnostics may show last blocked **host** only (no path/query)

## Site data

- [ ] Clear Embedded site data → confirm dialog → signs out of EA **in Companion only**
- [ ] Companion settings unchanged after clear
- [ ] Browser Extension unaffected

## Tray

- [ ] Show FUT / Show Settings / Reload FUT / Open FUT in Browser / Quit
- [ ] Quit exits the app

## Fallback

- [ ] With Embedded OFF, primary button opens system browser
- [ ] Extension still loads and works independently after Companion install

## Handshake / recovery (H1)

- [ ] After FUT app load, status reaches **ready** within ~5s (or **failed** with `RUNTIME_HANDSHAKE_TIMEOUT`, never stuck on starting forever)
- [ ] Reload FUT clears error and starts a new generation
- [ ] Failed overview shows **Reload FUT** and **browser fallback** (no infinite auto-reload)
- [ ] Auth page does not install userscript / does not start handshake watchdog
- [ ] Diagnostics show error **codes** only — no token, no full URL query

## Data store (H4)

- [ ] macOS: after full quit, Embedded login session is **not** retained (non-persistent store)
- [ ] Windows: profile under Companion app data; Clear site data removes only Embedded profile
- [ ] Clear site data does **not** clear Companion settings or browser Extension

## Platform matrix (H6)

| Case | macOS ARM | Windows 11 | Notes |
|------|-----------|------------|-------|
| Clean install | [ ] | [ ] | version: ____ date: ____ |
| EA login/2FA | [ ] | [ ] | no screenshots/HAR |
| FUT ready handshake | [ ] | [ ] | |
| Reload/idempotence | [ ] | [ ] | |
| Price/config request | [ ] | [ ] | public endpoints only |
| Clear site data | [ ] | [ ] | |
| Browser fallback | [ ] | [ ] | |
| Uninstall | [ ] | [ ] | CI is wired; mark complete only after a recorded green run |
| Upgrade | [ ] | [ ] | **not CI-automated** (needs two versions) |

Mark **unknown** if not tested. Do not claim signed Gatekeeper/SmartScreen success without H7 credentials.

## Failure notes

Record platform (macOS/Windows + arch), Companion version, and error **codes** only.
Never paste session tokens or full URLs with query strings.

## External blockers (H7)

- Apple Developer ID + notarization: **blocked until secrets configured**
- Windows code-signing certificate: **blocked until secrets configured**
- Signed update channel: **not_configured**
- H8 Native Messaging: **separate program — not part of this hardening slice**
