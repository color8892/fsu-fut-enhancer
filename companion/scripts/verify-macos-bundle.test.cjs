#!/usr/bin/env node
/**
 * Deterministic unit tests for verify-macos-bundle helpers (no .app required).
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  readAuthoritativeVersion,
  parsePlistVersions,
  versionsCompatible
} = require("./verify-macos-bundle.cjs");

const ROOT = path.resolve(__dirname, "..");

function testParsePlist() {
  const sample = `
{
  "CFBundleShortVersionString" => "0.2.0-beta.1"
  "CFBundleVersion" => "0.2.0-beta.1"
}
`;
  const v = parsePlistVersions(sample);
  assert.equal(v.shortVersion, "0.2.0-beta.1");
  assert.equal(v.bundleVersion, "0.2.0-beta.1");
}

function testVersionsCompatible() {
  assert.equal(versionsCompatible("0.2.0-beta.1", "0.2.0-beta.1", null), true);
  assert.equal(versionsCompatible("0.2.0-beta.1", "0.2.0", "0.2.0"), false);
  assert.equal(versionsCompatible("0.2.0-beta.1", "0.2.0", "0.2.0-beta.1"), false);
  assert.equal(versionsCompatible("0.2.0-beta.1", "0.1.0", "0.1.0"), false);
  assert.equal(versionsCompatible("0.2.0-beta.1", null, null), false);
}

function testAuthoritativeVersionFromWorkspace() {
  const { version, sources } = readAuthoritativeVersion(ROOT);
  assert.ok(version.length > 0);
  assert.equal(sources.packageJson, version);
  if (sources.tauriConf) assert.equal(sources.tauriConf, version);
  if (sources.cargoToml) assert.equal(sources.cargoToml, version);
}

function testAuthoritativeVersionDetectsDrift() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fsu-ver-"));
  try {
    fs.writeFileSync(
      path.join(tmp, "package.json"),
      JSON.stringify({ version: "1.0.0" })
    );
    fs.mkdirSync(path.join(tmp, "src-tauri"), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, "src-tauri", "tauri.conf.json"),
      JSON.stringify({ version: "9.9.9" })
    );
    let failed = false;
    const origExit = process.exit;
    process.exit = (code) => {
      failed = code === 1;
      throw new Error("exit");
    };
    try {
      readAuthoritativeVersion(tmp);
    } catch {
      // expected
    } finally {
      process.exit = origExit;
    }
    assert.equal(failed, true, "version drift must fail");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

testParsePlist();
testVersionsCompatible();
testAuthoritativeVersionFromWorkspace();
testAuthoritativeVersionDetectsDrift();
console.log("verify-macos-bundle.test.cjs: OK");
