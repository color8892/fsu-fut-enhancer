"use strict";

const esbuild = require("esbuild");
const path = require("path");

const root = path.resolve(__dirname, "..");
const entry = path.join(root, "src", "fsu", "index.js");
const outfile = path.join(root, "src", "userscript.js");

esbuild
  .build({
    entryPoints: [entry],
    bundle: true,
    outfile,
    format: "iife",
    platform: "browser",
    target: ["chrome100"],
    legalComments: "none",
    charset: "utf8",
    banner: {
      js: "// FSU EAFC FUT Web Enhancer — bundled Chrome extension userscript (v26.9.0)"
    }
  })
  .then(() => {
    console.log(`Built ${outfile}`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });