# Prompt：FSU Companion Hardening and Signed Beta

你是一位資深 Tauri 2、Rust、TypeScript、Chrome MV3、macOS WKWebView、
Windows WebView2 與應用程式安全工程師。請在目前 repository 中，依
`COMPANION_HARDENING_PLAN.md` 將現有 FSU Companion Embedded opt-in beta
進行硬化、跨平台驗證與正式發行準備。

## 重要：這不是從零建立 App

目前已存在並必須保留：

- Tauri Companion shell、settings、diagnostics、tray。
- 獨立 `main` 與 `fut` WebViewWindow。
- Embedded runtime marker、host、toolbar、packaged lodash、generated userscript。
- `GM_addStyle` 與 Rust allowlisted `GM_xmlhttpRequest` bridge。
- Token-based runtime ready/failed handshake。
- `allow-main-commands` main-only ACL。
- `allow-embedded-http-request` FUT-only remote ACL。
- 舊 settings migration。
- Embedded disable/reset window destruction。
- macOS non-persistent session fallback。
- Extension/browser fallback。

不要重做已存在的架構，不要恢復舊的 empty FUT permission，也不要把 Embedded
描述成尚未實作。先讀程式與測試確認實際基線。

## 開始前必讀

1. `AGENTS.md`
2. `ARCHITECTURE.md`
3. `SECURITY.md`
4. `COMPANION_ARCHITECTURE.md`
5. `COMPANION_ROADMAP.md`
6. `COMPANION_HARDENING_PLAN.md`
7. `docs/EMBEDDED_MANUAL_CHECKLIST.md`
8. `extension/src/background.js`
9. `companion/src-tauri/src/embedded/`
10. `companion/src-tauri/permissions/`
11. `companion/src-tauri/capabilities/`

## 任務目標

依序完成：

1. H1 Runtime generation、handshake watchdog、stale callback isolation、recovery UI。
2. H2 ACL command inventory exact-set checker。
3. H3 Companion/Extension shared request-policy corpus、failure classification、有限韌性。
4. H4 macOS 14+ custom data-store feasibility；gate 不通過就保留 non-persistent fallback。
5. H5 lifecycle-driven UX 與 sanitized diagnostics。
6. H6 macOS/Windows CI artifact gates 與 test-only WebView integration。
7. H7 signed beta/update workflow skeleton；沒有憑證時只能回報 external blocker。
8. H8 Native Messaging 必須作為後續獨立 program，不要和本次硬化混在同一 PR。

## 執行方式

對每個 H phase：

1. 先盤點相關檔案、現有行為與風險。
2. 先寫 characterization/failure test。
3. 實作最小完整 slice。
4. 立即執行該 slice 的 tests、lint、typecheck、clippy。
5. 更新 architecture、roadmap、manual checklist。
6. 回報精確結果後才進下一 phase。

不要只寫 plan，也不要在第一步大改所有模組。

## 強制安全規則

- EA page、auth page、remote responses 和 page messages 一律視為不可信。
- `fut` 不得取得 `core:default`、`allow-main-commands`、opener、filesystem、shell、
  process、clipboard 或 generic network capability。
- `main` 不得取得 `allow-embedded-http-request`。
- App custom commands 必須全部被 ACL inventory 分類。
- HTTP bridge 只能 GET、固定 endpoint/path/header、有限 timeout、redirect fail closed、
  5 MB response limit。
- 不接受任意完整 URL、method、header、path 或 command。
- `X-UT-SID` 只能在記憶體中轉送到明確 EA transfer-market endpoint；不得 log、
  persist、export、fixture 或顯示。
- 不讀取或匯入 Chrome/Safari Cookie/profile。
- 不記錄 Cookie、session、authorization、HAR、完整 URL query、page HTML、帳號資料。
- 不關閉 TLS 驗證、web security、CSP 或 navigation check。
- 不使用 `*.ea.com` unrestricted wildcard。
- 不執行 CDN 或 remote JavaScript。
- 不手改 `extension/src/userscript.js`。
- 不為了通過測試刪除 deny test 或放寬 capability。

## H1 具體要求

- 每個 FUT top-level document 使用新的 runtime generation/token。
- 只有目前 generation 的 handshake 可改變 status。
- Handshake 超時後使用穩定 error code `RUNTIME_HANDSHAKE_TIMEOUT`。
- 舊 timer、舊 ready、舊 failed 不得污染新 navigation。
- auth page 不注入 runtime、不啟動 watchdog。
- failed UI 提供 Reload FUT、Disable Embedded、browser fallback。
- 不可無限自動 reload。

至少測試：

