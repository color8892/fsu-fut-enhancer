# FSU Companion

Cross-platform desktop shell for FSU (Tauri 2 + Vite + TypeScript).

**Current:** `0.2.0-beta.1` Embedded hardening beta.
**H1–H5:** done. **H6:** partial (pure-function fixtures + artifact smokes; live WebView/EA matrix manual).
**Extension link:** offline until Native Messaging (H8).
**Signed release (H7):** skeleton only — blocked by external credentials.

## Prerequisites

- Node.js 22+
- Rust toolchain (stable)
- Platform build deps for Tauri ([guide](https://v2.tauri.app/start/prerequisites/))

## Commands

```bash
npm install
npm run lint
npm run typecheck
npm run check:acl
npm run package:runtime
npm run check:runtime
npm test
npm run build
npm run tauri build -- --bundles app   # macOS
# npm run tauri build -- --bundles nsis  # Windows
npm run check:bundle:macos             # after macOS build
```

Optional public endpoint smoke (not default CI):

```bash
FSU_PUBLIC_SMOKE=1 npm run smoke:public
```

Local macOS artifacts are ad-hoc signed. Public Gatekeeper/SmartScreen releases
require Developer ID / Windows code-signing secrets — see
`docs/COMPANION_BETA_RELEASE_NOTES.md`.

Development:

```bash
npm run tauri dev
```

Closing the main window keeps Companion available from the system tray/menu bar.
Use the tray menu to reopen Companion, open FUT Web App, or quit.

## Layout

| Path | Role |
|------|------|
| `src/` | Framework-free UI |
| `src-tauri/` | Tauri commands, Embedded lifecycle, HTTP bridge |
| `resources/fsu/` | Packaged lodash + host + userscript (build-only) |
| `scripts/` | ACL inventory, runtime pack, macOS bundle verify, Windows install smoke |
| `../shared/protocol/` | Wire protocol + validation |
| `../shared/request-policy-corpus.json` | Shared Extension/Companion policy fixture |

## Security

- No localhost IPC server / no generic proxy
- No EA session storage; diagnostics redacted
- `fut` WebView: only `allow-embedded-http-request`
- macOS Embedded store is non-persistent (re-login after quit)
- Extension permissions unchanged
