/**
 * Removes market/store inline prototype patches now wired via installMarketPatches / installStorePatches.
 * Run: node scripts/slim-market-store.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const futwebPath = path.join(__dirname, "..", "src", "fsu", "legacy", "futweb.js");

const MARKERS = [
  {
    start: "        //25.01 捕获转会市场收集到的球员价格\n        UTTransferMarketPaginationViewModel.prototype.startAuctionUpdates",
    end: "        }\n\n        //25.01 战术选择界面显示meta评分",
    replace: "        //25.01 捕获转会市场收集到的球员价格 → installMarketPatches\n\n        //25.01 战术选择界面显示meta评分"
  },
  {
    start: "        //球员预览包打开 读取球员列表查询价格\n        UTStoreRevealModalListView.prototype.addItems",
    end: "        }\n\n        //俱乐部卖掉球员",
    replace: "        //球员预览包打开 → installStorePatches\n\n        //俱乐部卖掉球员"
  },
  {
    start: "        UTMarketSearchFiltersView.prototype.setPinnedItem = function(e, t) {",
    end: "        }\n        UTQuickListPanelViewController.prototype.renderView",
    replace: "        //UTMarketSearchFiltersView.setPinnedItem → installMarketPatches\n        UTQuickListPanelViewController.prototype.renderView"
  },
  {
    start: "        UTClubSearchFiltersViewController.prototype.viewDidAppear = function() {\n            call.search.club.viewDid.call(this)",
    end: "        }\n\n        UTItemSearchView.prototype.setFilters = function(e, t) {",
    replace: "        //UTClubSearchFiltersViewController / UTClubSearchResultsView → installMarketPatches\n\n        UTItemSearchView.prototype.setFilters = function(e, t) {"
  },
  {
    start: "        //转会列表界面\n        UTTransferListViewController.prototype._renderView",
    end: "        }\n\n        //转会名单发送球员后调用事件",
    replace: "        //转会列表界面 → installMarketPatches\n\n        //转会名单发送球员后调用事件"
  },
  {
    start: "        //拍卖优化部分代码加载\n        UTMarketSearchView.prototype._generate",
    end: "        }\n\n        //拍卖查询价格",
    replace: "        //拍卖优化部分代码加载 → installMarketPatches\n\n        //拍卖查询价格"
  },
  {
    start: "        function getAuctionPrice(i,p){",
    end: "        };\n\n        //24.18 假想球员批量购买",
    replace: "        //getAuctionPrice → MarketActionService\n\n        //24.18 假想球员批量购买"
  },
  {
    start: "        //** 25.21 移除包名多余字符 */\n        events.truncateStrict",
    end: "        }\n        // events.writePackReturns → ModuleRegistry",
    replace: "        //UTStoreView.setPacks / events.truncateStrict → installStorePatches\n        // events.writePackReturns → ModuleRegistry"
  },
  {
    start: "        //开包动画\n        UTPackAnimationViewController.prototype.runAnimation",
    end: "        }\n\n\n        //一键填充需求生成程序",
    replace: "        //开包动画 / eOpenPack → installStorePatches\n\n        //一键填充需求生成程序"
  },
  {
    start: "        //搜索球员时抓取所搜索的球员内容\n        UTMarketSearchFiltersViewController.prototype.eSearchSelected",
    end: "        }\n        //24.15 修复EA错误：SBC中转会搜索无法购买球员",
    replace: "        //UTMarketSearchFiltersViewController.eSearchSelected / setFilters → installMarketPatches\n        //24.15 修复EA错误：SBC中转会搜索无法购买球员"
  },
  {
    start: "        //商店页面设置标题\n        UTStoreViewController.prototype.setCategory",
    end: "        }\n        // events.createVirtualChallenge → ModuleRegistry",
    replace: "        //UTStoreViewController.setCategory → installStorePatches\n        // events.createVirtualChallenge → ModuleRegistry"
  },
  {
    start: "        //** 25.20 球员自动购买 球员点击右侧界面拦截 */\n        const UTClubSearchResultsViewController_onTableCellSelected",
    end: "        }\n        // events.autoBuyRightRefresh → ModuleRegistry",
    replace: "        //UTClubSearchResultsViewController autobuy → installMarketPatches\n        // events.autoBuyRightRefresh → ModuleRegistry"
  },
  {
    start: "        //** 25.20 球员自动购买 载入球员右侧页面拦截 */\n        const UTClubSearchResultsViewController_refreshPinnedItem",
    end: "        }\n\n        //** 25.20 球员自动购买 设置右侧界面拦截 */",
    replace: "        //UTClubSearchResultsViewController.refreshPinnedItem autobuy → installMarketPatches\n\n        //** 25.20 球员自动购买 设置右侧界面拦截 */"
  },
  {
    start: "        //26.04 添加可开球员tile\n        //26.04 添加特殊品质tile\n        const UTStoreHubViewController_onPackLoadComplete",
    end: "        };\n\n\n        //26.04 SBC需求处添加快速完成按钮",
    replace: "        //UTStoreHubViewController / inPacks / specialPlayers → installStorePatches\n\n        //26.04 SBC需求处添加快速完成按钮"
  }
];

let source = fs.readFileSync(futwebPath, "utf8").replace(/\r\n/g, "\n");
let removed = 0;

for (const { start, end, replace } of MARKERS) {
  const idx = source.indexOf(start);
  if (idx === -1) {
    console.warn("SKIP (start not found):", start.slice(0, 60));
    continue;
  }
  const endIdx = source.indexOf(end, idx);
  if (endIdx === -1) {
    console.warn("SKIP (end not found):", end.slice(0, 60));
    continue;
  }
  source = source.slice(0, idx) + replace + source.slice(endIdx + end.length);
  removed++;
  console.log("Removed:", start.slice(0, 50).trim());
}

const installBlock = `        installMarketPatches({ call, events, info, cntlr, isPhone, fy, debug, repositories, services, GM_setValue });
        installStorePatches({ call, events, info, cntlr, isPhone, fy, debug, repositories, services, GM_setValue, AssetLocationUtils, unsafeWindow });

`;

if (!source.includes("installMarketPatches({")) {
  const anchor =
    "            setHeader:UTClubSearchResultsViewController.prototype.setupHeader\n        };\n\n";
  if (source.includes(anchor)) {
    source = source.replace(anchor, `${anchor}${installBlock}`);
    console.log("Inserted installMarketPatches / installStorePatches");
  } else {
    console.error("Failed to insert install calls — anchor not found");
  }
}

fs.writeFileSync(futwebPath, source);
console.log(`Done. ${removed} blocks removed.`);