# FSU Next Optimization Plan

> 建立日期：2026-07-18
> 適用基線：`main` commit `43186c0`
> 完成日期：2026-07-18（PR19–PR23 實作與測試）
> 目的：修正 review 中發現的 runtime cleanup、HTML boundary、patch ownership、
> remote schema 與 release gate 缺口。
> 原則：一次只完成一個 PR slice，不進行大爆炸式重構。

### 實作摘要（PR19–PR23）

| PR | 主要交付 |
|----|----------|
| 19 | `OperationScope`；SBC template / bulk buy / mass listing `try/finally` cleanup；`hideLoader` 不再直接改寫 market flags |
| 20 | `createTrustedMarkup` brand；`createElementWithConfig` 拒絕 HTML/event sinks；assignment sinks 改 text/DOM |
| 21 | `rewards.choice-set-render`、`item.plus-playstyles-normalize` 單一 descriptor owner；inventory enforcement test |
| 22 | `RemoteConfigResults` 解析全部 `api.fut.to` 端點；atomic commit；malformed 保留舊 state |
| 23 | `verify` / `verify:release`、package allowlist smoke、release EA fail-closed |

**注意（PR20）**：`v.__text.innerHTML == "*"` 是 EA control 的 read-only probe，不是 HTML sink。

### 驗收修正

- `OperationScope` 將 supersede cleanup 與 active-owner cleanup 分離；新 SBC
  operation 啟動時立即恢復舊 controller，但只有 active owner 能關閉 loader。
- `RemoteConfigResults` 保留並驗證 dynamic `change/url`、extra chemistry 欄位與
  Fast SBC group target，不再 shallow commit FG config。
- Popup 額外內容不再把普通字串自動升級為 trusted markup；browser smoke 覆蓋
  localization-like injection payload。
- `verify:release` 明確傳入 `--require`；tag workflow 從
  `EA_BUNDLES_ARCHIVE_URL` materialize 私有 artifact，缺少 artifact 時 fail closed。
- PR unit suite 會生成 sanitized symbol fixture，驗證目前 hook inventory 與 baseline
  一致；完整 EA method body drift 仍只在 release/local bundle gate 執行。

## 0. 執行契約

開始修改前必須閱讀：

1. `AGENTS.md`
2. `ARCHITECTURE.md`
3. `MIGRATION_INVENTORY.md`
4. `ROADMAP.md`
5. 本文件

共同規則：

- 保留 `PatchInstaller` 的 phase 順序與既有 EA call chain。
- 不手改 `extension/src/userscript.js`；只可由 `npm run build` 產生。
- 不放寬 background request policy、manifest host permission 或 sender policy。
- 不記錄或提交 Cookie、session ID、`X-UT-SID`、HAR 或帳號資料。
- Page runtime、EA response、remote JSON 與 localization output 一律視為不可信。
- 新增純 `core/`、`domain/`、`infra/` 模組時提供 JSDoc contract，並評估加入
  `extension/tsconfig.json` strict island。
- 每個 PR 先補 characterization/failure test，再修改 production behavior。
- 不順手整理無關格式、命名或 legacy code。
- 每個 PR 都必須通過：

```bash
cd extension
npm run lint
npm run typecheck
npm run test:all
npm run test:browser
npm run package
```

若修改 EA patch target，另執行：

```bash
npm run check:ea-bundle -- --bundles <local-ea-bundle-directory>
```

若沒有本機 EA bundles，必須明確記錄為未執行，不得描述成通過。

---

## PR19：Operation Cleanup and Cancellation

**狀態：完成**

### 目標

確保 SBC template、批次購買與大量上架在 success、early return、throw、cancel、
capability unavailable 等所有路徑都能恢復：

- loader
- controller/button interaction
- operation token
- shared run state

### 主要檔案

- `extension/src/fsu/domain/SbcTemplateService.js`
- `extension/src/fsu/domain/MarketActionService.js`
- `extension/src/fsu/core/BootstrapEvents.js`
- `extension/src/fsu/core/CancellableOperation.js`
- `extension/tests/sbc-fill-safety.test.mjs`
- `extension/tests/market-action-service.test.mjs`

### 實作工作

