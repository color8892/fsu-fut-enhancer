import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const futweb = fs.readFileSync(path.join(__dirname, "../src/fsu/legacy/futweb.js"), "utf8");
const marker = 'info.base.sytle = "';
const start = futweb.indexOf(marker);
if (start === -1) throw new Error("CSS marker not found");
const cssStart = start + marker.length;
const nextBlock = futweb.indexOf("\n        priceService.setErrorHandler", cssStart);
if (nextBlock === -1) throw new Error("CSS end anchor not found");
const lineSlice = futweb.slice(cssStart, nextBlock).trimEnd();
if (!lineSlice.endsWith('"')) throw new Error("CSS line does not end with closing quote");
const css = lineSlice.slice(0, -1);
const out = `export const FSU_BASE_STYLE = ${JSON.stringify(css)};\nexport const FSU_BASE_SYTLE = FSU_BASE_STYLE;\n`;
fs.writeFileSync(path.join(__dirname, "../src/fsu/ui/fsu-styles.js"), out);
console.log("Extracted CSS length:", css.length);