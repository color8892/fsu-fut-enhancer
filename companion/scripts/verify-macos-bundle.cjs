#!/usr/bin/env node
/**
 * H6: post-build macOS .app checks (unsigned ad-hoc allowed).
 *
 * Runtime scripts (lodash / host / userscript) are compile-time embedded via
 * include_str! into the binary — they are NOT expected as loose Resources files.
 *
 * Version is compared against authoritative project metadata (package.json,
 * tauri.conf.json, Cargo.toml) — never a hardcoded stale string.
 *
 * Usage: node scripts/verify-macos-bundle.cjs [path/to/FSU Companion.app]
 *
 * Exit: 0 on success; nonzero on version mismatch, codesign failure, missing
 * binary/runtime marker, or pack hash mismatch.
 */

const { execSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const PACK = path.join(ROOT, "resources", "fsu");

function fail(msg) {
  console.error(`[verify-macos-bundle] FAIL: ${msg}`);
  process.exit(1);
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

/**
 * Read authoritative Companion version from project metadata.
 * package.json is primary; tauri.conf.json and Cargo.toml must agree.
 * @param {string} root
 * @returns {{ version: string, sources: Record<string, string> }}
 */
function readAuthoritativeVersion(root = ROOT) {
  const sources = {};
  const pkgPath = path.join(root, "package.json");
  const tauriPath = path.join(root, "src-tauri", "tauri.conf.json");
  const cargoPath = path.join(root, "src-tauri", "Cargo.toml");

  if (!fs.existsSync(pkgPath)) fail(`missing ${pkgPath}`);
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  sources.packageJson = String(pkg.version || "");
  if (!sources.packageJson) fail("package.json missing version");

  if (fs.existsSync(tauriPath)) {
    const tauri = JSON.parse(fs.readFileSync(tauriPath, "utf8"));
    sources.tauriConf = String(tauri.version || "");
  }
  if (fs.existsSync(cargoPath)) {
    const cargo = fs.readFileSync(cargoPath, "utf8");
    const m = cargo.match(/^version\s*=\s*"([^"]+)"/m);
    sources.cargoToml = m ? m[1] : "";
  }

  for (const [name, ver] of Object.entries(sources)) {
    if (name === "packageJson") continue;
    if (ver && ver !== sources.packageJson) {
      fail(
        `project metadata version drift: package.json=${sources.packageJson} ${name}=${ver}`
      );
    }
  }

  return { version: sources.packageJson, sources };
}

/**
 * Extract CFBundleShortVersionString / CFBundleVersion from plutil -p output.
 * @param {string} plistText
 * @returns {{ shortVersion: string|null, bundleVersion: string|null }}
 */
function parsePlistVersions(plistText) {
  const short =
    plistText.match(/"CFBundleShortVersionString"\s*=>\s*"([^"]+)"/) ||
    plistText.match(/CFBundleShortVersionString\s*=\s*([^;\s]+)/);
  const bundle =
    plistText.match(/"CFBundleVersion"\s*=>\s*"([^"]+)"/) ||
    plistText.match(/CFBundleVersion\s*=\s*([^;\s]+)/);
  return {
    shortVersion: short ? short[1].replace(/^"|"$/g, "") : null,
    bundleVersion: bundle ? bundle[1].replace(/^"|"$/g, "") : null
  };
}

/**
 * True only when CFBundleShortVersionString exactly matches project metadata.
 * A beta artifact must not silently pass as the corresponding stable/base version.
 * @param {string} projectVersion
 * @param {string|null} shortVersion
 * @param {string|null} bundleVersion
 */
function versionsCompatible(projectVersion, shortVersion, bundleVersion) {
  void bundleVersion;
  return shortVersion === projectVersion;
}

function findApp(explicit) {
  if (explicit) {
    if (!fs.existsSync(explicit)) fail(`app not found: ${explicit}`);
    return explicit;
  }
  const preferred = path.join(
    ROOT,
    "src-tauri",
    "target",
    "release",
    "bundle",
    "macos",
    "FSU Companion.app"
  );
  if (fs.existsSync(preferred)) return preferred;

  const target = path.join(ROOT, "src-tauri", "target");
  if (!fs.existsSync(target)) fail("no target/ — build first");
  const matches = [];
  function walk(dir, depth) {
    if (depth > 8) return;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      let st;
      try {
        st = fs.statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (name === "FSU Companion.app") matches.push(full);
        else walk(full, depth + 1);
      }
    }
  }
  walk(target, 0);
  if (!matches.length) fail("FSU Companion.app not found under src-tauri/target");
  return matches.sort().at(-1);
}

