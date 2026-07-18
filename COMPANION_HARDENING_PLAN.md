# FSU Companion Hardening and Release Plan

> 建立日期：2026-07-18
> 適用基線：目前 workspace 的 FSU Companion `0.1.0` Embedded opt-in beta
> 目的：將已可建置、可啟動的 Embedded App，推進到可驗證、可回復、可簽章發行的 macOS/Windows beta。
> 執行方式：依 H1 至 H8 順序完成小型 PR slice；不得把外部或人工 gate 描述為已通過。

## 0. 目前基線

開始工作前，AI 必須以程式與測試再次確認以下事實，不可只相信本文件：

- Companion 位於 `companion/`，共用協定位於 `shared/protocol/`。
- Native Messaging 尚未實作；Extension status 顯示 offline 是正確現況。
- Embedded Mode 預設關閉，使用獨立 `fut` WebViewWindow。
- `main` capability 為：
  - `core:default`
  - `allow-main-commands`
- `fut` remote capability 只能取得：
  - `allow-embedded-http-request`
- `fut` 不得取得 `core:default`、opener、filesystem、shell、process 或 generic proxy。
- Embedded runtime 依序使用 marker、host、toolbar、packaged lodash、generated userscript。
- Runtime 只有在 token handshake 成功後才能標記 `runtimeInstalled=true`。
- `GM_addStyle` 已存在；`GM_xmlhttpRequest` 優先走 Rust allowlisted GET bridge。
- macOS 目前使用 non-persistent WKWebView store；完全退出後需要重新登入。
- Windows/Linux 使用獨立 profile directory。
- Extension source 仍以 `extension/src/fsu/` 為唯一業務邏輯來源。
- `extension/src/userscript.js` 只能由 Extension build 產生。
- macOS `.app` 目前可 ad-hoc build，但尚未完成 Developer ID notarization。

### 已知殘餘風險

1. 真實 EA 登入、2FA、redirect、popup 尚未完成 macOS/Windows 全矩陣驗證（H6 manual）。
2. ~~Runtime handshake 若沒有回報，可能長時間停在 `starting`。~~ → H1: 5s watchdog → `RUNTIME_HANDSHAKE_TIMEOUT`。
3. ~~Rust 與 Extension 的 endpoint policy 分別維護，存在 drift 風險。~~ → H3: `shared/request-policy-corpus.json`。
4. macOS 登入不持久；macOS 14+ custom data store feasibility **未通過**，維持 non-persistent fallback（H4）。
5. GitHub Actions 產生 unsigned release-shaped bundles；正式簽章 / notarization **blocked by secrets**（H7）。
6. `check_update_status` 仍是 `not_configured`。
7. Native Messaging、設定同步與 live Extension status 尚未實作（H8）。

### 實作進度（對照 H1–H7）

| Slice | 狀態 |
|-------|------|
| H1 | Done — generation/watchdog + transition table (Starting→Ready/Failed only; late events cannot overwrite terminal state) |
| H2 | Done — `scripts/check-acl-inventory.cjs` exact-set |
| H3 | Done — shared corpus + `productionEndpoints` drift inventory; timeout vs network codes; public GET bounded backoff; EA market no retry |
| H4 | Fallback — non-persistent macOS documented |
| H5 | Done — lifecycle-driven overview recovery |
| H6 | Partial — pure-function fixtures + macOS bundle verifier (exact version/codesign fail closed) + Windows install/uninstall smoke wired in CI (**awaiting a recorded green run**); **live WebView integration pending**; **EA platform matrix manual**; upgrade not CI-automated |
| H7 | Skeleton only — version `0.2.0-beta.1`, release notes, signed workflow **blocked by credentials** |
| H8 | Out of scope for this program |

## 1. 執行契約

### 必讀文件

1. `AGENTS.md`
2. `ARCHITECTURE.md`
3. `SECURITY.md`
4. `COMPANION_ARCHITECTURE.md`
5. `COMPANION_ROADMAP.md`
6. `docs/EMBEDDED_MANUAL_CHECKLIST.md`
7. 本文件

### 強制規則

