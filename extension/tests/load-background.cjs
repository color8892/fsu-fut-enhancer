"use strict";

const fs = require("fs");
const path = require("path");

/** Load background.js exports in Node (MV3 entry stays .js for Chrome). */
function loadBackground(extensionRoot) {
  const filePath = path.join(extensionRoot, "src", "background.js");
  const code = fs.readFileSync(filePath, "utf8");
  const module = { exports: {} };
  const chromeStub = {
    runtime: { onMessage: { addListener() {} } },
    tabs: {}
  };

  // Run as classic script so module.exports matches Node test expectations.
  const runner = new Function(
    "module",
    "exports",
    "globalThis",
    "self",
    "chrome",
    "fetch",
    "URL",
    code
  );
  runner(module, module.exports, globalThis, globalThis, chromeStub, fetch, URL);

  return module.exports;
}

module.exports = { loadBackground };