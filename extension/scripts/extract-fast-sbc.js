"use strict";

const fs = require("fs");
const path = require("path");

const futwebPath = path.join(__dirname, "..", "src", "fsu", "legacy", "futweb.js");
const lines = fs.readFileSync(futwebPath, "utf8").split(/\r?\n/);

const start = lines.findIndex((line) => line.includes("events.isSBCCache = (id,cId)"));
const end = lines.findIndex((line, index) => index > start && line.includes("//根据类型获取当前的view和controller"));

if (start === -1 || end === -1) {
  throw new Error("Could not locate fast SBC block");
}

const body = lines
  .slice(start, end)
  .map((line) => line.replace(/^        /, "  "))
  .join("\n");

const outputPath = path.join(__dirname, "..", "src", "fsu", "patches", "sbc-fast.js");
const file = `export function registerFastSbcEvents(deps) {
  const {
    events,
    cntlr,
    info,
    debug,
    build,
    repositories,
    services,
    getCurrent,
    showLoader,
    hideLoader,
    notice,
    getItemBy,
    ignorePlayerToCriteria,
    isEligibleForOneFill,
    playerListFillSquad,
    showRewardsView,
    SBCListInsertToFront
  } = deps;

${body}
}
`;

fs.writeFileSync(outputPath, file, "utf8");

const updated = [
  ...lines.slice(0, start),
  "        registerFastSbcEvents({",
  "            events,",
  "            cntlr,",
  "            info,",
  "            debug,",
  "            build,",
  "            repositories,",
  "            services,",
  "            getCurrent: (...args) => events.getCurrent(...args),",
  "            showLoader: () => events.showLoader(),",
  "            hideLoader: () => events.hideLoader(),",
  "            notice: (...args) => events.notice(...args),",
  "            getItemBy: (...args) => events.getItemBy(...args),",
  "            ignorePlayerToCriteria: (...args) => events.ignorePlayerToCriteria(...args),",
  "            isEligibleForOneFill: (...args) => events.isEligibleForOneFill(...args),",
  "            playerListFillSquad: (...args) => events.playerListFillSquad(...args),",
  "            showRewardsView: (...args) => events.showRewardsView(...args),",
  "            SBCListInsertToFront: (...args) => events.SBCListInsertToFront(...args)",
  "        });",
  "",
  ...lines.slice(end)
];

fs.writeFileSync(futwebPath, updated.join("\n"), "utf8");
console.log("Extracted fast SBC workflow");