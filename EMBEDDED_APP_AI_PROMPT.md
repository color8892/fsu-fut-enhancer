# Prompt：實作 FSU Companion Embedded FUT Mode

> 歷史 prompt：Embedded Mode 已完成初版實作。下一階段請改用
> [COMPANION_HARDENING_AI_PROMPT.md](COMPANION_HARDENING_AI_PROMPT.md)，不要依本文件
> 從零重做 Companion。

你是一位資深 Tauri 2、Rust、TypeScript 與 Chrome MV3 工程師。請在目前 repository
中，將 FSU Companion 擴充為可在 App 內直接顯示 EA FUT Web App 並執行 FSU 增強
runtime 的 Embedded Mode。

## 開始前

1. 先完整閱讀：
   - `AGENTS.md`
   - `ARCHITECTURE.md`
   - `SECURITY.md`
   - `COMPANION_ARCHITECTURE.md`
   - `COMPANION_ROADMAP.md`
   - `EMBEDDED_APP_PLAN.md`
2. 盤點 `companion/`、`shared/protocol/`、`extension/src/content-bridge.js`、
   `page-runtime.js`、`background.js`、`extension/src/fsu/legacy/futweb.js`、
   `FsuContext.js`、`ModuleRegistry.js` 與 build scripts。
3. 不要假設現有 Companion 已支援 Embedded Mode；先以程式和測試確認現況。
4. 不要只寫 plan。依 `EMBEDDED_APP_PLAN.md` 逐 phase 實作、測試、修正與更新文件。
5. 先完成 Phase 0 feasibility gate。Gate 未通過時不要偽造成功狀態或繼續大規模遷移；
   應保留可運作的 Companion + Extension，記錄具體 blocker 與重現方式。

## 產品要求

- 使用者開啟 FSU Companion 後，可以在 App 的 FUT window 使用 EA FUT Web App。
- 正常流程不得打開 Chrome、Edge 或 Safari。
- FSU runtime 由本機打包產物注入，不要求使用者安裝 Extension。
- 現有 Extension 必須保留並繼續通過全部測試，作為 fallback。
- Settings/Diagnostics 使用本機 trusted UI；EA 頁面使用獨立 untrusted remote WebView。
- App 要有 tray/menu bar 的 Show FUT、Show Settings、Reload FUT、Quit。

## 強制安全規則

- `main` 與 `fut` 必須是不同 label、不同 capability。
- 不得把 `core:default`、`opener:default` 或其他 broad permission 給 `fut` window。
- `fut` 不得取得 filesystem、shell、process、clipboard、generic opener 或任意 HTTP proxy。
- 若 remote window 必須 invoke，只能建立用途單一、allowlisted、即使被 EA page 任意呼叫
  也安全的 commands；每個輸入都做 schema、大小、型別與未知欄位驗證。
- 不讀取、保存、log、export 或傳輸 Cookie、EA session ID、`X-UT-SID`、
  authorization header、帳號資料、完整 URL query、頁面 HTML 或 HAR。
- 不繞過 TLS/憑證錯誤，不停用 web security，不 spoof 安全檢查。
- 不接受前端提供的任意完整 URL、method、header、檔案路徑或 command 名稱。
- navigation 與 login origins 必須逐項 allowlist；禁止 `*.ea.com` 這類無限制 wildcard。
- 禁止 CDN/remote JavaScript。所有注入來源必須在 build time 固定並隨 App 打包。
- 不直接修改 generated `extension/src/userscript.js`。

## 實作順序

1. **Feasibility spike**
   - 加入預設關閉的 `embeddedMode`。
   - Rust 建立 external `fut` WebViewWindow。
   - 完成 FUT URL/navigation/new-window allowlist。
   - 驗證 persistent profile、EA 正常登入、popup/redirect、重啟與最小 marker injection。
   - 寫測試證明 `fut` 無法呼叫 `main` privileged commands。

