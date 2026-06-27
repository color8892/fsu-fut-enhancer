"use strict";

const fs = require("fs");
const path = require("path");

const futwebPath = path.join(__dirname, "..", "src", "userscript.source.js");
const outputPath = path.join(__dirname, "..", "src", "fsu", "patches", "unassigned.js");
const lines = fs.readFileSync(futwebPath, "utf8").split(/\r?\n/);

const start = lines.findIndex((line) => line.includes("//25.02 显示可放至仓库数量"));
const end = lines.findIndex((line, index) => index > start && line.includes("//24.20 lodin页面插入已加载提示"));

if (start === -1 || end === -1) {
  throw new Error("Could not locate unassigned patch block");
}

const body = lines
  .slice(start + 1, end)
  .map((line) => line.replace(/^        /, "  "))
  .join("\n");

const file = `export function installUnassignedPatches(deps) {
  const { call, events, fy, cntlr, info, debug } = deps;

${body}
}
`;

fs.writeFileSync(outputPath, file, "utf8");
console.log(`Wrote ${outputPath}`);