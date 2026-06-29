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

## FSU Desktop（獨立 SBC 規劃工具）

Rust + Tauri 桌面程式，與擴充功能共用 `crates/fsu-core` 邏輯，可在**不開瀏覽器**的情況下做評分 / 化學規劃與 club 庫存對照。

### 本機執行

```powershell
# 從 repo 根目錄
.\scripts\dev-desktop.ps1
```

首次需安裝 [Rust](https://rustup.rs/) 與 Tauri 依賴（Windows 通常只需 Rust + WebView2）。

### 建置執行檔

```powershell
.\scripts\build-desktop.ps1
# 產物：apps\fsu-desktop\src-tauri\target\release\fsu-desktop.exe
```

### 取得 X-UT-SID（club 同步用）

1. 開啟 [FUT Web App](https://www.ea.com/ea-sports-fc/ultimate-team/web-app/)
2. DevTools（F12）→ **Network**
3. 點任一 `utas.mob...` 請求
4. 複製 Request Header 的 **`X-UT-SID`** 貼到 Desktop 的 planner 欄位

> **安全提醒**：SID 等同登入憑證，勿分享或貼到公開場合。過期後重新從 DevTools 複製即可。

多 persona 帳號可在 **Persona ID** 欄位填寫（與下方 Advanced tools 的 probe 區同步）。

### 典型流程

1. **Sync club data**（需 SID，一次即可）
2. 之後可用 **Plan with club** 離線規劃（快取未過期時不必再貼 SID）
3. Chemistry 區：填 11 行 `nation,league,club` → **Plan chemistry**

### 鍵盤快捷鍵

| 快捷鍵 | 動作 |
|--------|------|
| `Ctrl+Enter` | Plan（offline） |
| `Ctrl+Shift+Enter` | Plan with club |
| `Ctrl+Alt+Enter` | Sync & plan |
| 在 chemistry 文字框內 `Ctrl+Enter` | Plan chemistry |

### GitHub Release

推送 tag 會觸發 CI 建置 Linux / Windows 二進位：

```bash
git tag desktop-v0.1.0
git push origin desktop-v0.1.0
```

Release 產物見 [Actions → desktop-release](https://github.com/color8892/fsu-fut-enhancer/actions) 或對應 GitHub Release 頁面。

## 開發

```bash
cd extension
npm install
npm run test:all    # 建置 + 執行測試
npm run build       # 僅建置 userscript
```

```powershell
# Repo 根目錄 — Rust 全 workspace 測試（Windows 請用腳本，避免 PowerShell stderr 誤判）
.\scripts\test-rust.ps1
.\scripts\test-all.ps1   # extension + Rust
```

### 專案結構

```
extension/                 # Chrome MV3（瀏覽器內增強）
crates/
  fsu-core/                # SBC 評分、化學、價格（Rust 核心）
  fsu-wasm/                # WASM 匯出給 extension
  ea-client/               # UTAS 唯讀 client
apps/fsu-desktop/          # Tauri 桌面 UI
scripts/                   # test-rust.ps1、dev-desktop.ps1 等
```

Extension 架構採 **Strangler Fig**：保留 `events.*` facade，邏輯在 `domain/` 與 `patches/`，`legacy/futweb.js` 負責接線。細節見 [ARCHITECTURE.md](./ARCHITECTURE.md)、[AGENTS.md](./AGENTS.md)。

## Tampermonkey

若你使用 Tampermonkey 而非 Chrome 擴充功能，可執行 `npm run build` 後，將產出的 `extension/src/userscript.js` 內容作為 userscript 使用（需自行加上 Tampermonkey metadata header）。

## 免責聲明

- 使用本工具可能違反 EA 服務條款，請自行承擔風險。
- 價格與 SBC 資料來自第三方 API，準確性不作保證。
- 僅供學習與個人使用，請勿用於商業轉售或自動化刷幣。

## License

MIT — 見 [LICENSE](LICENSE)。