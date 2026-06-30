"use strict";

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const version = manifest.version;
const distDir = path.join(root, "dist");
const stageDir = path.join(distDir, "stage");
const zipName = `fsu-fut-enhancer-${version}.zip`;
const zipPath = path.join(distDir, zipName);

const runtimeFiles = [
  "src/background.js",
  "src/content-bridge.js",
  "src/page-runtime.js",
  "src/userscript.js"
];

function copyFile(relativePath) {
  const src = path.join(root, relativePath);
  if (!fs.existsSync(src)) {
    throw new Error(`Missing required file: ${relativePath}`);
  }

  const dest = path.join(stageDir, relativePath);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDirectory(relativePath) {
  const src = path.join(root, relativePath);
  if (!fs.existsSync(src)) {
    throw new Error(`Missing required directory: ${relativePath}`);
  }

  const dest = path.join(stageDir, relativePath);
  fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const entryRelative = path.join(relativePath, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(entryRelative);
      continue;
    }
    copyFile(entryRelative);
  }
}

function createZip() {
  if (process.platform === "win32") {
    const stageGlob = path.join(stageDir, "*");
    execSync(
      `powershell -NoProfile -Command "Compress-Archive -Path '${stageGlob}' -DestinationPath '${zipPath}' -Force"`,
      { stdio: "inherit" }
    );
    return;
  }

  execSync(`cd "${stageDir}" && zip -qr "${zipPath}" .`, { stdio: "inherit" });
}

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(stageDir, { recursive: true });

copyFile("manifest.json");
for (const file of runtimeFiles) {
  copyFile(file);
}
copyDirectory("vendor");

createZip();
fs.rmSync(stageDir, { recursive: true, force: true });

console.log(`Packaged ${zipPath}`);