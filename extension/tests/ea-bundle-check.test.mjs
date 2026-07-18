import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import {
  buildBaseline,
  extractFsuHooks,
  hasPrototypeMethod,
  patchRequiresEaMethod,
} from "../scripts/lib/ea-bundle-check.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(__dirname, "..");
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

  const hooks = extractFsuHooks(patchesDir);
  assert.ok(hooks.length >= 90, "expected at least 90 FSU hooks");

  const sanitizedDir = fs.mkdtempSync(path.join(os.tmpdir(), "fsu-ea-hooks-"));
  try {
    const classNames = [...new Set(hooks.map((hook) => hook.className))];
    const declarations = classNames.map((className) => `${className}=function(){};`);
    const methods = hooks
      .filter((hook) => hook.methodName && hook.requiresEaMethod)
      .map(
        (hook) =>
          `${hook.className}.prototype.${hook.methodName}=function(){};`,
      );
    fs.writeFileSync(
      path.join(sanitizedDir, "compiled_1.js"),
      [...declarations, ...methods].join("\n"),
    );
    const sanitized = buildBaseline(sanitizedDir, patchesDir);
    const broken = sanitized.hooks.filter(
      (hook) =>
        hook.status === "missing-class" || hook.status === "missing-method",
    );
    assert.strictEqual(
      broken.length,
      0,
      `sanitized hook fixture missing: ${broken.map((hook) => hook.className).join(", ")}`,
    );
  } finally {
    fs.rmSync(sanitizedDir, { recursive: true, force: true });
  }

  assert.ok(fs.existsSync(baselinePath), "ea-bundle-baseline.json should exist");
  const saved = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  assert.strictEqual(saved.version, 1);
  const hookKey = (hook) =>
    hook.methodName ? `${hook.className}.${hook.methodName}` : hook.className;
  assert.deepStrictEqual(
    [...new Set(hooks.map(hookKey))].sort(),
    [...new Set(saved.hooks.map(hookKey))].sort(),
    "EA hook inventory changed; regenerate and review the baseline",
  );

  if (!fs.existsSync(bundleDir)) {
    console.log("ea-bundle-check integration tests skipped: no local EA bundles");
    return;
  }

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

  assert.ok(saved.hooks.length >= 90);
}