1. 為 UI-bound async operation 建立小型 cleanup primitive。
   - 建議名稱：`OperationScope` 或 `BatchOperationScope`。
   - 不應知道 EA globals。
   - API 至少支援 `start()`、`cancel()`、`isActive()`、`finish()`。
   - cleanup callback 必須只執行一次。

2. 修正 `SbcTemplateService.loadTemplate()`。
   - 將 `controller.setInteractionState(0)`、`showLoader()` 與 cleanup 綁在同一 scope。
   - `finally` 必須恢復 controller interaction。
   - `finally` 必須在該 operation 仍擁有 loader 時關閉 loader。
   - 新 operation 取代舊 operation 時，舊 operation 不得關閉新 operation 的 loader。
   - 空 plan、取消、virtual challenge unavailable、save failure、throw 都要回傳具名 result。
   - 不再以裸 `return` 表示失敗。

3. 修正 `MarketActionService.buyConceptPlayer()`。
   - capability check 不得留下 `bulkbuy=true`。
   - 不再依賴 `hideLoader()` 暗中改寫 `info.run.bulkbuy`。
   - cancel 時應 `break`，不應繼續掃描剩餘 array。
   - 所有 await 與 UI cleanup 放入 `try/finally`。
   - 回傳 batch summary：requested、attempted、purchased、moved、failed、cancelled。

4. 修正 `MarketActionService.losAuctionSell()`。
   - interaction state、loader、`losauction` 必須由 `finally` 恢復。
   - 單筆失敗需產生逐項 result；決定 continue 或 fail-fast，並用測試固定。
   - refresh/reset failure 不得讓 UI 維持 disabled。

5. 收斂 `BootstrapEvents.hideLoader()`。
   - loader helper 不再負責改寫 market operation flags。
   - 保留使用者按關閉按鈕取消 active operation 的能力，但透過明確 cancel facade。

### 必要測試

- SBC template：empty plan cleanup。
- SBC template：cancel during first fetch。
- SBC template：virtual challenge unavailable。
- SBC template：save returns failure。
- SBC template：helper throws。
- SBC template：舊 operation cleanup 不影響新 operation。
- Bulk buy：capacity unavailable。
- Bulk buy：capacity reached。
- Bulk buy：cancel after first item。
- Bulk buy：purchase helper throws。
- Mass listing：single item failure。
- Mass listing：reset failure。
- 所有案例都 assert loader、interaction、flag 與 result。

### 完成條件

- 不存在需要靠 `hideLoader()` side effect 才能重設的 market flag。
- 所有 operation failure 都有 structured result。
- 所有 cleanup tests 通過。
- 不改變成功路徑的使用者通知語意。

---

## PR20：DOM Trust Boundary

**狀態：完成**

### 目標

讓任意 remote、EA 或 localization value 無法透過通用 UI helper 進入 HTML parser。

### 主要檔案

- `extension/src/fsu/ui/UiFactory.js`
- `extension/src/fsu/ui/HtmlSafety.js`
- `extension/src/fsu/patches/app-init.js`
- `extension/src/fsu/patches/store.js`
- `extension/src/fsu/patches/player-item.js`
- `extension/src/fsu/domain/AcademyCalcService.js`
- `extension/tests/html-safety.test.mjs`

### 實作工作

1. 禁止 `createElementWithConfig()` 接受以下 key：
   - `innerHTML`
   - `outerHTML`
   - `srcdoc`
   - `on*` event properties

2. 收緊 attributes。
   - 禁止 `on*` attributes。
   - URL attributes 必須使用專用 URL normalizer。
   - class、style、data/aria attributes 保留既有能力。

3. 建立 extension-owned markup contract。
   - 建議 `createTrustedMarkup()` 回傳不可偽造的 branded object。
   - `setTrustedHtml()` 只接受 branded markup，不再接受任意 string。
   - brand constructor 不可暴露到 `unsafeWindow`。

4. 遷移現有 call sites。
   - Loading text：使用 text nodes 與 `<br>` node。
   - Store expiry：icon element + text element。
   - Player body type：text nodes + extension-owned span。
   - Player duplicate/position/status：分段建立 DOM。
   - Popup message 預設 text mode；只有 extension template 明確使用 markup mode。

5. 搜尋並分類全部 HTML sinks：

```bash
rg -n 'innerHTML|outerHTML|insertAdjacentHTML|setTrustedHtml|createContextualFragment' \
  extension/src/fsu --glob '!userscript.js'
```

