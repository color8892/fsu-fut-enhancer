# AGENTS.md — FSU FUT Enhancer

給 AI 代理的快速導覽。細節見 [ARCHITECTURE.md](./ARCHITECTURE.md)。

## 專案是什麼

Chrome MV3 擴充功能，在 EA FC Ultimate Team Web App 注入 FSU 增強腳本。  
**可編輯原始碼**：`extension/src/fsu/`（模組化 ES modules）  
**勿手改**：`extension/src/userscript.js`（`npm run build` 產物）

## 先讀這些檔案

| 目的 | 檔案 |
|------|------|
| 啟動編排 | `extension/src/fsu/legacy/futweb.js` |
| 依賴容器 | `extension/src/fsu/core/FsuContext.js` |
| Patch 安裝順序 | `extension/src/fsu/core/PatchInstaller.js` |
| 領域服務掛載 | `extension/src/fsu/core/ModuleRegistry.js` |
| 靜態 game 設定 | `extension/src/fsu/data/game-config.js` |
| 擴充注入 | `extension/src/content-bridge.js` |
| GM API shim | `extension/src/page-runtime.js` |
| 本地化 `fy` / `eafy` | `extension/src/fsu/domain/Localization.js` |
| 入口 | `extension/src/fsu/index.js` |

## 啟動順序（摘要）

```
content-bridge → lodash → page-runtime (GM_*) → userscript (FsuUserscriptApp)
  → futweb()
      → FsuContext
      → installAppInitPatches
      → registerEarlyModules
      → registerAppInitEvents + SettingsScreen
      → call/html 對照表
      → PatchInstaller.installAll()
      → registerLateModules
```

完整圖與 phase 清單見 [ARCHITECTURE.md § 啟動順序](./ARCHITECTURE.md#啟動順序)。

## 模組邊界

```
extension/src/fsu/
  core/       AppContext, FsuContext, PatchInstaller, ModuleRegistry, infra 抽象
  domain/     業務邏輯（PriceService, PackService, Sbc*Service…）
  patches/    EA prototype hook + register*Events（必須收 deps）
  legacy/     futweb() 編排（保持薄）
  ui/         UiFactory, SettingsScreen, fsu-styles
  data/       localization, game-config
  infra/      HttpClient, JsonStore
```

- **patches/**：只負責 hook EA 類別 prototype，透過 `deps` 呼叫 `events.*`
- **domain/**：不依賴 EA 全域，透過 helpers / deps 注入
- **events**：執行期 facade 物件，各模組把函式掛在上面（見 ARCHITECTURE events 索引）

## Deps 規則（必讀）

模組化後 **沒有 futweb 閉包**。每個 `install*Patches` / `register*Events` 必須：

1. 函式簽名接受 `deps` 物件（或 `FsuContext`）
2. 在 `PatchInstaller` 用 `ctx.pick("call", "events", "fy", …)` 顯式傳入
3. 新增依賴時：加入 `FsuContext` 建構欄位 + `pick()` 列表 + 必要時 `to*Deps()` 方法

常見踩坑見 [ARCHITECTURE.md § 踩坑](./ARCHITECTURE.md#模組化踩坑)。

## 開發指令

```bash
cd extension
npm run build        # 編譯 userscript.js
npm test             # 單元 + manifest 測試
npm run test:all     # build + test（改碼後必跑）
npm run lint
npm run check:ea-bundle   # 對照 futwebapp/js 檢查 EA bundle 是否仍相容
```

**EA 更新後**：從 FUT 頁 Network 重新存 `compiled_*.js` 到本機 `futwebapp/js/`（此目錄不進 git），再跑 `npm run check:ea-bundle`。報告中 `✗` = 類別/方法被 EA 改掉需修 patch；確認無誤後 `npm run check:ea-bundle -- --update-baseline` 更新 `extension/data/ea-bundle-baseline.json`。

**本機驗證三步**（缺一不可）：

1. `npm run build`
2. `chrome://extensions` → 重新載入 FSU
3. FUT 分頁 **F5**（否則會看到 extension invalidated 警告，FSU 不會恢復）

## 改碼檢查清單

- [ ] 新 patch 的 deps 是否完整（尤其 `call`, `fy`, `events`, `info`, `cntlr`）
- [ ] 是否只改 `src/fsu/`，並執行 `npm run build`
- [ ] `PatchInstaller` 安裝順序是否維持 legacy 順序（勿隨意調 phase）
- [ ] 需要 `fsuSC` 的 patch 是否在 `registerSettingsScreen` 之後的 phase
- [ ] `npm run test:all` 通過

## Debug

`extension/src/fsu/core/Debug.js`：`FSU_DEBUG = false` 預設。  
在 futweb 啟用後，`unsafeWindow` 會暴露 `events`, `call`, `info`, `cntlr`, `fy`。

## 與 EA 無關的錯誤

Console 中 `ea.com`、`Juno`、404、CSP inline script（在未用 content-bridge 時）通常 **不是 FSU bug**。

| 現象 | 原因 | 處理 |
|------|------|------|
| `xxx is not defined` | patch deps 漏傳 | 補 `FsuContext.pick()`，見 ARCHITECTURE 踩坑 §1 |
| `key.indexOf` on undefined | `fy(undefined)` | `Localization.js` 已防護；呼叫端仍應傳有效 key |
| `Extension was reloaded…` | 擴充重載後舊分頁未刷新 | **F5**；頁面頂部會顯示橘色橫幅 |