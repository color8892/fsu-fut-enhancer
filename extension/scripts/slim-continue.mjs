import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const futwebPath = path.join(__dirname, "..", "src", "fsu", "legacy", "futweb.js");

const MARKERS = [
  {
    start: "        //24.15 界面添加显示\n        UTGameFlowNavigationController.prototype.didPush",
    end: "        //24.15 球员挑选最佳提示：球员挑选排序\n        events.playerSelectionSort = (view,player) => {",
    replace:
      "        //navigation → installNavigationPatches\n        events.__nav_removed__ = (view,player) => {"
  },
  {
    start: "        events.__nav_removed__ = (view,player) => {",
    end: "        UTSquadBuilderViewController.prototype.viewDidAppear = function() {",
    replace: "        UTSquadBuilderViewController.prototype.viewDidAppear = function() {"
  },
  {
    start: "        UTSquadBuilderViewController.prototype.viewDidAppear = function() {",
    end: "        }\n        installPlayerCardPatches",
    replace: "        //squad builder → installSquadBuilderPatches\n        installPlayerCardPatches"
  },
  {
    start: "        events.sbcSubPrice = async(id,e) => {",
    end: "        }\n\n        call.panel = {",
    replace: "        //sbcSubPrice → registerSbcSubPriceEvent\n\n        call.panel = {"
  },
  {
    start: "        //提交SBC任务\n        //24.20 拦截提交行为，交换重复球员\n        UTSBCSquadOverviewViewController.prototype._submitChallenge",
    end: "        UTSelectItemFromClubViewController.prototype.requestItems = function() {",
    replace:
      "        //SBC submit → installSbcSquadSubmitPatches\n        UTSelectItemFromClubViewController.prototype.requestItems = function() {"
  },
  {
    start: "        //创建俱乐部按钮\n        UTClubHubView.prototype.clearTileContent",
    end: "        //读取显示锁定球员\n        UTClubSearchResultsViewController.prototype._requestItems",
    replace:
      "        //club hub → installClubHubPatches\n        //读取显示锁定球员\n        UTClubSearchResultsViewController.prototype._requestItems"
  },
  {
    start: "        //26.04 SBC需求处添加快速完成按钮\n        const UTSBCRequirementsView_render",
    end: "        //26.04 通知特殊球员信息\n        events.noticeSpecialPlayerInfo",
    replace:
      "        //UTSBCRequirementsView → installSbcRequirementsPatch\n        //26.04 通知特殊球员信息\n        events.noticeSpecialPlayerInfo"
  }
];

let source = fs.readFileSync(futwebPath, "utf8").replace(/\r\n/g, "\n");

let removed = 0;
for (const { start, end, replace } of MARKERS) {
  const idx = source.indexOf(start);
  if (idx === -1) {
    console.warn("SKIP:", start.slice(0, 45));
    continue;
  }
  const endIdx = source.indexOf(end, idx);
  if (endIdx === -1) {
    console.warn("SKIP end:", end.slice(0, 45));
    continue;
  }
  source = source.slice(0, idx) + replace + source.slice(endIdx + end.length);
  removed++;
  console.log("Removed:", start.slice(0, 32).trim());
}

if (!source.includes("installNavigationPatches({")) {
  source = source.replace(
    "        //25.01 战术选择界面显示meta评分\n        UTTacticsRoleSelectViewController.prototype.viewDidAppear",
    `        installNavigationPatches({ call, events, info, isPhone, SBCCount });\n\n        //25.01 战术选择界面显示meta评分\n        UTTacticsRoleSelectViewController.prototype.viewDidAppear`
  );
}

if (!source.includes("installSquadBuilderPatches({")) {
  source = source.replace(
    "        //squad builder → installSquadBuilderPatches\n        installPlayerCardPatches",
    `        installSquadBuilderPatches({ call, events, fy, info, build });\n        installPlayerCardPatches`
  );
}

if (!source.includes("registerSbcSubPriceEvent({")) {
  source = source.replace(
    "        installSbcChallengesPatch({",
    `        registerSbcSubPriceEvent({ events, info, fy, isPhone, repositories });\n        installSbcChallengesPatch({`
  );
}

const squadBackup = `        call.squad = {
            "setPlayers":UTSquadEntity.prototype.setPlayers,
            "swapPlayers":UTSquadEntity.prototype.swapPlayersByIndex,
            "addItem":UTSquadEntity.prototype.addItemToSlot,
            "removeItem":UTSquadEntity.prototype.removeItemFromSlot,
            "removeAll":UTSquadEntity.prototype.removeAllItems,
            "submitted":UTSBCSquadOverviewViewController.prototype._onChallengeSubmitted,
            "submit":UTSBCSquadOverviewViewController.prototype._submitChallenge,
            "requirements":UTSBCChallengeRequirementsView.prototype.renderChallengeRequirements
        }`;

if (!source.includes("installSbcSquadSubmitPatches({")) {
  source = source.replace(
    squadBackup,
    `${squadBackup}\n\n        installSbcSquadSubmitPatches({ call, events, info, repositories, services, cntlr, debug, fy });`
  );
}

if (!source.includes("installSbcRequirementsPatch({")) {
  source = source.replace(
    "        //UTSBCRequirementsView → installSbcRequirementsPatch",
    `        installSbcRequirementsPatch({ events, info, fy, repositories });\n        //UTSBCRequirementsView → installSbcRequirementsPatch`
  );
}

if (!source.includes("installClubHubPatches({")) {
  source = source.replace(
    "        //club hub → installClubHubPatches",
    `        installClubHubPatches({ call, events, info, fy, cntlr, isPhone, repositories, services });\n        //club hub → installClubHubPatches`
  );
}

fs.writeFileSync(futwebPath, source);
console.log(`Done. ${removed} removed.`);