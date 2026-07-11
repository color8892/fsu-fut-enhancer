# AGENTS.md — FSU FUT Enhancer

本文件是維護者與 AI 代理的修改契約。系統現況見 [ARCHITECTURE.md](ARCHITECTURE.md)，未來遷移順序見 [ROADMAP.md](ROADMAP.md)。

## 專案定位

FSU 是 Chrome Manifest V3 擴充功能，只在 EA FC Ultimate Team Web App 注入 page runtime 與增強腳本。

- 可編輯應用程式原始碼：`extension/src/fsu/`
- Extension 邊界：`extension/src/background.js`、`content-bridge.js`、`page-runtime.js`
- 產物：`extension/src/userscript.js`，只能由 `npm run build` 產生
- 發行檔：`extension/dist/`，不提交 Git

## 閱讀順序

| 修改內容 | 先讀 |
|----------|------|
| 啟動或 module 接線 | `legacy/futweb.js`、`core/FsuContext.js`、`core/ModuleRegistry.js` |
| Patch 順序 | `core/PatchInstaller.js`、ARCHITECTURE 的 phase 表 |
| 價格或遠端 API | `infra/HttpClient.js`、`src/background.js`、SECURITY |
| SBC 領域邏輯 | 對應 `domain/Sbc*Service.js` 與測試 |
| DOM 或 HTML | `ui/UiFactory.js`、`ui/HtmlSafety.js` |
| EA 更新相容性 | `scripts/ea-bundle-check.mjs`、`data/ea-bundle-baseline.json` |
| 大型重構 | ROADMAP 的 phase 與 exit criteria |

## 啟動摘要

```text
content-bridge
  → packaged lodash
  → page-runtime handshake and storage snapshot
  → userscript bundle
  → FsuUserscriptApp
  → futweb
  → FsuContext / ModuleRegistry / PatchInstaller
```

完整流程見 [ARCHITECTURE.md](ARCHITECTURE.md#啟動順序)。

## 模組規則

```text
extension/src/fsu/
  core/       組裝、依賴容器、patch/module registry、共用 runtime
  domain/     可測試的業務邏輯；不應直接依賴 EA 全域
  infra/      HTTP、storage、JSON、cache 等基礎設施
  patches/    EA prototype hook 與薄事件接線
  ui/         DOM factory、安全文字／HTML 邊界、設定畫面、樣式
  data/       靜態設定、本地化與模板
  legacy/     遷移中的啟動編排；禁止新增業務邏輯
```

### Deps

抽出的模組沒有 `futweb()` 閉包。`install*Patches` 和 `register*Events` 必須顯式接收 `deps` 或 `FsuContext`：

1. 在函式入口解構所需依賴。
2. 在 `PatchInstaller` 或 `ModuleRegistry` 使用 `ctx.pick(...)` 傳入。
3. 新增依賴時同步更新 `FsuContext` 欄位、pick allowlist 和相關 `to*Deps()`。
4. `domain/` 透過小型 helper interface 接收能力，不直接讀取 `window.services` 或 `repositories`。

## 安全不變條件

以下規則不能為了相容性直接繞過：

- `content_scripts.matches` 只包含 FUT Web App。
- Page message 一律視為不可信；background 必須重新驗證 request。
- 不接受任意完整 URL、任意 method 或任意 header 的通用代理。
- 新增遠端 endpoint 時，同步更新 manifest、request policy、文件與 allow/deny tests。
- 預設 `credentials: "omit"`、redirect fail closed；例外必須有功能理由。
- 不執行 CDN 或其他 remotely hosted JavaScript。
- 遠端值優先使用 `textContent`；只有 extension 自有常數可進入 `setTrustedHtml`。
- 不記錄或提交 Cookie、session ID、`X-UT-SID`、HAR 或帳號資料。

## TypeScript 策略

這是漸進式 `checkJs` 專案，不做一次性改副檔名：

1. 新增純 `core/`、`domain/`、`infra/` 模組時提供 JSDoc 契約並納入 `tsconfig.json`。
2. 已納入 strict island 的檔案不得用廣泛 `any` 或 `@ts-ignore` 逃避錯誤。
3. EA 動態全域先由 adapter / declaration 描述，再搬入 strict island。
4. 每次擴大 typecheck 範圍都必須保持 `npm run test:all` 通過。

## 開發與驗證

```bash
cd extension
npm ci
npm run lint
npm run typecheck
npm run test:all
npm run package
```

改動 EA patch 後，另執行：

```bash
npm run check:ea-bundle -- --bundles <本機 EA bundle 目錄>
```

本機瀏覽器驗證順序：

1. `npm run build`
2. 在 `chrome://extensions` 重新載入 FSU
3. FUT 分頁按 **F5**
4. 檢查 console、設定頁及受影響功能

## 修改檢查清單

- [ ] 變更符合目前 ARCHITECTURE；未完成的 ROADMAP 項目沒有被描述成現況
- [ ] Patch deps 完整，且沒有新增隱式 EA 全域
- [ ] Patch 安裝 phase 與原始 call chain 有測試或相容性依據
- [ ] 遠端資料有 schema／型別／HTML 邊界處理
- [ ] 新權限和 endpoint 遵守 SECURITY 規則
- [ ] 沒有手改 `src/userscript.js`；bundle 已重新產生
- [ ] `npm run lint` 與 `npm run test:all` 通過
- [ ] 文件、測試和產物與行為同步

## 常見問題

| 現象 | 常見原因 | 處理 |
|------|----------|------|
| `xxx is not defined` | patch deps 漏傳 | 補 `FsuContext.pick()` 與呼叫端依賴 |
| `key.indexOf` on undefined | localization key 無效 | 修呼叫端；不要只依賴 `Localization` fallback |
| `Extension was reloaded…` | 舊分頁的 extension context 失效 | 重新載入擴充後按 F5 |
| request 回傳 `SecurityError` | endpoint 不符合 background policy | 檢查 origin、path、method 與 headers；不要放寬成通用代理 |
| patch 在 EA 更新後失效 | prototype 或 method 名稱改變 | 執行 EA bundle compatibility check |

Debug 開關位於 `extension/src/fsu/core/Debug.js`。除錯輸出不得包含 FUT session、Cookie 或個人資料。