每一個 sink 都必須被分類為：

- removed
- text-only
- extension-owned trusted markup

### 必要測試

- `createElementWithConfig({ innerHTML: ... })` 被拒絕。
- `onclick`、`onerror` 與 event attributes 被拒絕。
- remote string `<img onerror=...>` 只能顯示為文字。
- localization string 含 `<`、`>` 時不產生 element。
- trusted extension markup 仍能建立必要 icon/span。
- external link protocol 與 `noopener noreferrer` 測試維持通過。

### 完成條件

- 通用 factory 不再存在任意 HTML assignment。
- `setTrustedHtml` 不接受普通 string。
- 未驗證資料只使用 `textContent`/text nodes。
- Browser smoke 增加一條 injection rejection assertion。

---

## PR21：Single Patch Owner and Composition

**狀態：完成**

### 目標

每個 EA prototype member 只有一個 production owner，避免 phase 後段覆蓋前段功能。

### 第一批 target

1. `UTRewardSelectionChoiceView.prototype.expandRewardSet`
2. `UTItemEntity.prototype.getPlusPlayStyles`

### 主要檔案

- `extension/src/fsu/patches/panel-patches.js`
- `extension/src/fsu/patches/rewards.js`
- `extension/src/fsu/patches/club-select-events.js`
- `extension/src/fsu/patches/ui-utils.js`
- `extension/src/fsu/core/PatchInstaller.js`
- `extension/src/fsu/core/CallMaps.js`
- `extension/src/fsu/core/PatchLifecycleRegistry.js`

### 實作工作

1. 為每個 target 建立唯一 descriptor ID。
   - 建議：
     - `rewards.choice-set-render`
     - `item.plus-playstyles-normalize`

2. Reward wrapper 必須：
   - 只呼叫 EA original 一次。
   - 依序執行 reward value augmentation 與 Futbin button augmentation。
   - 一個 augmentation 失敗不得阻止另一個。
   - 保留 EA original return value。
   - duplicate install 必須 idempotent。
   - disable/restore 必須恢復精確 descriptor。

3. Play-style wrapper 必須：
   - 只安裝一次。
   - 保留原方法 return contract。
   - 非 array 或 malformed entry 時 fail closed，不破壞 EA render。
   - Club 與一般 UI 共用同一 normalized result。

4. 加入 inventory enforcement test。
   - 掃描 production source。
   - 同一 `Class.prototype.method` 不可有多個 assignment owner。
   - extension-owned Store controller methods可列 allowlist。
   - descriptor generic helper不得被誤判為直接 assignment。

5. 更新 `MIGRATION_INVENTORY.md` 的 descriptor 數量與 direct EA assignment 數量。

### 必要測試

- Reward EA original 恰好呼叫一次。
- Reward value 與 Futbin button 同時存在。
- 任一 augmentation throw 時另一個仍執行。
- Reward disable/reinstall/exact restore。
- Play-style original 恰好呼叫一次。
- malformed array/result isolation。
- Duplicate owner inventory test。

### 完成條件

- 上述兩個 target 各只有一個 production owner。
- 不再依賴 phase 覆寫順序組成功能。
- Descriptor 與 inventory 文件同步。

---

## PR22：Remote Configuration Schemas

**狀態：完成**

### 目標

所有 `api.fut.to` JSON 必須先完整驗證與 normalize，再 atomic commit 到 `info`。

### Endpoint 範圍

- `updata.json`
- `fast.json`
- `pack.json`
- `sbc.json`
- `inpacks.json`
- `other.json`
- `fgconfig.json`
- `lowprice.json`

已存在 schema 的 `meta`、`ggrating`、`evolutions`、`playermeta` 必須保留。

### 主要檔案

- `extension/src/fsu/domain/RemoteConfigService.js`
- 新增 `extension/src/fsu/domain/RemoteConfigResults.js`
- `extension/src/fsu/infra/RatingPrices.js`
- `extension/tests/remote-config-service.test.mjs`
- 新增 `extension/tests/remote-config-results.test.mjs`
- `extension/tsconfig.json`

### 實作工作

1. 每個 endpoint 提供 parser：
   - input 為 `unknown`
   - success 回傳 frozen/normalized data
   - failure 回傳 `{ success: false, error: { code, provider, issues } }`
   - error 不包含原始 response body

