# FSU Companion 0.2.0-beta.1 — Embedded Hardening Beta

## What this is

Unsigned / ad-hoc **desktop beta** of FSU Companion with Embedded Mode opt-in and
hardening slices H1–H6. It is **not** a notarized App Store or signed Windows release.

## Versions

| Component | Version |
|-----------|---------|
| Companion | `0.2.0-beta.1` |
| Extension | independent (see `extension/package.json`) |
| Protocol | `1.0` |

## Included

- Embedded FUT WebView (opt-in, default off)
- Per-document runtime generation + 5s handshake watchdog
- ACL exact-set inventory (`npm run check:acl`)
- Shared request-policy corpus with Extension (`productionEndpoints` drift inventory)
- Lifecycle recovery UX (Reload / Disable Embedded / browser fallback); terminal-state transitions enforced
- HTTP bridge: timeout vs network error codes; public GET bounded backoff; EA market never auto-retried
- Sanitized diagnostics (no session, cookie, SID, full URL query)

## Build evidence (local)

When a maintainer builds on macOS:

```bash
cd companion
npm run package:runtime
npm run tauri build -- --bundles app
npm run check:bundle:macos
```

Expected:

- `.app` at `src-tauri/target/release/bundle/macos/FSU Companion.app`
- Runtime scripts are **compile-time embedded** (`include_str!`) in the binary, not loose files under `Contents/Resources/fsu/`
- `codesign` ad-hoc identity `-` (not Developer ID)
- Notarization skipped without Apple secrets

## Known limits (read before installing)

1. **macOS login is non-persistent** — quitting Companion clears Embedded EA session.
2. **Extension stays offline** — Native Messaging (H8) is not in this beta.
3. **Not signed for Gatekeeper / SmartScreen** until H7 credentials exist.
4. **Update channel** is `not_configured`.
5. **HTTP bridge** is fixed GET allowlist only — not a generic proxy.
6. Real EA login / 2FA matrix must be checked with `docs/EMBEDDED_MANUAL_CHECKLIST.md`.

## Install (unsigned)

### macOS

```bash
cd companion
npm ci
npm run package:runtime
npm run build
npm run tauri build -- --bundles app
# open the .app from src-tauri/target/release/bundle/macos/
```

Gatekeeper may block ad-hoc apps; local developer override is expected for this beta.

### Windows

```bash
cd companion
npm ci
npm run package:runtime
npm run build
npm run tauri build -- --bundles nsis
# CI (windows-latest) runs clean install + uninstall smoke when NSIS artifact exists:
#   scripts/windows-install-smoke.ps1 -InstallerPath <exe>
# Upgrade path is manual (single artifact per CI job) — see EMBEDDED_MANUAL_CHECKLIST.
```

## Security commitments

- No generic URL proxy
- No remote JS execution
- No Cookie / Chrome profile import
- `X-UT-SID` only in-memory for EA transfer-market GET; never logged or exported

## Evidence status (do not over-claim)

| Area | Status |
|------|--------|
| H1–H5 automated unit/integration (pure function / UI) | Done |
| H6 pure-function fixtures | Done (not live WebView) |
| H6 macOS bundle verify (version + codesign) | Done when `.app` built |
| H6 Windows clean install/uninstall | Wired in `windows-latest`; awaiting a recorded green run |
| H6 upgrade install | Manual only |
| H6 live WebView / EA login matrix | Manual / pending |
| H7 signed / notarized release | **Skeleton only — blocked by credentials** |

## External blockers (H7)

- Apple Developer ID + notarization
- Windows code-signing certificate
- Signed update manifest hosting

Do **not** describe this tag as “signed release” until those secrets run successfully.
