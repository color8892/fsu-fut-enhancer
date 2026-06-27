/**
 * Extracts remaining futweb.js blocks into patch/event modules.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const futwebPath = path.join(root, "src", "fsu", "legacy", "futweb.js");
const patchesDir = path.join(root, "src", "fsu", "patches");

const dedent = (block) =>
  block
    .split("\n")
    .map((line) => (line.startsWith("        ") ? line.slice(8) : line))
    .join("\n")
    .trim();

const EXTRACTIONS = [
  {
    file: "app-init.js",
    start: "        events.notice = function(text,type){",
    end: "        //获取缓存球员数据",
    patchStart: "        //26.02 添加进化新增显示",
    template: `export function registerAppInitEvents(deps) {
  const { events, info, fy, cntlr, isPhone, services, repositories, debug, SBCCount, set, build, lock, GM_getValue, GM_setValue, GM_xmlhttpRequest, GM_info } = deps;
  EVENTS
}

export function installAppInitPatches(deps) {
  const { events, info } = deps;
  PATCH
}`,
    install: `registerAppInitEvents({ events, info, fy, cntlr, isPhone, services, repositories, debug, SBCCount, set, build, lock, GM_getValue, GM_setValue, GM_xmlhttpRequest, GM_info });
        installAppInitPatches({ events, info });`
  },
  {
    file: "login.js",
    start: "        //24.20 lodin页面插入已加载提示",
    end: "        //25.01 捕获转会市场收集到的球员价格",
    template: `export function installLoginPatches(deps) {
  const { call, events, info, services, debug, GM_getValue, GM_xmlhttpRequest } = deps;
  BODY
}`,
    install: `installLoginPatches({ call, events, info, services, debug, GM_getValue, GM_xmlhttpRequest });`
  },
  {
    file: "picks-rewards.js",
    start: "        //25.09 新挑选包界面",
    end: "        //26.04 改用新的快捷球员载入方法",
    template: `export function installPicksRewardsPatches(deps) {
  const { call, events, info, fy, isPhone, debug } = deps;
  BODY
}`,
    install: `installPicksRewardsPatches({ call, events, info, fy, isPhone, debug });`
  },
  {
    file: "squad-overview-view.js",
    start: "        //26.04 改用新的快捷球员载入方法",
    end: "        //分个形式(拍卖行待售、待分配)球员列表 读取球员列表查询价格",
    template: `export function installSquadOverviewViewPatches(deps) {
  const { call, events, info, fy, cntlr, isPhone, repositories, services, debug, SBCEligibilityKey, GM_openInTab } = deps;
  BODY
}`,
    install: `installSquadOverviewViewPatches({ call, events, info, fy, cntlr, isPhone, repositories, services, debug, SBCEligibilityKey, GM_openInTab });`
  },
  {
    file: "sectioned-list.js",
    start: "        //分个形式(拍卖行待售、待分配)球员列表 读取球员列表查询价格",
    end: "        //25.07 创建拍卖按钮移动出成为单独的实践，以免不激活。",
    template: `export function installSectionedListPatches(deps) {
  const { call, events, info, fy, cntlr, services, debug } = deps;
  BODY
}`,
    install: `installSectionedListPatches({ call, events, info, fy, cntlr, services, debug });`
  },
  {
    file: "build-ignore.js",
    start: "        //26.03 修复untradeable无法填充的问题",
    end: "        // events.popup → ModuleRegistry",
    template: `export function registerBuildIgnoreEvents(deps) {
  const { events, info, fy, set, build, debug } = deps;
  BODY
}`,
    install: `registerBuildIgnoreEvents({ events, info, fy, set, build, debug });`
  },
  {
    file: "player-list.js",
    start: "        events.wait = (min,max) => {",
    end: "        call.task = {",
    splitAt: "        //列表形式(右侧、拍卖行搜索结果、俱乐部)球员列表 读取球员列表查询价格",
    template: `export function registerPlayerListEvents(deps) {
  const { events, info, cntlr, debug, futbinId, priceService, GM_setValue } = deps;
  EVENTS
}

export function installPlayerListPatches(deps) {
  const { call, events, info, cntlr, isPhone, debug, repositories, services } = deps;
  PATCHES
}`,
    install: `registerPlayerListEvents({ events, info, cntlr, debug, futbinId, priceService, GM_setValue });
        installPlayerListPatches({ call, events, info, cntlr, isPhone, debug, repositories, services });`
  },
  {
    file: "sbc-nav-events.js",
    start: "        events.squadCount = (reqRating) => {",
    end: "        //字符串转换html对象",
    template: `export function registerSbcNavEvents(deps) {
  const { events, info, fy, cntlr, isPhone, repositories, services, futbinId, GM_openInTab } = deps;
  BODY
}`,
    install: `registerSbcNavEvents({ events, info, fy, cntlr, isPhone, repositories, services, futbinId, GM_openInTab });`
  },
  {
    file: "player-bio.js",
    start: "        /** 球员简历页面 */",
    end: "        //UTMarketSearchFiltersView.setPinnedItem",
    template: `export function installPlayerBioPatches(deps) {
  const { events, info, cntlr, services, debug, fy, repositories } = deps;
  BODY
}`,
    install: `installPlayerBioPatches({ events, info, cntlr, services, debug, fy, repositories });`
  },
  {
    file: "panel-patches.js",
    start: "        UTQuickListPanelViewController.prototype.renderView = function () {",
    end: "        // events.detailsButtonSet → ModuleRegistry",
    template: `export function installPanelPatches(deps) {
  const { call, events, info, fy, cntlr, isPhone } = deps;
  BODY
}`,
    install: `installPanelPatches({ call, events, info, fy, cntlr, isPhone });`
  },
  {
    file: "search-events.js",
    start: "        UTItemSearchView.prototype.setFilters = function(e, t) {",
    end: "        //转会列表界面 → installMarketPatches",
    splitAt: "        events.playerSearchCountShow = (e) => {",
    template: `export function installSearchPatches(deps) {
  const { call, events, info, isPhone, cntlr } = deps;
  PATCHES
}

export function registerSearchEvents(deps) {
  const { events, info, cntlr, isPhone } = deps;
  EVENTS
}`,
    install: `installSearchPatches({ call, events, info, isPhone, cntlr });
        registerSearchEvents({ events, info, cntlr, isPhone });`
  },
  {
    file: "sbc-fill-events.js",
    start: "        events.fastSBCQuantity = (clubMode, playerPool, criteria) =>",
    end: "        //24.15 头部快捷入口：SBC列表插入最前方",
    template: `export function registerSbcFillEvents(deps) {
  const { events, info, cntlr, isPhone, services, debug, repositories, build, fastSbcService, oneFillCriteriaService, sbcSquadFillService, sbcTemplateService, sbcSquadSaveService } = deps;
  BODY
}`,
    install: `registerSbcFillEvents({ events, info, cntlr, isPhone, services, debug, repositories, build, fastSbcService, oneFillCriteriaService, sbcSquadFillService, sbcTemplateService, sbcSquadSaveService });`
  },
  {
    file: "sbc-tile-events.js",
    start: "        //24.15 头部快捷入口：SBC列表插入最前方",
    end: "        //开包动画 / eOpenPack → installStorePatches",
    template: `export function registerSbcTileEvents(deps) {
  const { events, info, fy, cntlr, isPhone, services, GM_setValue, AssetLocationUtils } = deps;
  BODY
}`,
    install: `registerSbcTileEvents({ events, info, fy, cntlr, isPhone, services, GM_setValue, AssetLocationUtils });`
  },
  {
    file: "sbc-reward-events.js",
    start: "        events.oneFillCreationGF = (req, miss) =>",
    end: "        //SBC submit → installSbcSquadSubmitPatches",
    template: `export function registerSbcRewardEvents(deps) {
  const { events, info, cntlr, isPhone, repositories, services, debug, oneFillCriteriaService, SBCEligibilityKey } = deps;
  BODY
}`,
    install: `registerSbcRewardEvents({ events, info, cntlr, isPhone, repositories, services, debug, oneFillCriteriaService, SBCEligibilityKey });
        registerFastSbcEvents({ events, cntlr, info, debug, repositories, services });`
  },
  {
    file: "club-select.js",
    start: "        UTSelectItemFromClubViewController.prototype.requestItems = function() {",
    end: "        //UTMarketSearchFiltersViewController.eSearchSelected / setFilters → installMarketPatches",
    template: `export function installClubSelectPatches(deps) {
  const { call, events, info, fy, cntlr, isPhone, repositories, services, debug } = deps;
  BODY
}`,
    install: `installClubSelectPatches({ call, events, info, fy, cntlr, isPhone, repositories, services, debug });`
  },
  {
    file: "list-filter-events.js",
    start: "        events.setListFilterTitleAndState = (element,players,initPlayers) => {",
    end: "        //UTGameRewardsViewController.onButtonTapped → installRewardPatches",
    template: `export function registerListFilterEvents(deps) {
  const { events, repositories } = deps;
  BODY
}`,
    install: `registerListFilterEvents({ events, repositories });`
  },
  {
    file: "ui-utils.js",
    start: "        events.waitForClickShieldToHide = (callback, timeout = 5000) => {",
    end: "        //24.20 临时解决秒数无法显示的问题",
    template: `export function registerUiUtilsEvents(deps) {
  const { events, info, cntlr, debug, fy, services } = deps;
  BODY
}`,
    install: `registerUiUtilsEvents({ events, info, cntlr, debug, fy, services });`
  },
  {
    file: "player-meta.js",
    start: "        //24.20 临时解决秒数无法显示的问题",
    end: "        //24.23 增加快捷任务条件展示",
    patchStart: "        //24.23 增加读取meta属性",
    template: `export function installLocalizationPatch(deps) {
  const { call } = deps;
  PATCH
}

export function registerPlayerMetaEvents(deps) {
  const { events, info, fy, services } = deps;
  EVENTS
}`,
    install: `installLocalizationPatch({ call });
        registerPlayerMetaEvents({ events, info, fy, services });`
  },
  {
    file: "misc-patches.js",
    start: "        events.jsonToItemEntity = (json, isUntradeable) => {",
    end: "        //UTStoreHubViewController / inPacks / specialPlayers → installStorePatches",
    splitAt: "        /** 25.20 球员自动购买 入口创建 */",
    template: `export function registerMiscEvents(deps) {
  const { events, info, cntlr, services, repositories, debug, fy } = deps;
  EVENTS
}

export function installMiscPatches(deps) {
  const { events, info, fy, debug } = deps;
  PATCHES
}`,
    install: `registerMiscEvents({ events, info, cntlr, services, repositories, debug, fy });
        installMiscPatches({ events, info, fy, debug });`
  },
  {
    file: "lifecycle-patches.js",
    start: "        //26.04 通知特殊球员信息",
    end: "        installAcademyDetailsPatches({ info, events, repositories, services, cntlr, isPhone, debug });",
    splitAt: "        //26.04 销毁释放资源方法",
    template: `export function registerLifecycleEvents(deps) {
  const { events, info, fy } = deps;
  EVENTS
}

export function installLifecyclePatches(deps) {
  const { events, cntlr, isPhone } = deps;
  PATCHES
}`,
    install: `registerLifecycleEvents({ events, info, fy });
        installLifecyclePatches({ events, cntlr, isPhone });
        installAcademyDetailsPatches({ info, events, repositories, services, cntlr, isPhone, debug });`
  }
];

