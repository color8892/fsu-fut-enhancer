# FSU Companion Embedded FUT Mode Plan

## 目標

讓使用者只開啟 `FSU Companion.app` 或 Windows 對應程式，就能在桌面 App
內使用 EA FC Ultimate Team Web App 與 FSU 增強功能，不必另外開啟 Chrome。

這不是重寫 FUT 客戶端，也不直接呼叫 EA 私有 API。EA 頁面、登入、Cookie 與
session 仍由系統 WebView 處理；FSU 只注入本機打包的增強 runtime。

現有 Chrome/Edge Extension 必須保留，作為相容模式與 Embedded Mode 的 fallback。

## 不可妥協的邊界

```text
Trusted local UI                   Untrusted remote content
main WebViewWindow                 fut WebViewWindow
Companion settings/diagnostics     EA FUT Web App + injected FSU runtime
limited Tauri invoke               no general Tauri capability
         |                                  |
         +------ explicit allowlisted ------+
                   embedded bridge
```

1. `main` 與 `fut` 必須使用不同 window label 與 capability。
2. `fut` 不得取得 filesystem、shell、process、generic opener、clipboard 或任意網路代理。
3. 注入程式只能來自 repository build 產物；禁止 CDN、遠端 JavaScript 與動態下載執行。
4. 不得讀取、記錄、傳輸或匯出 Cookie、session ID、`X-UT-SID`、authorization header、
   EA 帳號資料或完整 HAR。
5. 不繞過 TLS、憑證錯誤、CSP、登入驗證或 EA 安全機制。
6. 所有 remote page 送入 Rust 的資料都視為不可信，必須做 schema、大小與 allowlist 驗證。
7. 不手改 `extension/src/userscript.js`；共用 bundle 只能由既有 build pipeline 產生。
8. Embedded Mode 失敗時必須顯示明確錯誤並允許切回 Extension Mode，不可假裝已連線。

## 建議產品形態

- App 啟動時直接開 `fut` 視窗。
- `main` 視窗作為 Settings、Diagnostics、About 與 Embedded 狀態面板。
- tray/menu bar 提供：
  - Show FUT
  - Show Settings
  - Reload FUT
  - Clear Embedded Site Data（高風險操作，需二次確認）
  - Quit
- FUT 視窗提供克制的桌面工具列：Back、Forward、Reload、Home、Settings。
- 不把 EA 頁面 iframe 到本機頁面；使用獨立 remote `WebviewWindow`。

## Phase 0：可行性 Spike

### 實作

1. 新增 opt-in `embeddedMode` feature flag，預設關閉。
2. Rust 建立 label 為 `fut` 的 external URL WebViewWindow。
3. 使用固定 FUT URL，禁止前端傳入任意 URL。
4. 實作 navigation/new-window policy：
   - FUT 主頁只允許既定 EA FUT path。
   - 登入導向只允許逐項記錄並驗證過的 EA authentication origins。
   - 非 EA 外部連結顯示確認畫面，不直接導覽或交給 generic opener。
5. Windows 使用獨立 persistent profile；macOS 因 WKWebView 不支援 `data_directory`，使用 non-persistent store 並驗證關閉／清除後登出。
6. 注入最小本機 marker script，證明 document navigation 後可穩定執行。
7. 測試登入 popup、重新導向、登出、重啟 App、離線與憑證錯誤。

### Gate

- macOS 與 Windows 都能載入 FUT 並完成正常 EA 登入。
- 不需要讀取 Cookie 或模擬 EA API。
- marker script 在完整 navigation 後只安裝一次。
- `fut` window 無法呼叫 `main` 的 privileged commands。
- 若任一平台因 WebView/EA 政策無法穩定登入，停止後續遷移，保留 Companion + Extension。

## Phase 1：Embedded Host 與視窗生命週期

1. 新增 `companion/src-tauri/src/embedded/`：
   - `mod.rs`：組裝與公開介面
   - `window.rs`：建立、顯示、隱藏與恢復 FUT window
   - `navigation_policy.rs`：URL/origin/path allowlist
   - `injection.rs`：本機 script 組裝與安裝
   - `site_data.rs`：明確確認後清除 Embedded profile
2. App 啟動、tray、關閉視窗與單例行為都接入 Embedded window。
3. 記住 window size/position，但不保存 URL query、頁面內容或帳號資訊。
4. Crash/navigation failure 顯示本機 error view，提供 Retry 與 Extension fallback。
5. 加入 `EmbeddedStatus`：disabled、starting、login_required、ready、failed。

### Exit criteria

- 重複 Show/Hide/Reload 不會建立多個 FUT window。
- 關閉 FUT window 不會破壞 Companion settings。
- 導覽政策 fail closed，且有 URL policy 單元測試。

## Phase 2：共用 Runtime Adapter

1. 盤點 Extension 啟動依賴：
   - packaged lodash
   - storage snapshot
   - page runtime handshake
   - generated userscript bundle