function verifyCodesign(appPath) {
  try {
    execSync(`codesign --verify --deep --strict "${appPath}"`, { stdio: "pipe" });
    return { ok: true, detail: "" };
  } catch (error) {
    const detail = String(error.stderr || error.message || error).slice(0, 500);
    return { ok: false, detail };
  }
}

function main(argv = process.argv) {
  const app = findApp(argv[2]);
  console.log(`[verify-macos-bundle] app=${app}`);

  const { version: expectedVersion, sources } = readAuthoritativeVersion(ROOT);
  console.log(
    `[verify-macos-bundle] authoritative version=${expectedVersion} sources=${JSON.stringify(sources)}`
  );

  const infoPlist = path.join(app, "Contents", "Info.plist");
  if (!fs.existsSync(infoPlist)) fail("missing Info.plist");

  let plistText;
  try {
    plistText = execSync(`plutil -p "${infoPlist}"`, { encoding: "utf8" });
  } catch (error) {
    fail(`plutil failed (required for version check): ${error.message}`);
  }
  const { shortVersion, bundleVersion } = parsePlistVersions(plistText);
  if (!versionsCompatible(expectedVersion, shortVersion, bundleVersion)) {
    fail(
      `Info.plist version mismatch: expected project ${expectedVersion}, ` +
        `got CFBundleShortVersionString=${shortVersion} CFBundleVersion=${bundleVersion}`
    );
  }
  console.log(
    `[verify-macos-bundle] Info.plist version OK short=${shortVersion} bundle=${bundleVersion}`
  );

  const macosDir = path.join(app, "Contents", "MacOS");
  if (!fs.existsSync(macosDir)) fail("missing MacOS/");
  const bins = fs
    .readdirSync(macosDir)
    .map((name) => path.join(macosDir, name))
    .filter((p) => fs.statSync(p).isFile());
  if (!bins.length) fail("no binaries in MacOS/");

  for (const bin of bins) {
    const size = fs.statSync(bin).size;
    if (size < 1_000_000) {
      fail(`binary too small for embedded runtime: ${path.basename(bin)} (${size} bytes)`);
    }
    console.log(
      `[verify-macos-bundle] binary ${path.basename(bin)} size=${size} sha256=${sha256(bin)}`
    );

    const buf = fs.readFileSync(bin);
    const hay = buf.toString("latin1");
    if (!hay.includes("__FSU_EMBEDDED_RUNTIME_V1__")) {
      fail("binary missing embedded runtime marker __FSU_EMBEDDED_RUNTIME_V1__");
    }
    console.log("[verify-macos-bundle] embedded runtime marker present in binary");
  }

  for (const name of ["embedded-host.js", "lodash.min.js", "userscript.js"]) {
    const p = path.join(PACK, name);
    if (!fs.existsSync(p)) fail(`missing pack source ${p}`);
  }
  const packHash = sha256(path.join(PACK, "userscript.js"));
  const extUserscript = path.resolve(ROOT, "..", "extension", "src", "userscript.js");
  if (fs.existsSync(extUserscript)) {
    const extHash = sha256(extUserscript);
    if (packHash !== extHash) {
      fail(`userscript pack/ext hash mismatch\n  pack=${packHash}\n  ext=${extHash}`);
    }
    console.log(`[verify-macos-bundle] pack userscript sha256=${packHash} (matches extension)`);
  } else {
    console.log(`[verify-macos-bundle] pack userscript sha256=${packHash}`);
  }

  const cs = verifyCodesign(app);
  if (!cs.ok) {
    fail(`codesign --verify --deep --strict failed: ${cs.detail}`);
  }
  console.log("[verify-macos-bundle] codesign --verify OK (ad-hoc allowed)");

  console.log("[verify-macos-bundle] OK");
}

// Export helpers for unit tests without requiring a built .app
module.exports = {
  readAuthoritativeVersion,
  parsePlistVersions,
  versionsCompatible,
  verifyCodesign,
  sha256,
  fail,
  main
};

if (require.main === module) {
  main();
}