- 不接觸、保存、輸出或提交 Cookie、EA session、`X-UT-SID`、authorization、HAR、帳號識別資料。
- 不為了測試登入而降低 navigation、TLS、CSP、capability 或 HTTP policy。
- 不新增任意 URL/method/header 的通用代理。
- 不把 main commands 授權給 `fut`。
- 不讓 auth/account page 注入 FSU globals、toolbar 或 userscript。
- 不執行 remote JavaScript。
- 不手改 generated userscript。
- 不進行無關 Extension 重構。
- 不在沒有 Windows、EA 帳號、Apple signing secrets 時宣稱對應 gate 通過。
- 每個 slice 先新增 failure/characterization test，再改 production behavior。
- 每個 slice 都要同步文件、tests 和實際狀態。

### 共同驗證

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

若修改 EA patch/runtime，且存在合法的本機 EA bundle：

```bash
cd extension
npm run check:ea-bundle -- --bundles <local-ea-bundle-directory>
```

若 bundle 不存在，回報必須寫「未執行」，不可寫「通過」。

---

## H1. Runtime Watchdog and Recovery

### 目標

讓 Embedded lifecycle 不會永久停在 `starting`，並避免舊 navigation、舊 timer 或舊 handshake 污染新頁面狀態。

### 主要檔案

- `companion/src-tauri/src/embedded/window.rs`
- `companion/src-tauri/src/embedded/status.rs`
- `companion/src-tauri/src/embedded/injection.rs`
- `companion/src/api.ts`
- `companion/src/render.ts`
- `companion/tests/`

### 實作工作

1. 建立 per-document runtime generation。
   - 每次 FUT top-level document load 都產生新的 generation/token。
   - status state 保存目前 generation，但 diagnostics 不輸出 token。
   - 舊 generation 的 ready/failed/timer callback 必須被忽略。

2. 加入 handshake deadline。
   - FUT page load finished 後開始 3 至 5 秒 deadline。
   - deadline 前收到目前 generation 的 ready，轉為 `ready`。
   - 收到 failed，轉為 `failed`。
   - deadline 到期仍未成功，轉為 `failed`，error code 使用穩定常數，例如 `RUNTIME_HANDSHAKE_TIMEOUT`。
   - 不把原始 exception、完整 URL 或頁面資料放入 diagnostics。

3. 定義 lifecycle transition table。

| Current | Event | Next |
|---------|-------|------|
| disabled | enable/show | starting |
| starting | auth page | login_required |
| login_required | FUT page | starting |
| starting | current ready | ready |
| starting | current failed/timeout | failed |
| ready | reload/navigation | starting |
| failed | reload | starting |
| any enabled | disable/reset | disabled |

4. 加入可操作 recovery。
   - Failed 畫面提供 Reload FUT 與 browser/Extension fallback。
   - Reload 必須重設 generation、error、runtime flag。
   - 不自動無限 reload。
   - 最多做一次受控自動 retry；預設建議完全由使用者觸發。

### 必要測試

- ready handshake 在 deadline 前成功。
- deadline timeout 轉為 failed。
- 舊 generation ready 不得覆蓋新 generation starting。
- 舊 timer 不得讓新 generation ready 變 failed。
- auth page 不啟動 runtime deadline。
- reload 清除舊 error。
- disable/reset 銷毀 window 並保持 disabled。
- diagnostics 只含 error code，不含 token、URL query 或 exception payload。

### Exit criteria

- Embedded lifecycle 不會無限停在 `starting`。
- `runtimeInstalled=true` 只能由目前 generation 的 ready 產生。
- 所有 transition 有單元測試。
- UI 對 failed 提供 Reload 與 fallback。

---

## H2. ACL and Command Inventory as Source of Truth

### 目標

避免再次出現 `Command get_diagnostics not allowed by ACL`，同時防止 main command 誤授權給 FUT remote page。

### 主要檔案

- `companion/src-tauri/src/lib.rs`
- `companion/src-tauri/permissions/main-commands.toml`
- `companion/src-tauri/permissions/embedded-http.toml`
- `companion/src-tauri/capabilities/default.json`
- `companion/src-tauri/capabilities/fut.json`
- `companion/src-tauri/src/embedded/capability_tests.rs`
- `companion/scripts/`