2. 抽出小型 `FsuHostAdapter` 契約，不把 Tauri 判斷散落到 domain/patch 模組。
3. 保留現有 `content-bridge -> page-runtime -> userscript` 路徑。
4. 新增 Embedded adapter：
   - 依序安裝 lodash、host bootstrap、userscript。
   - 只使用 build-time bundled source。
   - 提供與 Extension 相同的最小 storage/runtime 能力。
   - 所有 install 都具備 idempotence、版本標記與失敗回復。
5. 若需要 Tauri command，建立獨立 `fut` capability，僅允許：
   - 讀取 allowlisted FSU/Embedded settings
   - 寫入 allowlisted settings patch
   - 回報不含 session 的 runtime health
6. 即使 EA 頁面直接呼叫這些 command，也不能造成 filesystem、process、任意 URL、
   任意 header/request 或秘密資料存取。

### Exit criteria

- Extension 與 Embedded 使用同一份可編輯 FSU source。
- 沒有複製第二份 userscript 或直接修改 generated bundle。
- FSU 啟動、reload、EA route change 與 App resume 都不重複 patch。
- Adapter contract、依賴順序與故障狀態有測試。

## Phase 3：設定與資料生命週期

1. 將設定分類：
   - Companion UI settings
   - Embedded host settings
   - FSU feature settings
   - 不允許保存的 EA/session material
2. 共用 `shared/protocol` schema；未知欄位、錯誤型別、超限內容全部拒絕。
3. Rust 與 TypeScript 使用 contract fixture 做 parity test。
4. 設定更新採 atomic replace，Windows/macOS 行為都測試。
5. 第一次啟動不偷偷匯入 Chrome profile、Cookie 或 extension storage。
6. 可選的 Extension 設定匯入只能透過明確、無秘密的 JSON export/import。
7. Clear Site Data 必須列出影響、二次確認，且不影響其他 App 資料。

## Phase 4：完整桌面體驗

1. App 預設直接顯示 FUT，不先顯示 marketing/landing page。
2. 加入載入、登入中、離線、導覽被阻擋、runtime 注入失敗與 EA 更新不相容狀態。
3. 工具列使用既有 icon library，固定尺寸，避免頁面重排。
4. Settings 顯示目前模式：Embedded / Extension fallback。
5. Diagnostics 只輸出：
   - Companion/FSU/protocol version
   - platform/arch
   - Embedded lifecycle state
   - 最近一次安全錯誤代碼
   - 已安裝 patch/module 的非敏感摘要
6. Diagnostics 不包含 URL query、頁面 HTML、Cookie、headers、home path 或 env dump。
7. 加入鍵盤快捷鍵與 tray 行為，但不可攔截 EA 文字輸入。

## Phase 5：測試策略

### 單元測試

- navigation allow/deny matrix
- auth origin allowlist
- unknown command/settings rejection
- payload size limits與 prototype pollution
- injection order/idempotence
- settings atomic replacement
- diagnostics redaction

### 整合測試

- 使用本機 fixture server 模擬 EA navigation，不使用真實帳號或 session。
- 驗證 remote page 無法呼叫 privileged Tauri commands。
- 驗證 reload/route change 後只安裝一份 runtime。
- 驗證 Embedded failure 能回到 Extension fallback。

### 手動驗收

- macOS Apple Silicon
- macOS Intel 或 universal artifact
- Windows 11 x64
- clean profile login
- MFA/login popup
- App restart retains normal WebView login
- logout and clear site data
- offline/reconnect
- EA FUT route navigation
- tray hide/restore

任何 fixture、log、截圖都不得包含真實帳號或 session。

## Phase 6：CI、發行與回滾

1. GitHub Actions matrix 執行 macOS/Windows lint、tests、build。
2. macOS 建立 `.app/.dmg`；Windows 建立 NSIS/MSI。
3. 公開 macOS 發行前加入 Developer ID signing 與 notarization。
4. Windows 公開發行前加入 code signing。
5. Embedded Mode 先以 opt-in beta 發行，保留 Extension Mode。
6. 收集的 diagnostics 必須由使用者主動 export，不加入遙測。
7. rollback 只需關閉 Embedded feature flag，不更改 Extension 權限與既有功能。

## Definition of Done

- 使用者只開 FSU Companion 即可登入並使用 FUT + FSU。
- 不啟動外部瀏覽器，不要求安裝 Extension 才能使用 Embedded Mode。
- Extension Mode 仍可獨立運作且原測試全綠。
- remote FUT window 無 privileged capability。
- 無 Cookie/session/API credential 讀取、儲存、log 或 export。
- macOS/Windows 的自動測試與打包通過。
- 文件清楚區分 Embedded、Extension 與尚未完成的功能。
- `npm run lint`、`npm run typecheck`、Companion tests、Rust tests、
  Extension `npm run test:all` 與 package 全部通過。
