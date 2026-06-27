# FSU EAFC FUT Web Enhancer Chrome Extension

This folder is an unpacked Chrome extension wrapper around the original `FUT.txt`
Tampermonkey userscript.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click **Load unpacked**.
4. Select the **`extension`** folder inside this repository.

## Files

- `manifest.json`: Chrome MV3 extension manifest.
- `src/userscript.js`: **Built output** from `src/fsu/` (do not edit by hand).
- `src/userscript.source.js`: Frozen Tampermonkey source used for one-time legacy migration.
- `src/fsu/`: Modular userscript source (`AppContext`, `PriceService`, legacy `futweb.js`, etc.).
- `src/page-runtime.js`: Tampermonkey-compatible `GM_*` and `unsafeWindow` shim.
- `src/content-bridge.js`: Injects the page scripts and bridges page messages to Chrome APIs.
- `src/background.js`: Handles cross-origin requests and `GM_openInTab`.
- `vendor/lodash.min.js`: Local copy of lodash 4.17.21, matching the original userscript dependency.

## Development

Edit source under `src/fsu/`, then rebuild:

```powershell
npm run build
```

Re-run the one-time legacy migration from `userscript.source.js` only when needed:

```powershell
npm run prepare:legacy
```

## Validation

Run from this folder:

```powershell
npm run test:all
```