- ready before timeout
- timeout
- stale ready
- stale timer
- auth to FUT transition
- reload recovery
- disable/reset
- diagnostics token/URL redaction

## H2 具體要求

- 建立 command inventory source/checker。
- Exact-set 比對：
  - `generate_handler!`
  - `main-commands.toml`
  - `embedded-http.toml`
  - `default.json`
  - `fut.json`
- 新增未分類 command 時 CI 必須失敗。
- FUT deny tests 必須覆蓋 settings、diagnostics、window lifecycle、privileged ping。
- Generated ACL manifest 必須有 snapshot/assertion。

## H3 具體要求

- 建立 sanitized shared URL/method/header allow/deny corpus。
- Rust 與 Extension tests 必須讀取同一 corpus。
- 保持現有 endpoint 行為，不新增未使用的 broad origin/path。
- Page supplied User-Agent 依既有 Extension policy 安全丟棄。
- Cookie、Authorization、Origin、Referer、proxy/sec headers 不得轉送。
- Public config/price GET 可有限 retry；EA market request 不可 bridge-level 自動重送。
- Error code 不得包含 query、header value 或 response body。
- 真實 endpoint smoke 必須 opt-in，不能讓預設 CI 依賴外部服務。

## H4 具體要求

- 先做 macOS 14+ custom data-store spike。
- 證明 custom store 可建立、持久化、只清除該 store。
- 若 API/最低系統版本不可靠：
  - 保留 macOS non-persistent store。
  - 不退回 default WKWebsiteDataStore。
  - 文件保留「退出後需重新登入」。
- 不因追求登入持久化而接觸 Safari/Chrome profile。

## H5/H6 具體要求

- UI 以 lifecycle 顯示相關操作，不做 landing page。
- Error state 必須可 recovery，不可永久 spinner。
- Diagnostics 維持 sanitized。
- macOS CI 驗證 app、codesign、runtime resources、userscript hash。
- Windows CI 驗證 NSIS/MSI artifact、install/upgrade/uninstall script。
- Fixture WebView 使用 test-only capability；禁止把 localhost 加入 production `fut.json`。
- 真實 EA login 只做 manual checklist，不提交 screenshot/HAR/account data。

## H7 外部 gate

正式發行需要：

- Apple Developer ID
- notarization credentials
- Windows code-signing certificate
- signed update channel

若 secrets 不存在：

- 完成 workflow、validation、dry-run、文件。
- 將狀態標記 blocked by external credentials。
- 不得聲稱 signed/notarized release 已完成。

## 必跑驗證

```bash
cd companion
npm ci
npm run lint
npm run typecheck
npm test
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
npm run package:runtime
npm run build
npm run tauri build -- --bundles app

cd ../extension
npm ci
npm run lint
npm run typecheck
npm run test:all
npm run package
```

若有合法 EA bundle，再執行：

```bash
cd extension
npm run check:ea-bundle -- --bundles <local-ea-bundle-directory>
```

沒有 bundle 時要寫未執行。

## 手動驗證

使用 `docs/EMBEDDED_MANUAL_CHECKLIST.md`，至少記錄：

- App version
- OS/version/architecture
- clean install 或 upgrade
- login/2FA result
- runtime ready result
- reload/idempotence
- price/config
- clear site data
- browser fallback

不可記錄帳號、Cookie、session、HAR、完整 URL 或 screenshot 中的個資。

## 修改限制

- 保留使用者既有未提交修改；不得 reset/revert。
- 不修改 generated userscript；使用 build。
- 不提交 `node_modules`、`target`、`dist`、真實帳號 fixture。
- 不做無關格式化或 Extension domain refactor。
- 不用 broad `any`、`@ts-ignore`、catch 後假裝成功。
- 遇到失敗先找 root cause，不降低安全檢查。

## 每個 slice 回報格式

1. Slice/H phase。
2. 修改檔案。
3. 行為改變。
4. 安全邊界影響。
5. 新增 tests。
6. 實際執行的 commands 與結果。
7. 未執行的 manual/external gates。
8. 下一個 slice。

## 最終回報格式

1. H1 至 H7 各自狀態：complete、partial、blocked。
2. Capability 與 command exact sets。
3. Runtime lifecycle/watchdog 行為。
4. HTTP policy parity 與 endpoint list。
5. macOS/Windows data-store 行為。
6. CI、build、codesign、installer 結果。
7. Manual EA tests 的真實結果。
8. External signing/update blockers。
9. 產物絕對路徑與 SHA-256。
10. Residual risks 與 rollback。

不要只回覆「完成」。沒有實際執行或沒有外部條件的項目，必須明確標記為未驗證或 blocked。
