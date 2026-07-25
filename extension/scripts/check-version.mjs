#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(extensionRoot, "..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(extensionRoot, relativePath), "utf8"));
}

const manifest = readJson("manifest.json");
const packageJson = readJson("package.json");
const packageLock = readJson("package-lock.json");
const version = manifest.version;
const versions = new Map([
  ["manifest.json", version],
  ["package.json", packageJson.version],
  ["package-lock.json", packageLock.version],
  ["package-lock root package", packageLock.packages?.[""]?.version]
]);

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error(`Unsupported extension version format: ${version}`);
}

for (const [source, candidate] of versions) {
  if (candidate !== version) {
    throw new Error(`Version mismatch: ${source} has ${candidate}; expected ${version}`);
  }
}

const gmVersion = version.split(".").slice(0, 2).join(".");
const pageRuntime = fs.readFileSync(
  path.join(extensionRoot, "src", "page-runtime.js"),
  "utf8"
);
if (!pageRuntime.includes(`version: "${gmVersion}"`)) {
  throw new Error(`src/page-runtime.js must expose GM_info version ${gmVersion}`);
}

const readme = fs.readFileSync(path.join(repositoryRoot, "README.md"), "utf8");
if (!readme.includes(`version-${version}-blue`)) {
  throw new Error(`README version badge must use ${version}`);
}

const tagIndex = process.argv.indexOf("--tag");
if (tagIndex >= 0 && !process.argv[tagIndex + 1]) {
  throw new Error("--tag requires a value");
}
const tag =
  tagIndex >= 0
    ? process.argv[tagIndex + 1]
    : process.env.GITHUB_REF_TYPE === "tag"
      ? process.env.GITHUB_REF_NAME
      : null;
if (tag && tag !== `v${version}`) {
  throw new Error(`Release tag ${tag} does not match extension version v${version}`);
}

console.log(`Version check OK: ${version}${tag ? ` (${tag})` : ""}`);
