import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const patchesDir = path.join(__dirname, "../src/fsu/patches");

function splitSbcFill() {
  const source = fs.readFileSync(path.join(patchesDir, "sbc-fill-events.js"), "utf8");
  const patchMarker = "UTSBCService.prototype.loadChallengeData";
  const patchStart = source.indexOf(patchMarker);
  if (patchStart === -1) throw new Error("sbc-fill patch marker not found");

  const eventsPart = source.slice(0, patchStart).trimEnd();
  const patchesPart = source.slice(patchStart);
  const patchesBody = patchesPart.replace(/\}\s*$/, "").trimEnd();

  const eventsFile = `${eventsPart}\n}\n`;
  const patchesFile = `export function installSbcFillPatches(deps) {\n  const { call, events, info, cntlr, isPhone, services, debug, repositories, build, fsuSC, fy, enums, GM_setValue } = deps;\n${patchesBody}\n}\n`;

  fs.writeFileSync(path.join(patchesDir, "sbc-fill-events.js"), eventsFile);
  fs.writeFileSync(path.join(patchesDir, "sbc-fill-patches.js"), patchesFile);
  console.log("Split sbc-fill-events.js");
}

function splitClubSelect() {
  const source = fs.readFileSync(path.join(patchesDir, "club-select.js"), "utf8");
  const eventsMarker = "events.setListFilterTitleAndState";
  const searchMarker = "UTClubSearchResultsViewController.prototype._requestItems";
  const rewardMarker = "installRewardPatches({";

  const eventsStart = source.indexOf(eventsMarker);
  const searchStart = source.indexOf(searchMarker);
  const rewardStart = source.indexOf(rewardMarker);
  if (eventsStart === -1 || searchStart === -1 || rewardStart === -1) {
    throw new Error("club-select split markers not found");
  }

  const patchesPart = source.slice(0, eventsStart).trimEnd();
  const eventsPart = source.slice(eventsStart, rewardStart).trimEnd();
  const searchPart = source.slice(searchStart, source.lastIndexOf("}")).trimEnd();

  const eventsFile = `export function registerClubSelectEvents(deps) {\n  const { events, info, cntlr, isPhone, services, repositories, debug, fy } = deps;\n${eventsPart}\n}\n`;
  const searchFile = `export function installClubSelectSearchPatches(deps) {\n  const { call, events, info, fy, cntlr, repositories, services } = deps;\n${searchPart}\n}\n`;
  const patchesFile = `${patchesPart}\n}\n`;

  fs.writeFileSync(path.join(patchesDir, "club-select-events.js"), eventsFile);
  fs.writeFileSync(path.join(patchesDir, "club-select-search-patches.js"), searchFile);
  fs.writeFileSync(path.join(patchesDir, "club-select.js"), patchesFile);
  console.log("Split club-select.js");
}

splitSbcFill();
splitClubSelect();