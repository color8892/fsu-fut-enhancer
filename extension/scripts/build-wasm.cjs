"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..", "..");
const extensionRoot = path.resolve(__dirname, "..");
const outDir = path.join(extensionRoot, "vendor", "fsu-wasm");
const wasmTarget = "wasm32-unknown-unknown";
const profile = "release";
const crateName = "fsu_wasm";
const wasmArtifact = path.join(
  repoRoot,
  "target",
  wasmTarget,
  profile,
  `${crateName}.wasm`
);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    cwd: repoRoot,
    shell: options.shell ?? false,
    ...options
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with status ${result.status}`);
  }
}

function ensureWasmTarget() {
  const rustupShow = spawnSync("rustup", ["target", "list", "--installed"], {
    cwd: repoRoot,
    encoding: "utf8"
  });

  if (rustupShow.status !== 0) {
    console.warn("[fsu-wasm] rustup unavailable; skipping WASM build.");
    return false;
  }

  if (!rustupShow.stdout.split(/\r?\n/).includes(wasmTarget)) {
    console.log(`[fsu-wasm] installing target ${wasmTarget}...`);
    run("rustup", ["target", "add", wasmTarget]);
  }

  return true;
}

function resolveWasmBindgen() {
  const localBin = path.join(repoRoot, "target", "release", "wasm-bindgen");
  const localBinExe = `${localBin}.exe`;

  if (fs.existsSync(localBinExe)) {
    return localBinExe;
  }

  if (fs.existsSync(localBin)) {
    return localBin;
  }

  const which = spawnSync("wasm-bindgen", ["--version"], {
    cwd: repoRoot,
    encoding: "utf8"
  });

  if (which.status === 0) {
    return "wasm-bindgen";
  }

  console.log("[fsu-wasm] installing wasm-bindgen-cli...");
  run("cargo", ["install", "wasm-bindgen-cli", "--locked"]);

  if (fs.existsSync(localBinExe)) {
    return localBinExe;
  }

  if (fs.existsSync(localBin)) {
    return localBin;
  }

  return "wasm-bindgen";
}

function main() {
  if (!ensureWasmTarget()) {
    return;
  }

  fs.mkdirSync(outDir, { recursive: true });

  run("cargo", ["build", "-p", "fsu-wasm", "--release", "--target", wasmTarget]);

  if (!fs.existsSync(wasmArtifact)) {
    throw new Error(`WASM artifact not found: ${wasmArtifact}`);
  }

  const wasmBindgen = resolveWasmBindgen();
  run(wasmBindgen, [
    "--target",
    "no-modules",
    "--out-dir",
    outDir,
    "--out-name",
    "fsu_core",
    wasmArtifact
  ]);

  const generatedJs = path.join(outDir, "fsu_core.js");
  const generatedWasm = path.join(outDir, "fsu_core_bg.wasm");

  if (!fs.existsSync(generatedJs) || !fs.existsSync(generatedWasm)) {
    throw new Error("[fsu-wasm] wasm-bindgen output missing.");
  }

  console.log(`[fsu-wasm] built ${generatedJs}`);
}

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}