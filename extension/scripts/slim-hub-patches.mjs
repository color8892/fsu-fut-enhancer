/**
 * Removes objectives/home/rewards/academy-details inline blocks.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const futwebPath = path.join(__dirname, "..", "src", "fsu", "legacy", "futweb.js");

const MARKERS = [
  {
    start: "        //SBC信息填充，需要传递sbcid和需填充的元素\n        events.sbcInfoFill",
    end: "        }\n        events.getOddo",
    replace: "        //events.sbcInfoFill → registerSbcInfoFillEvent\n        events.getOddo"
  },
  {
    start: "        UTObjectivesHubView.prototype.setupNavigation = function(e) {",
    end: "        call.search = {",
    replace: "        //objectives/home hub → installObjectivesHubPatches / installHomeHubPatches\n        call.search = {"
  },
  {
    start: "        events.setRewardOddo = (target,reward,type) => {",
    end: "        //创建俱乐部按钮\n        UTClubHubView.prototype.clearTileContent",
    replace: "        //rewards → installRewardPatches\n\n        //创建俱乐部按钮\n        UTClubHubView.prototype.clearTileContent"
  },
  {
    start: "        //获得奖励弹窗点击效果\n        UTGameRewardsViewController.prototype.onButtonTapped = function(e, t, i) {",
    end: "        }\n        // 25.22 等待loading后回调事件",
    replace: "        //UTGameRewardsViewController.onButtonTapped → installRewardPatches\n        // 25.22 等待loading后回调事件"
  },
  {
    start: "        //26.04 进化增加属性显示\n        const UTAcademySlotItemDetailsViewController_renderPopulatedSlot",
    end: "        //26.04 判断是否是珍贵球员\n        events.isPrecious",
    replace: "        //academy details → installAcademyDetailsPatches\n        events.isPrecious"
  }
];

let source = fs.readFileSync(futwebPath, "utf8").replace(/\r\n/g, "\n");

const sbcInfoRegister = `        registerSbcInfoFillEvent({ events, info, fy, html, repositories });

`;

if (!source.includes("registerSbcInfoFillEvent({")) {
  source = source.replace(
    "        installAcademyHubPatches({ info, events, fy, repositories, debug });\n\n        events.squadCount",
    `        installAcademyHubPatches({ info, events, fy, repositories, debug });\n${sbcInfoRegister}        events.squadCount`
  );
  console.log("Inserted registerSbcInfoFillEvent");
}

let removed = 0;
for (const { start, end, replace } of MARKERS) {
  const idx = source.indexOf(start);
  if (idx === -1) {
    console.warn("SKIP:", start.slice(0, 50));
    continue;
  }
  const endIdx = source.indexOf(end, idx);
  if (endIdx === -1) {
    console.warn("SKIP end:", end.slice(0, 50));
    continue;
  }
  source = source.slice(0, idx) + replace + source.slice(endIdx + end.length);
  removed++;
  console.log("Removed:", start.slice(0, 40).trim());
}

const hubInstall = `        installObjectivesHubPatches({ call, events, info, fy, isPhone, services });
        installHomeHubPatches({ call, events, info, fy, cntlr, services, debug, fsuSC });

`;

if (!source.includes("installObjectivesHubPatches({")) {
  source = source.replace(
    "        registerSbcSubstitutionEvents({ events });\n\n        //objectives/home hub",
    `        registerSbcSubstitutionEvents({ events });\n\n${hubInstall}        //objectives/home hub`
  );
  console.log("Inserted hub installs");
}

const rewardInstall = `        installRewardPatches({ call, events, info, fy, cntlr, repositories, debug });

`;

if (!source.includes("installRewardPatches({")) {
  const anchor = "        //rewards → installRewardPatches\n\n        //创建俱乐部按钮";
  if (source.includes(anchor)) {
    source = source.replace(anchor, `        //rewards → installRewardPatches\n${rewardInstall}\n        //创建俱乐部按钮`);
    console.log("Inserted reward install");
  }
}

const academyInstall = `        installAcademyDetailsPatches({ info, events, repositories, services, cntlr, isPhone, debug });

`;

if (!source.includes("installAcademyDetailsPatches({")) {
  source = source.replace(
    "        //academy details → installAcademyDetailsPatches\n        events.isPrecious",
    `${academyInstall}        events.isPrecious`
  );
  console.log("Inserted academy details install");
}

fs.writeFileSync(futwebPath, source);
console.log(`Done. ${removed} blocks removed.`);