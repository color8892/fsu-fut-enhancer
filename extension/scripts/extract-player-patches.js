"use strict";

const fs = require("fs");
const path = require("path");

const futwebPath = path.join(__dirname, "..", "src", "fsu", "legacy", "futweb.js");
const lines = fs.readFileSync(futwebPath, "utf8").split(/\r?\n/);

function writePatch(outputPath, exportName, bodyLines, extraDeps = "lock") {
  const body = bodyLines.map((line) => line.replace(/^        /, "  ")).join("\n");
  const file = `export function ${exportName}(deps) {
  const { call, events, fy, cntlr, info, ${extraDeps} } = deps;

${body}
}
`;
  fs.writeFileSync(outputPath, file, "utf8");
  console.log(`Wrote ${outputPath}`);
}

const playerStart = lines.findIndex((line) => line.includes("//球员卡信息创建"));
const miscStart = lines.findIndex((line) => line.includes("//球员道具信息创建效果"));
const plistStart = lines.findIndex((line) => line.includes("call.plist = {"));

if (playerStart === -1 || miscStart === -1 || plistStart === -1) {
  throw new Error("Could not locate player card patch blocks");
}

writePatch(
  path.join(__dirname, "..", "src", "fsu", "patches", "player-item.js"),
  "installPlayerItemPatch",
  lines.slice(playerStart + 1, miscStart)
);

writePatch(
  path.join(__dirname, "..", "src", "fsu", "patches", "misc-item.js"),
  "installMiscItemPatch",
  lines.slice(miscStart + 1, plistStart),
  "lock"
);

const updated = [
  ...lines.slice(0, playerStart),
  "        installPlayerCardPatches({ call, events, fy, cntlr, info, lock });",
  "",
  ...lines.slice(plistStart)
];

fs.writeFileSync(futwebPath, updated.join("\n"), "utf8");
console.log("Updated futweb.js");