### 實作工作

1. 建立 command inventory checker。
   - 解析 `tauri::generate_handler!` 中的 app commands。
   - 比對 `main-commands.toml` 與 `embedded-http.toml`。
   - 未分類 command、重複 command、拼字錯誤都 fail。

2. 明確分類：
   - Main-only commands：settings、diagnostics、window lifecycle、update status。
   - FUT-only command：`embedded_http_request`。
   - FUT capability 不得包含 main permission。

3. CI 執行 inventory checker。
   - 建議加入 `npm run check:acl` 或 Rust test target。
   - 不只用 substring assertion；比較 exact set。

4. 增加 negative tests。
   - `fut` 無法呼叫 `get_diagnostics`、`get_settings`、`open_fut_web_app`。
   - `main` 不取得 `allow-embedded-http-request`。
   - capability remote URL 只包含 exact FUT host/path patterns。

### Exit criteria

- 新增 command 卻未更新 ACL 時，CI 必定失敗。
- Main/FUT command sets 無交集。
- Generated ACL manifest 與 capability snapshot 有測試。

---

## H3. HTTP Bridge Parity, Resilience, and Fixtures

### 目標

保持 Embedded 與 Extension request policy 一致，對 provider drift、timeout、429、5xx 和 oversized response 有穩定行為。

### 主要檔案

- `extension/src/background.js`
- `extension/src/fsu/infra/HttpClient.js`
- `companion/src-tauri/src/embedded/http_bridge.rs`
- `companion/resources/fsu/embedded-host.js`
- `shared/` 下新增的 policy fixture
- Companion/Extension request tests

### 實作工作

1. 建立跨語言 policy corpus。
   - JSON fixture 只放 sanitized URL、method、header names 與 expected allow/deny。
   - 不包含真實 session/header value。
   - Rust 與 Extension tests 讀取同一 corpus。

2. 覆蓋全部現有 endpoint：
   - `api.fut.to`
   - FUT.GG
   - FUTBIN
   - FUTNext enhancer API
   - EA transfer market

3. 驗證 policy parity：
   - GET-only。
   - credentials default omit。
   - redirect fail closed。
   - forbidden headers drop 或 reject 語意一致。
   - `X-UT-SID` 只允許 EA transfer-market endpoint，且永不 log。
   - 5 MB response limit。
   - timeout 有上下界。

4. 加入 failure classification。
   - timeout
   - DNS/network
   - redirect blocked
   - unauthorized endpoint
   - response too large
   - invalid UTF-8/JSON
   - provider 429/5xx

5. 有限韌性。
   - 只對 public config/price GET 做有限 retry。
   - exponential backoff 加小幅 jitter。
   - EA market action 不在 bridge 層自動重送。
   - cache 只保存公開價格/config，不保存 EA session response。

6. 可選 smoke test。
   - 由環境變數明確 opt-in。
   - 預設 CI 不依賴真實 provider。
   - 只測公開 endpoint，不測 EA 帳號/session。

### 必要測試

- Shared allow/deny corpus 在 Rust/JS 全部通過。
- unknown origin、path spoof、HTTP、redirect、POST、Cookie、Authorization 被拒絕。
- Page supplied User-Agent 被安全丟棄，不讓整個合法 request 失敗。
- response size 在 chunk boundary 正確阻擋。
- 429/5xx 不被誤報為 transport success。
- error/diagnostics 不含 URL query 或 header value。

### Exit criteria

- Companion 與 Extension policy corpus 無 drift。
- 沒有 generic proxy。
- 公開 endpoint failure 有穩定 error code。
- 敏感 header value 不進 logs、fixtures、diagnostics。

---

## H4. macOS Data Store Feasibility

### 目標

在不降低 macOS 11 至 13 安全性的前提下，評估並實作 macOS 14+ Embedded login persistence。

### Gate

先以最小 spike 驗證 Tauri/Wry 當前版本是否能：

1. 為 `fut` 指定固定 custom data-store identifier。
2. 僅清除該 identifier 的 website data。
3. 不影響 Safari、Chrome、Extension 或 Companion main WebView。
4. App upgrade 後維持同一 identifier。

