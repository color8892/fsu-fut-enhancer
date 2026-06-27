/**
 * Extracts initWithSBCSet patches into sbc-squad-overview.js and slims futweb.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const futwebPath = path.join(root, "src", "fsu", "legacy", "futweb.js");
const outPath = path.join(root, "src", "fsu", "patches", "sbc-squad-overview.js");

let source = fs.readFileSync(futwebPath, "utf8").replace(/\r\n/g, "\n");

const startMarker = "        //26.04 SBC初始化需求内容\n";
const endMarker = "        //26.04 进化属性展示计算\n";

const startIdx = source.indexOf(startMarker);
const endIdx = source.indexOf(endMarker);
if (startIdx === -1 || endIdx === -1) {
  console.error("Markers not found", { startIdx, endIdx });
  process.exit(1);
}

const extracted = source.slice(startIdx, endIdx);

const dedent = (block) =>
  block
    .split("\n")
    .map((line) => (line.startsWith("        ") ? line.slice(8) : line))
    .join("\n")
    .trim();

const ignoreIdx = extracted.indexOf("        events.getIgnoreText = () => {");
const detailIdx = extracted.indexOf("        //26.04 信息界面按钮载入\n");

const overviewBlock = dedent(extracted.slice(0, ignoreIdx));
const ignoreBlock = dedent(extracted.slice(ignoreIdx, detailIdx));
const detailBlock = dedent(extracted.slice(detailIdx));

const moduleSource = `export function registerSbcIgnoreTextEvent(deps) {
  const { events, info, fy } = deps;
  ${ignoreBlock.replace(/^events\.getIgnoreText/, "events.getIgnoreText")}
}

export function installSbcSquadOverviewPatches(deps) {
  ${overviewBlock}
}

export function installSbcSquadDetailPanelPatches(deps) {
  ${detailBlock}
}
`;

fs.writeFileSync(outPath, moduleSource);

const installBlock = `        registerSbcIgnoreTextEvent({ events, info, fy });
        installSbcSquadOverviewPatches({
            events,
            info,
            fy,
            cntlr,
            isPhone,
            repositories,
            debug,
            SBCEligibilityKey
        });
        installSbcSquadDetailPanelPatches({ events, info, cntlr });

`;

source =
  source.slice(0, startIdx) +
  installBlock +
  source.slice(endIdx);

if (!source.includes('from "../patches/sbc-squad-overview.js"')) {
  source = source.replace(
    '} from "../patches/sbc-squad.js";',
    `} from "../patches/sbc-squad.js";
import {
  registerSbcIgnoreTextEvent,
  installSbcSquadOverviewPatches,
  installSbcSquadDetailPanelPatches
} from "../patches/sbc-squad-overview.js";`
  );
}

fs.writeFileSync(futwebPath, source);
console.log("Wrote", outPath);
console.log("Updated futweb.js");