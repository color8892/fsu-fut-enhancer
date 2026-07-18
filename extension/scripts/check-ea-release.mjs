#!/usr/bin/env node
/**
 * Release EA compatibility gate — fail closed when bundles are missing.
 *
 * Sources (first match wins):
 * 1. --bundles <dir>
 * 2. env EA_BUNDLES_DIR
 * 3. extension/data/ea-bundles
 *
 * When FSU_REQUIRE_EA_BUNDLES=1 (set by verify:release / release CI),
 * a missing directory exits non-zero. PR CI should not set that flag
 * unless sanitized fixtures are present.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const requireBundles =
  process.env.FSU_REQUIRE_EA_BUNDLES === "1" || args.includes("--require");

const bundleArgIndex = args.indexOf("--bundles");
const fromArg =
  bundleArgIndex >= 0 ? path.resolve(args[bundleArgIndex + 1]) : null;
const fromEnv =
  process.env.EA_BUNDLES_DIR && process.env.EA_BUNDLES_DIR.trim()
    ? path.resolve(process.env.EA_BUNDLES_DIR.trim())
    : null;
const defaultDir = path.join(extensionRoot, "data", "ea-bundles");
const bundleDir = fromArg || fromEnv || defaultDir;

if (!fs.existsSync(bundleDir)) {
  const message = `EA bundle directory not found: ${bundleDir}`;
  if (requireBundles) {
    console.error(message);
    console.error(
      "Release gate is fail-closed. Provide --bundles, EA_BUNDLES_DIR, or data/ea-bundles."
    );
    process.exit(1);
  }
  console.log(`${message} (skipped: FSU_REQUIRE_EA_BUNDLES not set)`);
  process.exit(0);
}

const result = spawnSync(
  process.execPath,
  [path.join(__dirname, "ea-bundle-check.mjs"), "--bundles", bundleDir],
  { stdio: "inherit" }
);
process.exit(result.status ?? 1);
