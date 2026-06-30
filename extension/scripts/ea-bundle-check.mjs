#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  buildBaseline,
  bundleHashChanges,
  compareToBaseline,
  formatReport,
} from "./lib/ea-bundle-check.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const updateBaseline = args.includes("--update-baseline");
const jsonOut = args.includes("--json");
const bundleArgIndex = args.indexOf("--bundles");
const defaultBundleDir = path.join(extensionRoot, "data", "ea-bundles");
const bundleDir = bundleArgIndex >= 0
  ? path.resolve(args[bundleArgIndex + 1])
  : defaultBundleDir;
const patchesDir = path.join(extensionRoot, "src", "fsu", "patches");
const baselinePath = path.join(extensionRoot, "data", "ea-bundle-baseline.json");

if (!fs.existsSync(bundleDir)) {
  console.error(`Bundle directory not found: ${bundleDir}`);
  console.error("Pass --bundles <path> containing compiled_*.js from FUT Network");
  process.exit(1);
}

const current = buildBaseline(bundleDir, patchesDir);

if (updateBaseline) {
  fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
  fs.writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  console.log(`Baseline updated: ${baselinePath}`);
}

let compared = null;
let bundleChanges = [];

if (fs.existsSync(baselinePath) && !updateBaseline) {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  compared = compareToBaseline(current, baseline);
  bundleChanges = bundleHashChanges(current, baseline);
}

const report = formatReport(current, { compared, bundleChanges });

if (jsonOut) {
  console.log(JSON.stringify({ current, compared, bundleChanges }, null, 2));
} else {
  console.log(report);
}

const hooks = compared || current.hooks;
const hasBroken = hooks.some(
  (hook) => hook.status === "missing-class" || hook.status === "missing-method",
);
if (hasBroken) {
  process.exit(2);
}