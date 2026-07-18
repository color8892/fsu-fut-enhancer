# FSU Companion Architecture

> Status: Phase 0–2 shell + **Embedded Mode (opt-in beta)** + **Hardening H1–H5 done; H6 partial; H7 skeleton blocked by credentials**.
> Native Messaging host is **not** implemented (H8 separate).
> Embedded Mode is **off by default** (`embeddedMode: false`).
> Signed/notarized release is **blocked by external credentials** (H7).

## Purpose

FSU Companion is a cross-platform desktop application:

| Platform | Primary artifacts |
|----------|-------------------|
| macOS | Tauri `.app` / `.dmg` |
| Windows | Tauri `.exe` / `.msi` |

| Component | Responsibility |
|-----------|----------------|
| **Chrome / Edge Extension** | Inject into EA FUT Web App when using browser; retained as fallback |
| **Page runtime** | Untrusted page-world `GM_*` shims (Extension path) |
| **Companion `main` window** | Trusted settings / diagnostics / mode control |
| **Companion `fut` window** | Untrusted remote EA FUT Web App + packaged FSU runtime injection |
| **Native host (future)** | Chrome/Edge Native Messaging — **not in this phase** |

## Modes

| Mode | Default | Behavior |
|------|---------|----------|
| **Extension fallback** | Yes | Open FUT in system browser; user loads MV3 extension |
| **Embedded Mode** | Opt-in | Isolated `fut` WebView loads fixed FUT URL; injects packaged lodash + host + userscript |

Embedded does **not** require installing the Extension for the runtime path. The Extension remains fully supported.

## Trust boundaries

```text
Trusted local UI                   Untrusted remote content
main WebViewWindow                 fut WebViewWindow
core:default + main commands       one allowlisted HTTP command
settings / diagnostics             EA FUT + injected packaged FSU
         |                                  |
         +---- explicit allowlisted --------+
              (navigation policy only)
```

1. `main` and `fut` use **different labels and capabilities**.
2. `main` receives the explicit `allow-main-commands` set; no Companion command is granted implicitly.
3. `fut` has **no** `core:default`, opener, filesystem, or shell permissions. Its only command is a GET-only HTTP bridge that revalidates fixed endpoint, header, timeout, redirect, and response-size policies in Rust.
4. Injection sources are **build-time packaged only** (`companion/resources/fsu/` via `package-embedded-runtime.cjs`).
5. Never read/export Cookie, session, `X-UT-SID`, HAR, or account data.
6. Navigation fail-closed via explicit host/path allowlists (no `*.ea.com`).

## Embedded modules (`src-tauri/src/embedded/`)

| File | Role |
|------|------|
| `navigation_policy.rs` | URL classify + allow/deny matrix |
| `window.rs` | Singleton `fut` window create/show/reload/nav |
| `injection.rs` | Marker + host + lodash + userscript composition |
| `http_bridge.rs` | Extension-parity GET requests with a fixed endpoint/header policy |
| `site_data.rs` | Clear the isolated Windows/Linux profile after confirm |
| `status.rs` | Lifecycle: disabled / starting / login_required / ready / failed |

## Runtime injection order

1. Marker (`__FSU_EMBEDDED_RUNTIME_V1__`, mutable flags — not frozen)
2. `embedded-host.js` — `GM_*` via localStorage plus the narrow Rust HTTP bridge
3. In-webview toolbar (history/location only — **no** Tauri invoke)
4. Packaged `lodash.min.js`
5. Generated `userscript.js` (from `extension` build — never hand-edited)

Install is idempotent (marker flags). Full navigation re-runs init script. Scripts are gated to the exact FUT host/path and report success through a per-window token; page load alone never marks the runtime ready.

FUT window **close hides** the singleton (does not destroy), so Show FUT restores quickly.
Clear site data **destroys** the window. Windows/Linux then delete the isolated profile directory. macOS uses a non-persistent WKWebView store because `data_directory` is unsupported there, so destroying the window clears that Embedded session.

## Settings (allowlist)

| Key | Default | Notes |
|-----|---------|-------|
| `embeddedMode` | `false` | Opt-in beta |
| `openEmbeddedOnLaunch` | `true` | Only when embeddedMode on |
| theme, localeHint, … | (existing) | Companion UI only |

## Offline / failure

- If Embedded create fails → status `failed` + Extension/browser fallback remains available.
- Diagnostics never claim Extension “connected” without NM (still offline for Extension IPC).

## Residual risks (explicit)

- **EA login in WKWebView/WebView2** must be manually verified per platform; unit tests use policy/fixtures only.
- **Endpoint drift**: EA or price-provider path changes fail closed until the Rust allowlist and tests are updated.
- **macOS session persistence**: the non-persistent WKWebView store requires EA login again after Companion exits.
- **DMG/signing**: production notarization/code signing remains a release process, not ad-hoc success.
- **Real EA session tests** are not automated (no account fixtures).

## Related docs

- [EMBEDDED_APP_PLAN.md](EMBEDDED_APP_PLAN.md)
- [COMPANION_HARDENING_PLAN.md](COMPANION_HARDENING_PLAN.md)
- [COMPANION_HARDENING_AI_PROMPT.md](COMPANION_HARDENING_AI_PROMPT.md)
- [COMPANION_ROADMAP.md](COMPANION_ROADMAP.md)
- [SECURITY.md](SECURITY.md)
