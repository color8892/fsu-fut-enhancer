# FSU · EA FC FUT Web Enhancer

[![Version](https://img.shields.io/badge/version-26.9.0-blue)](extension/manifest.json)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

**FSU** 是 EA Sports FC Ultimate Team Web App 的瀏覽器增強工具，提供 SBC 輔助、市場價格、球員搜尋、進化提示、開包模擬等功能。

> 本專案與 EA Sports 無關，為非官方社群工具。

## 功能概覽

- **SBC**：快速填充、需求解析、陣容評分、重複球員處理、Hub 捷徑
- **市場 / 商店**：Futbin 價格、批量拍賣、概念球員購買、開包機率
- **球員**：卡面資訊、GGR / Meta、加速類型、鎖定管理
- **進化**：Hub 新任務提示、屬性預覽、詳情頁差異標示
- **目標 / 首頁**：新任務與獎勵摘要
- **設定**：內建設定頁，可自訂顯示與行為

## 安裝（Chrome 擴充功能）

1. 克隆本倉庫：

   ```bash
   git clone https://github.com/color8892/fsu-fut-enhancer.git
   cd fsu-fut-enhancer/extension
   ```

2. 安裝依賴並建置：

   ```bash
   npm install
   npm run build
   ```

3. 開啟 Chrome → `chrome://extensions`
4. 開啟「開發人員模式」
5. 點「載入未封裝項目」，選擇本專案中的 **`extension`** 資料夾

建置完成後會產生 `extension/src/userscript.js`，擴充功能執行時會載入此檔案。

## 開發

```bash
cd extension
npm install
npm run test:all    # 建置 + 執行測試
npm run build       # 僅建置 userscript
```

### 專案結構

```
extension/
├── manifest.json          # Chrome Extension MV3
├── src/
│   ├── fsu/
│   │   ├── index.js       # 入口
│   │   ├── legacy/        # futweb 接線層
│   │   ├── core/          # ModuleRegistry、AppContext
│   │   ├── domain/        # 業務服務（價格、SBC、市場…）
│   │   ├── patches/       # EA Web App prototype patches
│   │   ├── ui/            # 設定頁、UI 工廠
│   │   └── data/          # 在地化字串
│   ├── userscript.js      # esbuild 產出（需建置）
│   ├── content-bridge.js
│   └── background.js
├── scripts/               # 建置與重構腳本
└── tests/
```

架構採 **Strangler Fig**：保留 `events.*` facade，逐步將邏輯抽到 `domain/` 與 `patches/`，`legacy/futweb.js` 負責接線與 patch 順序。

## Tampermonkey

若你使用 Tampermonkey 而非 Chrome 擴充功能，可執行 `npm run build` 後，將產出的 `extension/src/userscript.js` 內容作為 userscript 使用（需自行加上 Tampermonkey metadata header）。

## 免責聲明

- 使用本工具可能違反 EA 服務條款，請自行承擔風險。
- 價格與 SBC 資料來自第三方 API，準確性不作保證。
- 僅供學習與個人使用，請勿用於商業轉售或自動化刷幣。

## License

MIT — 見 [LICENSE](LICENSE)（若尚未加入授權檔，預設以 MIT 發布）。