# FSU EAFC FUT Web Enhancer Chrome Extension

Chrome MV3 wrapper for the FSU Ultimate Team Web App enhancer.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click **Load unpacked**.
4. Select this **`extension`** folder.

## Files

- `manifest.json`: Chrome MV3 manifest.
- `src/fsu/`: Modular source (edit here).
- `src/userscript.js`: Build output — do not hand-edit.
- `src/page-runtime.js`: `GM_*` and `unsafeWindow` shim.
- `src/content-bridge.js`: Script injection and Chrome API bridge.
- `src/background.js`: Cross-origin requests and `GM_openInTab`.
- `vendor/lodash.min.js`: Lodash 4.17.21.

## Development

```bash
npm install
npm run test:all
npm run build
```

After changing `src/fsu/`, rebuild then reload the extension and refresh FUT tabs (F5).