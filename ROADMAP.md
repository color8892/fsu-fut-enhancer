# Refactoring Roadmap

這份 roadmap 描述 FSU 從現有 prototype patch 架構，漸進遷移到可驗證、可回復、型別化架構的順序。它不是版本承諾；每個 phase 都應拆成可獨立測試與回滾的小型 PR。

## 原則

1. 保持使用者功能和設定格式相容，除非另有遷移說明。
2. 先建立測試與 adapter，再搬移功能；不以整包重寫取代可運作版本。
3. EA 內部 API、page world、extension bridge 和遠端資料是四個不同信任邊界。
4. 每個 phase 必須有明確輸出與 exit criteria。
5. `legacy/` 只減少，不新增業務邏輯。

## 現況基線

已具備：

- Manifest V3 extension 與可重現的 esbuild bundle
- `FsuContext`、`ModuleRegistry`、`PatchInstaller` 和 domain services
- background endpoint policy、縮小的 page injection 範圍與 packaged dependencies
- 遠端 SBC 文字 escaping
- ESLint、CodeQL、單元測試與第一批 strict `checkJs` 模組
- EA bundle prototype compatibility checker

仍待改善：

- patches 大量直接讀取 EA 全域和 prototype
- patch 安裝缺少一致的 verify、idempotence、rollback 與 diagnostics
- `events.*` 同時承擔 facade、service locator 和可變全域狀態
- `info` 結構寬鬆，遠端 response 多數沒有 runtime schema
- 缺少真正載入 extension 的瀏覽器整合測試

## Phase 1 — 文件與工程契約

**目標**：讓現況、安全規則和未來設計有單一可信來源。

交付項目：

- 使用者、開發、架構、安全和 agent 文件分工
- request policy、HTML boundary、typecheck strategy 的維護規則
- roadmap 與 PR slicing 原則

完成條件：

- 文件連結與命令可執行
- README 不把未完成 adapter 描述成現況
- SECURITY 與實作中的 request policy 一致

## Phase 2 — EA Adapter 與能力盤點

**目標**：停止讓 domain 和新功能直接依賴散落的 EA 全域。

**狀態**：進行中。市場唯讀切片已建立 lazy `EaRuntimeAdapter` 與 `EaMarketSearchSession`，並遷移 UTAS session refresh、market cache、transfer market search、EA query model 和價格步進。購買、移動、上架、通知與其他市場寫入流程仍使用舊 EA 全域，不應被視為已完成遷移。

交付項目：

- 建立 `src/fsu/ea/`，定義 controller、repository、service、item 和 localization adapters
- 盤點每個 patch 使用的 EA class、prototype method 與必要 signature
- 提供 feature capability checks，例如 `supports("sbc.submit")`
- 建立最小 `ea-globals.d.ts` 或 JSDoc declarations

完成條件：

- 新 domain code 不直接引用 `UT*`、`services`、`repositories`
- 至少價格、市場和一個 SBC read-only 流程使用 adapter
- adapter 缺少能力時回傳可診斷結果，而不是 `ReferenceError`

## Phase 3 — Patch Lifecycle

**目標**：讓 prototype patch 可驗證、冪等並可回復。

預計 API：

```js
registry.install({
  id: "home.academy-tile",
  resolveTarget,
  verify,
  apply,
  restore
});
```

交付項目：

- 統一 patch descriptor 與唯一 ID
- 安裝前 target/signature 驗證
- 防止重複安裝，保留原始 method，支援 restore
- 每個 feature 隔離失敗並輸出 diagnostics
- 將現有 6 個 phase 保留為相容層，逐步遷移 descriptor

完成條件：

- 重複執行 installer 不會形成雙重 wrapper
- 單一 patch 失敗不阻止無關 feature 啟動
- 測試覆蓋 install、duplicate、verify failure、restore

## Phase 4 — Typed Runtime 與資料契約

**目標**：縮小 `events`／`info` 的不透明共享狀態。

交付項目：

- 將設定、cache、remote config、SBC state 拆成具名 stores/services
- 為遠端設定、價格、SBC 和 EA adapter response 加 runtime schema
- 擴大 `tsconfig.json` strict island 到 `core/`、`infra/` 和純 `domain/`
- 將錯誤統一成具名結果或 Error subclasses

完成條件：

- 遠端 malformed response 不會留下半更新的 `info`
- 新 service 不透過任意 `events.*` 查找依賴
- strict island 覆蓋所有不直接 patch EA prototype 的核心模組

## Phase 5 — 垂直功能遷移

**目標**：按使用者功能切片遷移，而不是按資料夾做大爆炸重寫。

建議順序：

1. 價格顯示與 cache
2. 玩家詳情與 metadata
3. 市場 read-only 查詢
4. SBC requirements 和 squad read-only 資料
5. SBC fill／submit 等有寫入風險的流程
6. 商店、批次操作和其他高風險自動化

每個切片包含：

- adapter 能力
- domain service
- UI renderer
- patch descriptor
- 單元與整合測試
- feature flag 或快速停用路徑

完成條件：

- 被遷移功能不再依賴 legacy inline implementation
- 新舊行為有 fixture 或 golden tests 對照
- 失敗時只停用該 feature

## Phase 6 — Browser Integration 與 Release Safety

**目標**：在真實 MV3 runtime 驗證 extension 邊界和主要使用者流程。

交付項目：

- Playwright persistent-context extension tests
- page message forgery、request rejection、reload invalidation 測試
- sanitized EA shell／fixture，用於最小 DOM integration tests
- bundle reproducibility check：build 後 `git diff --exit-code`
- release smoke checklist 與 rollback 指引

完成條件：

- CI 能載入 unpacked extension 並驗證 background/content/page handshake
- committed `userscript.js` 不可能與 source drift
- release 前安全、型別、單元、browser checks 全部通過

## PR 切分規則

- 一個 PR 只處理一個 adapter capability、patch family 或跨切面基礎設施。
- 機械式搬移與行為改變分開提交。
- 每個 PR 描述目前行為、目標行為、fallback 和驗證方式。
- 大型檔案先補 characterization tests，再拆分。
- 不以行數或 TypeScript 百分比作為完成指標；以依賴方向與 failure isolation 為準。

## 非目標

- 不改寫成 Rust/WASM。
- 不為了框架一致性在 EA DOM 上引入大型 UI framework。
- 不承諾消除所有 prototype patch；EA 沒有公開 extension API，必要 hook 仍會存在。
- 不在同一個 PR 重寫全部 SBC、市場或商店流程。
