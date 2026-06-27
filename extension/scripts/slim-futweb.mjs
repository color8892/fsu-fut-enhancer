/**
 * Removes legacy inline events.* blocks now wired via ModuleRegistry.
 * Run: node scripts/slim-futweb.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const futwebPath = path.join(__dirname, "..", "src", "fsu", "legacy", "futweb.js");

/** Full implementations replaced by ModuleRegistry — safe to delete. */
const REMOVE_EVENTS = [
  "getItemBy",
  "popup",
  "losAuctionSell",
  "losAuctionCount",
  "createDF",
  "detailsButtonSet",
  "requirementsToText",
  "createButton",
  "createToggle",
  "createTile",
  "transferToClub",
  "getAuction",
  "buyConceptPlayer",
  "buyPlayer",
  "readAuctionPrices",
  "searchTransferMarket",
  "getFutbinSbcSquad",
  "playerToAuction",
  "saveOldSquad",
  "getRatingPlayers",
  "writePackReturns",
  "sbcListNeedCount",
  "needRatingsCount",
  "teamRatingCount",
  "raelProbability",
  "tryPack",
  "tryPackPopup",
  "getTryPackData",
  "getRealProbability",
  "goToAutoBuy",
  "openPacks",
  "openPacksConfirmPopup",
  "openPacksResultPopup",
  "createElementWithConfig",
  "createVirtualChallenge",
  "getFastSbcSubText",
  "academyAddAttr",
  "academyAddAttrOutput",
  "academyAttrToList",
  "academyUpdataFaceAttr",
  "academyPreviewEvolutionAttr",
  "fgCalc",
  "fgScoreToTargetRange",
  "fgCreateVirtualPlayers",
  "fgCreateElment",
  "fgPopup",
  "autoBuySearchPlayer",
  "autoBuyRightRefresh",
  "autoBuyCreateInfoView",
  "autoBuyCreateLogView",
  "autoBuyRightRenderInfo",
  "autoBuyRightMinBuyChanged",
  "autoBuyRightMaxBuyChanged",
  "autoBuyRightRenderLog",
  "autoBuyCreateItemController"
];

const START_RE = /^        events\.(\w+) = /;

function findBlockEnd(lines, startIdx) {
  const first = lines[startIdx];
  const openBraces = (first.match(/\{/g) || []).length - (first.match(/\}/g) || []).length;
  const openParens = (first.match(/\(/g) || []).length - (first.match(/\)/g) || []).length;

  if (openBraces <= 0 && openParens <= 0 && !first.includes("=>") && !first.includes("function")) {
    return startIdx;
  }

  let depth = 0;
  let started = false;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === "{") {
        depth++;
        started = true;
      } else if (ch === "}") {
        depth--;
      }
    }
    if (started && depth === 0) {
      return i;
    }
  }

  return startIdx;
}

let content = fs.readFileSync(futwebPath, "utf8");
let lines = content.split("\n");
const removeSet = new Set(REMOVE_EVENTS);
const toRemove = new Set();
let removedCount = 0;

for (let i = 0; i < lines.length; i++) {
  const match = lines[i].match(START_RE);
  if (!match) continue;
  const name = match[1];
  if (!removeSet.has(name)) continue;

  const endIdx = findBlockEnd(lines, i);
  for (let j = i; j <= endIdx; j++) {
    toRemove.add(j);
  }
  removedCount++;
  console.log(`Mark remove: events.${name} (lines ${i + 1}-${endIdx + 1})`);
}

const commentFor = (name) => `        // events.${name} → ModuleRegistry\n`;

const newLines = [];
let i = 0;
while (i < lines.length) {
  if (!toRemove.has(i)) {
    newLines.push(lines[i]);
    i++;
    continue;
  }

  const match = lines[i].match(START_RE);
  const name = match?.[1];
  if (name && !newLines.some((l) => l.includes(`events.${name} → ModuleRegistry`))) {
    newLines.push(commentFor(name));
  }

  const endIdx = findBlockEnd(lines, i);
  i = endIdx + 1;
}

content = newLines.join("\n");

fs.writeFileSync(futwebPath, content);
console.log(`\nRemoved ${removedCount} event blocks. futweb.js now ${newLines.length} lines.`);