const original = fs.readFileSync(futwebPath, "utf8").replace(/\r\n/g, "\n");

/** @type {Array<{ext:typeof EXTRACTIONS[0], start:number, end:number, split?:number, patchStart?:number}>} */
const spans = [];

for (const ext of EXTRACTIONS) {
  const start = original.indexOf(ext.start);
  const end = original.indexOf(ext.end, start);
  if (start === -1 || end === -1) {
    console.error("MISSING:", ext.file, { start: start === -1, end: end === -1 });
    process.exit(1);
  }
  const span = { ext, start, end };
  if (ext.splitAt) {
    span.split = original.indexOf(ext.splitAt, start);
    if (span.split === -1 || span.split >= end) {
      console.error("MISSING split:", ext.file);
      process.exit(1);
    }
  }
  if (ext.patchStart) {
    span.patchStart = original.indexOf(ext.patchStart, start);
    if (span.patchStart === -1 || span.patchStart >= end) {
      console.error("MISSING patchStart:", ext.file);
      process.exit(1);
    }
  }
  spans.push(span);
}

const importNames = [];

for (const span of spans) {
  const { ext, start, end, split, patchStart } = span;
  let moduleSource = ext.template;
  if (split !== undefined) {
    moduleSource = moduleSource
      .replace("EVENTS", dedent(original.slice(start, split)))
      .replace("PATCHES", dedent(original.slice(split, end)))
      .replace("BODY", dedent(original.slice(start, end)));
  } else if (patchStart !== undefined) {
    moduleSource = moduleSource
      .replace("PATCH", dedent(original.slice(start, patchStart)))
      .replace("EVENTS", dedent(original.slice(patchStart, end)));
  } else {
    moduleSource = moduleSource.replace("BODY", dedent(original.slice(start, end)));
  }

  if (ext.file === "sbc-reward-events.js") {
    moduleSource = moduleSource.replace(
      /registerFastSbcEvents\(\{[^}]+\}\);\s*\n?/,
      ""
    );
  }

  fs.writeFileSync(path.join(patchesDir, ext.file), moduleSource + "\n");
  const fns = [...moduleSource.matchAll(/export function (\w+)/g)].map((m) => m[1]);
  importNames.push({ file: ext.file, fns });
  console.log("Wrote:", ext.file);
}