Gate 失敗時：

- 保留目前 non-persistent store。
- 不使用 default WKWebsiteDataStore。
- 文件清楚說明每次退出需重新登入。
- 不繼續寫假持久化邏輯。

### 建議平台策略

| Platform | Strategy |
|----------|----------|
| macOS 14+ | Custom data-store identifier，gate 通過後才啟用 |
| macOS 11–13 | Non-persistent WKWebView |
| Windows | Isolated WebView2 profile directory |
| Linux | Isolated profile directory，若支援 |

### 必要測試

- identifier deterministic，但不含帳號或機器個資。
- clear 只清除 Embedded store。
- disable Embedded 不自動清除設定。
- clear 後 status/runtime reset。
- 舊 macOS fallback 明確且可測。

### Manual gate

- macOS 14+：登入、退出 App、重新開啟仍登入。
- Clear site data 後只登出 Companion。
- macOS 11–13：退出後 session 不持久，符合文件。

### Exit criteria

- 有 capability/API feasibility 證據。
- 未通過的平台維持安全 fallback。
- UI 文案與真實 persistence 行為一致。

---

## H5. Desktop UX and Operational Diagnostics

### 目標

讓使用者能從狀態直接判斷下一步，但不暴露帳號資料或建立教學式 landing page。

### 實作工作

1. 狀態顯示：
   - disabled
   - starting
   - login required
   - ready
   - failed

2. 每個狀態只提供相關操作：
   - disabled：Enable Embedded / Open browser fallback
   - login required：Show FUT
   - ready：Show、Reload、Hide
   - failed：Reload、Disable Embedded、Open browser fallback

3. Diagnostics：
   - runtime generation 不輸出 token。
   - provider failure 只輸出 provider 名稱與 error code。
   - blocked navigation 只輸出 host。
   - 不輸出 home path、env、full URL、headers、response body。

4. 設定語意：
   - `openFutOnLaunch` 只控制 browser fallback。
   - `openEmbeddedOnLaunch` 只在 Embedded Mode 開啟時生效。
   - Reset 後立即關閉 Embedded window。

5. 可及性與視窗：
   - 工具列按鈕有 accessible name。
   - 鍵盤 focus 不被 toolbar 截斷。
   - 960×600 最小視窗與高 DPI 不重疊。

### Exit criteria

- 狀態、按鈕和 lifecycle 一致。
- Error state 不會只顯示 spinner。
- Diagnostics redaction tests 通過。
- macOS/Windows 截圖只用無帳號 fixture，不使用真實 EA session。

---

## H6. Platform Integration and CI Gates

### 目標

把「可以編譯」提升為「macOS/Windows artifact 可安裝且核心流程有證據」。

### CI 工作

1. macOS：
   - release `.app` build。
   - `codesign --verify --deep --strict`。
   - bundle 內 binary、Info.plist、runtime resources 檢查。
   - packaged userscript hash 與 Extension build 一致。

2. Windows：
   - NSIS 或 MSI build。
   - installer artifact existence/size/hash。
   - clean install、upgrade、uninstall smoke script。
   - WebView2 prerequisite 文件。

3. 共通：
   - `cargo fmt --check`
   - `cargo clippy --all-targets -- -D warnings`
   - Companion tests
   - Extension lint/typecheck/tests/package
   - ACL inventory
   - runtime package freshness

4. Fixture coverage（現況）：
   - **Done (pure-function)**：`fixture_integration_tests.rs` 以 lifecycle/navigation 純函式驗證 deny、timeout、reload idempotence；**不**建立真實 WebView。
   - **Pending**：test-only WebView integration（獨立 capability、不把 localhost 加入 production `fut.json`）。
   - Windows CI：clean install + uninstall smoke 已接線（`windows-install-smoke.ps1`），但需有成功 workflow 紀錄才算通過；**upgrade 未在 CI 自動執行**（單 artifact），見 manual checklist。
   - macOS CI：`codesign --verify` 與 Info.plist 版本對專案 metadata 不一致時 **exit nonzero**。

### Manual matrix

