import assert from "assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  analyzeHooks,
  buildBaseline,
  extractFsuHooks,
  hasPrototypeMethod,
  patchRequiresEaMethod,
} from "../scripts/lib/ea-bundle-check.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(extensionRoot, "..");
const patchesDir = path.join(extensionRoot, "src", "fsu", "patches");
const bundleDir = path.join(extensionRoot, "data", "ea-bundles");
const baselinePath = path.join(extensionRoot, "data", "ea-bundle-baseline.json");

export function runEaBundleCheckTests() {
  const sbcFill = fs.readFileSync(path.join(patchesDir, "sbc-fill-patches.js"), "utf8");
  const clubSelectSearch = fs.readFileSync(
    path.join(patchesDir, "club-select-search-patches.js"),
    "utf8",
  );

  assert.strictEqual(
    patchRequiresEaMethod(sbcFill, "UTSBCService", "loadChallengeData"),
    false,
    "loadChallengeData is FSU-defined",
  );
  assert.strictEqual(
    patchRequiresEaMethod(clubSelectSearch, "UTItemDetailsNavigationController", "setSquadContext"),
    false,
    "setSquadContext is FSU-defined",
  );

  const sbcHub = fs.readFileSync(path.join(patchesDir, "sbc-hub.js"), "utf8");
  assert.strictEqual(
    patchRequiresEaMethod(sbcHub, "UTSBCHubView", "populateTiles"),
    true,
    "populateTiles wraps EA original",
  );

  if (!fs.existsSync(bundleDir)) {
    console.log("ea-bundle-check integration tests skipped: no local EA bundles");
    return;
  }

  const hooks = extractFsuHooks(patchesDir);
  assert.ok(hooks.length >= 90, "expected at least 90 FSU hooks");

  const baseline = buildBaseline(bundleDir, patchesDir);
  const broken = baseline.hooks.filter(
    (hook) => hook.status === "missing-class" || hook.status === "missing-method",
  );
  assert.strictEqual(broken.length, 0, `broken hooks: ${broken.map((h) => h.className).join(", ")}`);

  const compiled4 = fs.readFileSync(path.join(bundleDir, "compiled_4.js"), "utf8");
  assert.ok(
    hasPrototypeMethod(compiled4, "UTSBCHubView", "populateTiles"),
    "baseline bundle should contain UTSBCHubView.populateTiles",
  );

  assert.ok(fs.existsSync(baselinePath), "ea-bundle-baseline.json should exist");
  const saved = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  assert.strictEqual(saved.version, 1);
  assert.ok(saved.hooks.length >= 90);
}