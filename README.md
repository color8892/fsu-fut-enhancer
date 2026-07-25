# FSU · EA FC FUT Web Enhancer

[![Version](https://img.shields.io/badge/version-26.9.0-blue)](extension/manifest.json)
[![Tests](https://github.com/color8892/fsu-fut-enhancer/actions/workflows/test.yml/badge.svg)](https://github.com/color8892/fsu-fut-enhancer/actions/workflows/test.yml)
[![Release](https://img.shields.io/github/v/release/color8892/fsu-fut-enhancer?label=release)](https://github.com/color8892/fsu-fut-enhancer/releases/latest)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

FSU 是針對 **EA Sports FC Ultimate Team Web App** 的非官方 Chrome 擴充功能。它在既有 FUT 介面中加入 SBC 輔助、球員與價格資訊、進化提示、目標摘要和操作捷徑。

> 本專案與 Electronic Arts 或 EA Sports 無關。使用前請閱讀[風險與限制](#風險與限制)。

## 功能

| 範圍 | 主要功能 |
|------|----------|
| SBC | 快速填充、需求解析、陣容評分、重複球員處理、挑戰捷徑 |
| 市場與價格 | 第三方價格查詢、拍賣輔助、概念球員搜尋、陣容價值 |
| 球員 | 卡面補充資訊、Meta / GGR、加速類型、鎖定管理 |
| 商店 | 模擬開包、機率預覽、My Packs 數量提示、可取消的限速批次開包 |
| 進化 | 新進化提示、屬性預覽、詳情差異標示 |
| 首頁與目標 | 新任務、獎勵與 SBC 摘要 |
| 設定 | 在 FUT 內調整顯示和操作行為 |

功能依賴 EA 的內部 Web App 類別及第三方資料來源；EA 更新後，個別功能可能暫時失效。

## 安裝

### 從 Release 安裝

1. 前往 [Releases](https://github.com/color8892/fsu-fut-enhancer/releases/latest)，下載 `fsu-fut-enhancer-<版本>.zip`。
2. 解壓到固定資料夾。更新版本時不要直接載入 zip。
3. 在 Chrome 開啟 `chrome://extensions`，啟用「開發人員模式」。
4. 選擇「載入未封裝項目」，指向包含 `manifest.json` 的解壓資料夾。
5. 開啟或重新整理 FUT Web App。

更新擴充功能後，已開啟的 FUT 分頁必須按 **F5**。舊分頁仍持有失效的 extension context，無法只靠重新載入擴充功能恢復。

### 從原始碼建置

需要 Node.js 22 和 npm：

```bash
git clone https://github.com/color8892/fsu-fut-enhancer.git
cd fsu-fut-enhancer/extension
npm ci
npx playwright install chromium
npm run test:ci
```

完成後，在 `chrome://extensions` 載入 `extension/`。

### FSU Companion（桌面程式）

`companion/` 是 Tauri 2 跨平台控制面板（macOS `.app`、Windows `.exe`/`.msi`）。

- **預設**：Extension fallback（系統瀏覽器 + MV3 擴充）
- **可選**：Settings 開啟 **Embedded Mode** 後，在 App 內 WebView 開啟 FUT 並注入本機打包的 FSU runtime（不需安裝 Extension）
- **未實作**：Native Messaging、正式程式碼簽章/公證

架構見 [COMPANION_ARCHITECTURE.md](COMPANION_ARCHITECTURE.md)、[EMBEDDED_APP_PLAN.md](EMBEDDED_APP_PLAN.md)。

```bash
cd companion
npm install
npm run package:runtime   # 從 extension 複製 lodash + userscript
npm test
npm run tauri build
```

## 開發

主要原始碼位於 `extension/src/fsu/`。`extension/src/userscript.js` 是 esbuild 產物，不應手動修改。

```bash
cd extension
npm run lint          # ESLint
npm run typecheck     # 漸進式 TypeScript checkJs
npm run test:all      # build + typecheck + tests
npm run test:browser  # MV3 handshake/lifecycle/security/reload smoke
npm run test:ci       # 完整 CI gate
npm run package       # 產生 dist release zip
```

EA 更新後，可用本機保存的 `compiled_*.js` 執行：

```bash
npm run check:ea-bundle -- --bundles <EA bundle 目錄>
```

請勿提交 HAR、Cookie、`X-UT-SID`、EA bundle 快照或其他工作階段資料。

## 文件

- [extension/README.md](extension/README.md)：extension 檔案與本機開發流程
- [ARCHITECTURE.md](ARCHITECTURE.md)：目前執行架構、依賴與 patch 順序
- [MIGRATION_INVENTORY.md](MIGRATION_INVENTORY.md)：domain、patch 與 EA capability 現況盤點
- [ROADMAP.md](ROADMAP.md)：分階段重構計畫與完成條件
- [SECURITY.md](SECURITY.md)：安全邊界、資料處理與漏洞回報
- [AGENTS.md](AGENTS.md)：AI 與維護者的修改規則

## 瀏覽器與 Userscript

主要支援目標是 Chrome Manifest V3。Edge、Brave 等 Chromium 瀏覽器可能可用，但目前不列入正式測試矩陣。

`npm run build` 產生的是 extension 使用的 IIFE bundle，不含完整 Tampermonkey metadata，也不代表 Tampermonkey 流程經過測試。需要 userscript 版本時，仍須自行提供 Lodash 與對應的 `GM_*` 權限。

## 風險與限制

- 使用第三方工具可能不符合 EA 的服務條款，帳號風險由使用者承擔。
- 價格、SBC、Meta 和進化資料來自第三方 API，不保證即時或正確。
- 自動化市場操作可能觸發 EA 的速率限制或帳號限制。
- 本專案不應用於刷幣、商業轉售、未授權資料收集或規避平台限制。

## License

[MIT](LICENSE)