2. 數值限制：
   - ID 必須為正整數。
   - timestamp、price、rating、count 必須有限且有合理上下限。
   - array/object size 設定上限，避免極大 response 導致 UI/CPU 問題。

3. Record 安全：
   - 只接受符合預期格式的 keys。
   - 使用 `Object.create(null)` 或 `Map` 建立 normalized lookup。
   - 拒絕 `__proto__`、`prototype`、`constructor`。

4. Atomic commit：
   - parser 完整成功前，不修改任何 `info` path。
   - malformed refresh 保留上一份已知良好資料。
   - endpoint 彼此失敗隔離。

5. `updata.json`：
   - `version`、`updateURL`、`api` keys 驗證。
   - `updateURL` 限定 HTTPS。
   - `api` 只接受已知 endpoint token，並限制長度/字元。

6. 將純 parser 納入 strict island。

### 必要測試

- 每個 endpoint success fixture。
- 非 object/array。
- 缺欄位、錯型別、NaN/Infinity、負數、過大 array。
- prototype pollution keys。
- malformed refresh 保留舊 state。
- 一個 endpoint failure 不阻止其他 endpoint。
- diagnostics 不含 response body、URL query token 或帳號資料。

### 完成條件

- `RemoteConfigService` 不直接 commit 未經 parser 的 remote object。
- 所有 endpoint 都有 malformed fixture。
- Parser 納入 `tsconfig.json` 並通過 strict checkJs。

---

## PR23：Release and Compatibility Gates

**狀態：完成**

### 目標

讓 EA drift、package contents 與 release artifact integrity 成為真正 blocking gate。

### 主要檔案

- `.github/workflows/test.yml`
- `.github/workflows/release.yml`
- `extension/scripts/ea-bundle-check.mjs`
- `extension/scripts/package-extension.cjs`
- 新增 package smoke script/test
- `extension/package.json`
- `ARCHITECTURE.md`
- `MIGRATION_INVENTORY.md`
- `ROADMAP.md`

### 實作工作

1. 將 EA compatibility 分成兩層。
   - PR CI：使用 sanitized、可提交的小型 symbol fixture，驗證 checker 與所有 tracked
     hook inventory。
   - Release/manual CI：使用受控 artifact 或 repository secret 指向的 bundle source，
     執行完整 `check:ea-bundle`。

2. Release fail closed。
   - 宣告需要完整 EA bundle gate 時，artifact 不存在必須 fail。
   - 不可在 release job 靜默 skip。
   - workflow artifact 不可包含 EA 帳號資料、Cookie、session、HAR。

3. Package smoke。
   - ZIP 只允許：
     - `manifest.json`
     - `vendor/lodash.min.js`
     - `src/background.js`
     - `src/content-bridge.js`
     - `src/page-runtime.js`
     - `src/userscript.js`
   - 驗證 archive 可解壓。
   - 驗證 manifest version 與 ZIP filename 一致。
   - 驗證 userscript 含必要 boot marker。
   - 驗證沒有 sourcemap、test fixture、node_modules、dist nesting 或敏感 artifact。

4. CI scripts 收斂。
   - 新增 `npm run verify`：lint + build drift + typecheck + unit。
   - 新增 `npm run verify:release`：verify + browser + EA gate + package smoke。
   - 保持本機與 GitHub workflow 命令一致。

5. 文件校正。
   - strict island 數字由 `tsconfig.json` 自動或可重現命令取得。
   - descriptor/direct assignment 數字由 inventory script 取得。
   - 不手寫無法重現的進度數字。

### 必要測試

- package allowlist success。
- ZIP 多一個檔案時 failure。
- version mismatch failure。
- corrupt ZIP failure。
- missing EA release artifact failure。
- sanitized fixture missing class/method failure。

### 完成條件

- Release 不會在 EA compatibility 未驗證時成功。
- Release artifact contents 有 allowlist test。
- GitHub workflow 與文件使用同一組 verification commands。

---

## 後續 Lifecycle 遷移順序

PR19 至 PR23 完成後，才繼續遷移剩餘 direct EA assignments。優先順序依 blast radius：

