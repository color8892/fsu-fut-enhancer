# Extension Development

This directory contains the Chrome Manifest V3 extension and its build tooling. User installation instructions live in the [project README](../README.md).

## Runtime files

| Path | Responsibility |
|------|----------------|
| `manifest.json` | Permissions, FUT page matches, background worker, and packaged resources |
| `src/content-bridge.js` | Isolated-world bootstrap, storage forwarding, and runtime messaging |
| `src/page-runtime.js` | Page-world `GM_*` compatibility layer |
| `src/background.js` | Validated cross-origin requests and tab opening |
| `src/fsu/` | Editable modular application source |
| `src/userscript.js` | Generated IIFE bundle; never edit by hand |
| `vendor/lodash.min.js` | Packaged Lodash 4.17.21; no network fallback |

The page runtime is injected only into EA FUT Web App pages. Cross-origin requests are authorized again in `background.js`; manifest host permission alone is not sufficient authorization.

## Prerequisites

- Node.js 22
- npm with lockfile support
- Playwright Chromium (`npx playwright install chromium`) for browser smoke tests
- Chrome or another Chromium browser for manual verification

```bash
npm ci
npx playwright install chromium
npm run lint
npm run test:ci
```

`test:all` rebuilds `src/userscript.js`, runs incremental strict type checking, and executes the unit/security suite. `test:ci` also loads the MV3 extension in a Playwright persistent context and exercises the page handshake, request rejection, and reload invalidation.

## Common commands

```bash
npm run build             # Bundle src/fsu/index.js
npm run build:watch       # Rebuild while editing
npm run check:version     # Validate manifest/package/runtime version alignment
npm run typecheck         # TypeScript checkJs strict island
npm test                  # Unit, security, and manifest tests
npm run test:all          # Required before commit
npm run test:browser      # MV3 persistent-context smoke
npm run test:ci           # test:all + MV3 lifecycle/security browser smoke
npm run package           # Build dist/fsu-fut-enhancer-<version>.zip
npm run check:ea-bundle   # Check EA prototype compatibility
npm run verify:release    # Full release gate; requires local EA bundles
```

After a code change: build, reload FSU at `chrome://extensions`, then press **F5** in every open FUT tab.

## Request policy

New remote integrations require all of the following:

1. A narrowly scoped `host_permissions` entry in `manifest.json`.
2. An origin and path rule in `src/background.js`.
3. Explicit method, header, credential, redirect, timeout, and response-size behavior.
4. Tests for allowed and rejected requests.

Do not reintroduce a generic full-URL proxy or remotely hosted JavaScript fallback.

## EA compatibility fixtures

Save local EA `compiled_*.js` files in a disposable directory and run:

```bash
npm run check:ea-bundle -- --bundles ../futwebapp/js
```

Only sanitized fixtures belong in `tests/fixtures/`. Never commit HAR files, cookies, session IDs, request headers, account data, or EA bundle snapshots.

`npm run verify:release` fails closed unless `EA_BUNDLES_DIR` points to a
directory containing `compiled_*.js` or `ocompiled.js`. The tag release
workflow downloads a private ZIP from the `EA_BUNDLES_ARCHIVE_URL` repository
secret, extracts it under the runner temporary directory, and runs the same
required check. The ZIP may contain nested directories, but it must contain at
least one recognized bundle filename and must not contain HAR files, cookies,
headers, session data, or account data.