let source = original;
for (const { ext, start, end } of [...spans].sort((a, b) => b.start - a.start)) {
  source = source.slice(0, start) + `        ${ext.install}\n` + source.slice(end);
}

const importLines = importNames
  .map(({ file, fns }) => `import { ${fns.join(", ")} } from "../patches/${file}";`)
  .join("\n");

if (!source.includes('from "../patches/app-init.js"')) {
  source = source.replace(
    '} from "../patches/sbc-squad-overview.js";',
    `} from "../patches/sbc-squad-overview.js";
${importLines}`
  );
}

const appInitCall =
  "registerAppInitEvents({ events, info, fy, cntlr, isPhone, services, repositories, debug, SBCCount, set, build, lock, GM_getValue, GM_setValue, GM_xmlhttpRequest, GM_info });";
if (source.includes(appInitCall)) {
  source = source.replace(`        ${appInitCall}\n`, "");
  source = source.replace(
    `        SBCCount = ctx.sbcCountService.createFacade({
            isPhone,
            fy,
            createButton: (...args) => events.createButton(...args),
            popup: (...args) => events.popup(...args)
        });`,
    `        SBCCount = ctx.sbcCountService.createFacade({
            isPhone,
            fy,
            createButton: (...args) => events.createButton(...args),
            popup: (...args) => events.popup(...args)
        });

        ${appInitCall}`
  );
}

fs.writeFileSync(futwebPath, source);
console.log("Done. Lines:", source.split("\n").length);