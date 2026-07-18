#!/usr/bin/env node
/**
 * H6 gate: packaged embedded runtime resources exist and userscript hash
 * matches the Extension build output when present.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const PACK = path.join(ROOT, "resources", "fsu");
const EXT_USERSCRIPT = path.resolve(ROOT, "..", "extension", "src", "userscript.js");

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function fail(msg) {
  console.error(`[verify-runtime-pack] FAIL: ${msg}`);
  process.exit(1);
}

const required = ["embedded-host.js", "lodash.min.js", "userscript.js"];
for (const name of required) {
  const p = path.join(PACK, name);
  if (!fs.existsSync(p)) fail(`missing ${p}`);
  const stat = fs.statSync(p);
  if (stat.size < 16) fail(`${name} is suspiciously small (${stat.size} bytes)`);
}

const packHash = sha256(path.join(PACK, "userscript.js"));
console.log(`[verify-runtime-pack] packaged userscript sha256=${packHash}`);

if (fs.existsSync(EXT_USERSCRIPT)) {
  const extHash = sha256(EXT_USERSCRIPT);
  if (packHash !== extHash) {
    fail(
      `userscript hash mismatch:\n  pack: ${packHash}\n  ext:  ${extHash}\nRun: npm run package:runtime`
    );
  }
  console.log("[verify-runtime-pack] OK (matches extension/src/userscript.js)");
} else {
  console.log(
    "[verify-runtime-pack] OK (extension userscript not present; pack integrity only)"
  );
}