1. Shared lifecycle：
   - `EAViewController.dealloc`
   - `EATargetActionView.dealloc`
   - `UTPlayerItemView.dealloc`
   - `EAViewController.viewDidAppear`

2. Shared data/render：
   - `EALocalizationService.localize`
   - `UTPaginatedItemListView.renderItems`
   - `UTClubRepository.removeClubItem`

3. Market/search family。
4. Club/list family。
5. Objectives/academy family。
6. 剩餘 SBC UI family。

每個 family 都要符合：

- single owner
- descriptor ID
- verify original/capability
- exact restore
- independent feature toggle
- original-first 或 pre-intercept 順序有 characterization test
- failure isolation
- browser representative fixture

---

## 給其他 AI 的 Master Prompt

以下內容可直接貼給執行者：

```text
你正在維護 FSU FUT Enhancer，workspace 是專案根目錄。

任務：依照 NEXT_OPTIMIZATION_PLAN.md，按 PR19 → PR23 的順序完成下一階段優化。
一次只處理一個 PR slice。完成當前 slice 的 implementation、tests、build、文件與驗證後，
才可以進入下一個 slice。不要一次重構所有 patch，也不要擴大到計畫外功能。

開始前先閱讀：
1. AGENTS.md
2. ARCHITECTURE.md
3. MIGRATION_INVENTORY.md
4. ROADMAP.md
5. NEXT_OPTIMIZATION_PLAN.md

執行要求：
- 先 review 當前 slice 的 production code 與既有 tests，確認計畫中的行號可能因修改而漂移。
- 使用現有架構與 helper，避免建立平行 framework。
- 保留 PatchInstaller phase 與 EA original call order。
- 不手改 extension/src/userscript.js；只用 npm run build 產生。
- 不放寬 manifest、background request allowlist、sender policy、headers 或 credentials。
- 不輸出或提交 Cookie、session ID、X-UT-SID、HAR、帳號資料或 raw remote response。
- 所有 EA/page/remote/localization 值視為不可信。
- Structured result 優先；不要用 broad catch 後假裝成功。
- 不使用廣泛 any、@ts-ignore 或 @ts-nocheck。
- 不改無關檔案，不回復使用者既有變更。

每個 slice 的工作流程：
1. 建立或更新精確的執行 checklist。
2. 先加入會在舊行為下失敗的 characterization/failure tests。
3. 做最小 production 修改。
4. 執行 targeted tests。
5. 執行完整 gates：
   cd extension
   npm run lint
   npm run typecheck
   npm run test:all
   npm run test:browser
   npm run package
6. 檢查生成 userscript 與 package contents。
7. 更新 ARCHITECTURE.md、MIGRATION_INVENTORY.md、ROADMAP.md 和
   NEXT_OPTIMIZATION_PLAN.md 的該 slice 狀態。
8. 回報修改檔案、行為差異、測試結果、未執行項目與剩餘風險。

EA patch 有變動時另執行：
npm run check:ea-bundle -- --bundles <local bundle dir>

如果沒有 bundles，明確回報「未執行：缺少本機 EA bundles」，不可寫成通過。

PR19 特別要求：
- SBC template 的每個 early return/throw/cancel 都恢復 loader 與 interaction。
- Bulk buy/mass listing 用 try/finally 擁有 cleanup，不再依賴 hideLoader side effect。
- tests 必須 assert cleanup state。

PR20 特別要求：
- createElementWithConfig 禁止任意 innerHTML/event sink。
- setTrustedHtml 只接受 extension-owned branded markup。
- remote/EA/localization 值只能走 text nodes。

PR21 特別要求：
- reward expandRewardSet 與 item getPlusPlayStyles 各只有一個 owner。
- 原 EA method 只呼叫一次，各 enhancement 失敗隔離，支援 exact restore。

PR22 特別要求：
- 所有 api.fut.to endpoint 使用 unknown → validated result → atomic commit。
- malformed refresh 保留舊資料，拒絕 prototype pollution keys。

PR23 特別要求：
- release 缺 EA compatibility artifact 時 fail closed。
- ZIP contents 使用 allowlist 並測試 integrity/version/sensitive artifact。

不要只提供建議或 pseudo-code。除非遇到無法由 repository 判斷的高風險決策，
否則直接完成 implementation 和 verification。若某個 gate 失敗，先定位並修正，
不要跳過或降低 gate。
```
