"use strict";

/**
 * Copy build-time FSU runtime artifacts into companion/resources/fsu for embedding.
 * Never downloads remote scripts.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const repo = path.resolve(root, "..");
const extension = path.join(repo, "extension");
const outDir = path.join(root, "resources", "fsu");

const sources = {
  lodash: path.join(extension, "vendor", "lodash.min.js"),
  userscript: path.join(extension, "src", "userscript.js")
};

function buildUserscript() {
  console.log("Building extension userscript…");
  execSync("npm run build", { cwd: extension, stdio: "inherit" });
}

function copy(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`Missing runtime source: ${src}`);
  }
  fs.copyFileSync(src, dest);
  const size = fs.statSync(dest).size;
  console.log(`Packed ${path.basename(dest)} (${size} bytes)`);
}

fs.mkdirSync(outDir, { recursive: true });
buildUserscript();
copy(sources.lodash, path.join(outDir, "lodash.min.js"));
copy(sources.userscript, path.join(outDir, "userscript.js"));

// Keep host script (authored in repo)
const host = path.join(outDir, "embedded-host.js");
if (!fs.existsSync(host)) {
  throw new Error("embedded-host.js missing");
}
console.log("Embedded runtime package ready:", outDir);