| Case | macOS ARM | macOS Intel | Windows 11 |
|------|-----------|-------------|------------|
| Clean install | Required | CI or tester | Required |
| EA login/2FA | Required | Best effort | Required |
| FUT ready handshake | Required | Best effort | Required |
| Reload/idempotence | Required | Best effort | Required |
| Price/config request | Required | Best effort | Required |
| Clear site data | Required | Best effort | Required |
| Browser fallback | Required | Best effort | Required |
| Upgrade/uninstall | Required | Best effort | Required |

### Exit criteria

- CI artifact 可下載並驗證。
- macOS ARM 與 Windows 11 manual checklist 有日期、App version、結果。
- 不提交 screenshot、HAR 或帳號資訊。
- 未測平台清楚標記 unknown。

---

## H7. Signed Beta Release and Update Channel

### 目標

產生可供一般使用者安裝的 signed beta，而不是只有本機 ad-hoc `.app`。

### 實作工作

1. Versioning：
   - Companion 與 Extension 各自有版本。
   - Protocol version 保持獨立。
   - 建議下一個 Companion beta 為 `0.2.0-beta.1`。

2. macOS：
   - Developer ID Application signing。
   - Hardened Runtime。
   - notarization。
   - stapling。
   - DMG mount 後再次驗證內部 App。

3. Windows：
   - code-signed NSIS/MSI。
   - publisher identity 與 upgrade code 固定。
   - SmartScreen/reputation 風險寫入 release notes。

4. Update：
   - 只接受 signed manifest/artifact。
   - channel 至少區分 beta/stable。
   - downgrade/rollback policy。
   - update failure 不影響目前已安裝 App。

5. Supply chain：
   - dependency audit。
   - SBOM。
   - artifact SHA-256。
   - release provenance/attestation。

### External blockers

- Apple Developer ID、notarization credentials。
- Windows code-signing certificate。
- Release hosting/channel。

沒有 secrets 時，只能完成 workflow、dry-run 與文件，不可宣稱正式簽章成功。

### Exit criteria

- macOS artifact 通過 Gatekeeper/notarization。
- Windows installer 有有效簽章。
- Update manifest 有簽章驗證與 rollback。
- Release notes 清楚列出 Embedded beta 限制。

---

## H8. Native Messaging as a Separate Program

### 目標

在 Embedded beta 穩定後，再實作 Extension live connection；不得和 H1 至 H7 混成一次大型重構。

### 範圍

- Native host binary registration。
- Chrome/Edge host manifest。
- `shared/protocol` hello/status。
- Extension disconnected/connected state。
- allowlisted settings sync。

### 非目標

- 不共享 Cookie。
- 不傳輸 `X-UT-SID`。
- 不讓 Companion 代替 Extension 做任意 page request。
- Companion down 時不得破壞現有 Extension injection。

### Exit criteria

依 `COMPANION_ROADMAP.md` Phase 3 至 Phase 5 的 gates 執行；未通過前 UI 必須維持 Extension offline。

---

## 建議 PR 順序

| PR | Slice | 可獨立 rollback |
|----|-------|-----------------|
| 1 | H1 generation + watchdog + lifecycle tests | Yes |
| 2 | H2 ACL inventory exact-set checker | Yes |
| 3 | H3 shared request-policy corpus | Yes |
| 4 | H3 failure classification + bounded resilience | Yes |
| 5 | H4 macOS data-store feasibility behind platform gate | Yes |
| 6 | H5 status/recovery UX | Yes |
| 7 | H6 CI and fixture integration | Yes |
| 8 | H7 signed beta workflow/update skeleton | Yes |
| 9+ | H8 Native Messaging phases | Separate program |

## 最終完成定義

只有同時符合以下條件，才能把 Embedded beta hardening 標記為完成：

- H1 至 H6 全部 exit criteria 通過。
- macOS ARM 與 Windows 11 真實 manual checklist 已完成。
- Runtime、ACL、HTTP bridge、redaction tests 全綠。
- Extension 完整測試與 package 仍通過。
- Build 產物與 source/hash 一致。
- 未解決項目和外部 signing blockers 被明確列出。

H7 需要正式憑證才可標記 signed release 完成。H8 Native Messaging 是後續計畫，不是 Embedded beta hardening 的必要條件。
