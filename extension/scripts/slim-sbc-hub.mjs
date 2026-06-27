/**
 * Removes SBC hub inline patches now wired via installSbcHubPatches.
 * Run: node scripts/slim-sbc-hub.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const futwebPath = path.join(__dirname, "..", "src", "fsu", "legacy", "futweb.js");

const MARKERS = [
  {
    start: "        //点击子任务后给包添加价格\n        //24.20 修改为预估价格\n        UTSBCGroupRewardListView.prototype.setRewards",
    end: "        }\n\n        //给子任务TABLE样式添加ID",
    replace: "        //UTSBCGroupRewardListView.setRewards → installSbcHubPatches\n\n        //给子任务TABLE样式添加ID"
  },
  {
    start: "        //给子任务TABLE样式添加ID\n        const UTSBCChallengeTableRowView_render",
    end: "        }\n        //生成奖励信息时报错处理",
    replace: "        //UTSBCChallengeTableRowView.render → installSbcHubPatches\n        //生成奖励信息时报错处理"
  },
  {
    start: "        //生成奖励信息时报错处理\n        UTSBCSetTileView.prototype.setData",
    end: "        }\n\n\n        events.squadCount",
    replace: "        //UTSBCSetTileView.setData → installSbcHubPatches\n\n        events.squadCount"
  },
  {
    start: "        //25.20 快速任务TAB添加\n        UTSBCSetsViewModel.prototype.getCategories",
    end: "        }\n        //SBC填充导航题头 加载导航额外信息",
    replace: "        //UTSBCSetsViewModel.getCategories → installSbcHubPatches\n        //SBC填充导航题头 加载导航额外信息"
  },
  {
    start: "        //SBC填充导航题头 加载导航额外信息\n        //26.02 SBC导航判断类别中已完成的不进行数值展示\n        UTSBCHubView.prototype.populateNavigation",
    end: "        }\n\n        //26.02 进化：进行排序按照到期时间",
    replace: "        //UTSBCHubView.populateNavigation → installSbcHubPatches\n\n        //26.02 进化：进行排序按照到期时间"
  },
  {
    start: "        //26.02 分类导航计数添加\n        events.navigationAddCount",
    end: "        }\n        installSbcChallengesPatch({",
    replace: "        //navigationAddCount / populateTiles / sbcFilter → installSbcHubPatches\n        installSbcChallengesPatch({"
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

const installBlock = `        installSbcHubPatches({ info, events, services, fy, cntlr });

`;

if (!source.includes("installSbcHubPatches({")) {
  const anchor = "            seasonSet:FCObjectiveSeasonView.prototype.setCampaign\n        }\n\n";
  if (source.includes(anchor)) {
    source = source.replace(anchor, `${anchor}${installBlock}`);
    console.log("Inserted installSbcHubPatches");
  } else {
    console.error("Failed to insert installSbcHubPatches — anchor not found");
  }
}

fs.writeFileSync(futwebPath, source);
console.log(`Done. ${removed} blocks removed.`);