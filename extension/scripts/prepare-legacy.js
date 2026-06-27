"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "src", "userscript.source.js");
const legacyPath = path.join(root, "src", "fsu", "legacy", "futweb.js");
const localizationPath = path.join(root, "src", "fsu", "data", "localization.js");

const source = fs.readFileSync(sourcePath, "utf8");
const lines = source.split(/\r?\n/);

const futwebStart = lines.findIndex((line) => line.includes("function futweb()"));
const classStart = lines.findIndex((line) => line.includes("class FsuUserscriptApp"));

if (futwebStart === -1 || classStart === -1 || classStart <= futwebStart) {
  throw new Error("Could not locate futweb() body in userscript.js");
}

let futwebEnd = classStart - 1;
while (futwebEnd > futwebStart && lines[futwebEnd].trim() === "") {
  futwebEnd -= 1;
}

if (lines[futwebEnd].trim() !== "}") {
  throw new Error("Could not locate futweb() closing brace in userscript.js");
}

const localizationStart = lines.findIndex((line) => line.includes("info.localization = {"));
const localizationEnd = lines.findIndex(
  (line, index) => index > localizationStart && line.trim() === "}"
);

if (localizationStart === -1 || localizationEnd === -1) {
  throw new Error("Could not locate localization block in userscript.js");
}

const localizationLines = lines.slice(localizationStart + 1, localizationEnd);
fs.mkdirSync(path.dirname(localizationPath), { recursive: true });
fs.writeFileSync(
  localizationPath,
  `export const LOCALIZATION_STRINGS = {\n${localizationLines.join("\n")}\n};\n`,
  "utf8"
);

let bodyLines = lines.slice(futwebStart + 1, futwebEnd);

function findLine(match, fromIndex = 0) {
  const index = bodyLines.findIndex((line, lineIndex) => lineIndex >= fromIndex && line.includes(match));
  if (index === -1) {
    throw new Error(`Could not find line containing: ${match}`);
  }
  return index;
}

function replaceRange(start, endExclusive, replacementLines) {
  const replacement = Array.isArray(replacementLines) ? replacementLines : [replacementLines];
  bodyLines.splice(start, endExclusive - start, ...replacement);
}

{
  const index = findLine("var events = {}");
  bodyLines[index] =
    "        var events = {},info = {},html = {},call = {},set = {},pdb = {},lock = {},build = {},SBCCount = {};";
}

const classStartInBody = findLine("class FsuJsonStore");
const storeLine = findLine("const store = new FsuJsonStore");
replaceRange(classStartInBody, storeLine, []);

const ctxBlock = [
  "        const ctx = new AppContext({",
  "            getValue: GM_getValue,",
  "            setValue: GM_setValue,",
  "            xmlHttpRequest: GM_xmlhttpRequest,",
  "            userAgent: navigator.userAgent,",
  "            getInfo: () => info",
  "        });",
  "        const store = ctx.store;",
  "        const httpClient = ctx.httpClient;",
  "        const priceService = ctx.priceService;",
  "        const debug = ctx.debug;",
  "        const cntlr = ctx.controllerAccess;"
];

const storeIdx = findLine("const store = new FsuJsonStore");
const httpIdx = findLine("const httpClient = new FsuHttpClient");
replaceRange(storeIdx, httpIdx + 1, ctxBlock);

const cntlrIdx = findLine("cntlr = {");
const eventsNoticeIdx = findLine("events.notice = function");
replaceRange(cntlrIdx, eventsNoticeIdx, []);

const localizationCommentIdx = findLine("//本地化文本显示程序");
const htmlCommentIdx = findLine("//固话的HTML内容");
replaceRange(localizationCommentIdx, htmlCommentIdx, [
  "        const { fy, eafy } = createLocalization(() => info);",
  "        info.localization = LOCALIZATION_STRINGS;",
  ""
]);

const futbinRequestIdx = findLine("//24.18 修改请求fut链接报错提示");
const externalRequestIdx = findLine("events.externalRequest =");
replaceRange(futbinRequestIdx, externalRequestIdx, [
  "        priceService.setErrorHandler((error) => {",
  '            events.notice(fy("notice.loaderror") + error, 2);',
  "            events.hideLoader();",
  "        });",
  "",
  "        events.getFutbinUrl = (url) => priceService.getFutbinUrl(url);",
  "        events.getPriceForUrl = (definitionIds) => priceService.getPriceForUrl(definitionIds);",
  "        events.getPriceForFubin = (playerResourceId) => priceService.getPriceForFutbin(playerResourceId);",
  "        events.getCachePrice = (definitionId, type) => priceService.getCachePrice(definitionId, type);",
  "        events.priceLastDiff = (purchasePrice, lastPrice) => priceService.priceLastDiff(purchasePrice, lastPrice);",
  ""
]);

const futbinIdBlockIdx = findLine("//26.05 futbinId处理");
const fgCalcIdx = findLine("//26.07 FG计算");
replaceRange(futbinIdBlockIdx, fgCalcIdx, [
  "        const futbinId = priceService.createFutbinIdFacade();",
  ""
]);

const futbinSingleIdx = bodyLines.findIndex((line) => line.includes("//25.13 通过FUTBIN获得单一球员价格"));
if (futbinSingleIdx !== -1) {
  const loadPlayerIdx = findLine("//球员价格读取", futbinSingleIdx);
  replaceRange(futbinSingleIdx, loadPlayerIdx, []);
}

const priceDiffIdx = bodyLines.findIndex((line) => line.includes("//差价计算 需要传递购买价格和预估价格"));
if (priceDiffIdx !== -1) {
  const loadPlayerIdx = findLine("//球员价格读取", priceDiffIdx);
  replaceRange(priceDiffIdx, loadPlayerIdx, []);
}

const cachePriceIdx = bodyLines.findIndex((line) => line.includes("events.getCachePrice = (i,t)"));
if (cachePriceIdx !== -1) {
  const losAuctionIdx = findLine("events.losAuctionCount", cachePriceIdx);
  replaceRange(cachePriceIdx, losAuctionIdx, []);
}

bodyLines = bodyLines.filter(
  (line) =>
    !line.includes('!function(e,t){"object"==typeof exports') &&
    !line.includes("multicombinations:function")
);

let body = bodyLines.join("\n").replace(/console\.log\(/g, "debug.log(");

const header = `import { AppContext } from "../core/AppContext.js";
import { LOCALIZATION_STRINGS } from "../data/localization.js";
import { createLocalization } from "../domain/Localization.js";

export function futweb() {
`;

fs.mkdirSync(path.dirname(legacyPath), { recursive: true });
fs.writeFileSync(legacyPath, `${header}${body}\n}\n`, "utf8");

console.log("Prepared legacy futweb.js and localization data.");