2. **Embedded host**
   - 建立 `companion/src-tauri/src/embedded/` 模組，分離 window、navigation、
     injection、site-data 與 lifecycle。
   - 實作單例 window、tray 接線、error state、retry 與 Extension fallback。
   - 不把所有邏輯堆進 `lib.rs`。

3. **Runtime adapter**
   - 先 characterization test 現有 Extension 啟動順序。
   - 抽出最小 `FsuHostAdapter`，保持 domain/patch 不依賴 Tauri 或 Chrome global。
   - Embedded 依序安裝 packaged lodash、bootstrap、generated userscript。
   - install 必須 idempotent，支援 reload、route change、resume 與失敗復原。
   - Extension 與 Embedded 共用 `extension/src/fsu/` source，不複製第二套業務邏輯。

4. **Settings/protocol**
   - 透過 `shared/protocol` 定義 allowlisted settings 與 EmbeddedStatus。
   - TypeScript/Rust 使用 contract fixture parity tests。
   - unknown/malformed/oversized/pollution 全部 fail closed。
   - 保留 Windows/macOS atomic settings replacement。

5. **Desktop UX**
   - App 正常啟動直接顯示 FUT。
   - 提供 Back、Forward、Reload、Home、Settings 的緊湊工具列。
   - 完成 loading、login required、offline、blocked navigation、injection failure、
     incompatible EA update 等狀態。
   - 不做 landing page，不在 UI 顯示教學式功能介紹。

6. **Tests and release**
   - 補 URL policy、capability、injection order/idempotence、settings、redaction 單元測試。
   - 用本機 fixture server 做 remote WebView integration test，不使用真實 EA session。
   - 更新 macOS/Windows GitHub Actions。
   - 實際產生 macOS `.app/.dmg` 與 Windows installer。
   - 保留 signing/notarization 的 production 文件，不把 ad-hoc signing 說成正式簽章。

## 工程約束

- 遵循現有架構與 `AGENTS.md`；不要進行無關重構。
- 手動修改一律用 patch；build/format 產物可由既有 commands 產生。
- 新增 Rust/TypeScript 模組要小而可測。
- 不使用 broad `any`、`@ts-ignore` 或 catch 後假裝成功。
- 不因測試困難而刪除 security check。
- 不降低 Extension manifest、background request policy 或 HTML safety。
- 不提交 `node_modules`、`target`、`dist`、Cookie、session、HAR 或真實帳號 fixture。
- 遇到 repository 中既有未提交變更時保留並協同修改，不得 reset/revert。

## 每個 Phase 的工作方式

1. 先列出正在修改的檔案與風險。
2. 實作最小完整 slice。
3. 立即新增或更新測試。
4. 執行該 slice 的 lint/typecheck/tests。
5. 以實際程式狀態更新文件與 roadmap；未完成項目不得打勾。
6. 再進入下一 phase。

## 最終驗證

至少執行：

```bash
cd companion
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run tauri build

cd ../extension
npm ci
npm run lint
npm run test:all
npm run package
```

修改 EA patch/runtime 後，若有本機合法 bundle，再執行：

```bash
npm run check:ea-bundle -- --bundles <local-ea-bundle-dir>
```

另需完成：

- macOS strict codesign/bundle verification
- DMG mount + internal app verification
- Windows CI 或 Windows 11 實機 build/smoke
- clean-profile Embedded login manual checklist
- remote `fut` capability deny test
- runtime reload/idempotence smoke

## 最終回報格式

1. 已完成 phases 與實際使用流程。
2. 安全邊界和 capability 列表。
3. 主要檔案與架構變更。
4. 測試、build、manual smoke 的精確結果。
5. 未完成項目、平台限制與 residual risks。
6. 產物路徑。

不要只回覆「完成」。如果 EA 登入、remote WebView、Windows build、簽章或測試沒有
實際驗證，必須明確說明，不能推測通過。
