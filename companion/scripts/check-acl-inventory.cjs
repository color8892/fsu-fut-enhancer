#!/usr/bin/env node
/**
 * Exact-set ACL inventory checker (H2).
 *
 * Ensures every tauri::generate_handler! command is classified into exactly one of:
 *   - main-commands.toml (allow-main-commands)
 *   - embedded-http.toml (allow-embedded-http-request)
 * and that capability files match the intended isolation model.
 *
 * Exit 0 on success; non-zero with a clear diff on failure.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const LIB_RS = path.join(ROOT, "src-tauri", "src", "lib.rs");
const MAIN_TOML = path.join(ROOT, "src-tauri", "permissions", "main-commands.toml");
const HTTP_TOML = path.join(ROOT, "src-tauri", "permissions", "embedded-http.toml");
const DEFAULT_CAP = path.join(ROOT, "src-tauri", "capabilities", "default.json");
const FUT_CAP = path.join(ROOT, "src-tauri", "capabilities", "fut.json");

function fail(message) {
  console.error(`[check-acl-inventory] FAIL: ${message}`);
  process.exit(1);
}

function read(file) {
  if (!fs.existsSync(file)) fail(`missing file: ${file}`);
  return fs.readFileSync(file, "utf8");
}

/** Parse command identifiers from tauri::generate_handler![ ... ] */
function parseGenerateHandler(source) {
  const match = source.match(/generate_handler!\s*\[([\s\S]*?)\]/);
  if (!match) fail("could not find tauri::generate_handler![...] in lib.rs");
  const body = match[1];
  const names = [];
  for (const line of body.split("\n")) {
    const trimmed = line.replace(/\/\/.*$/, "").trim().replace(/,$/, "").trim();
    if (!trimmed) continue;
    // Accept bare identifiers only (no module paths for app commands).
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
      fail(`unexpected generate_handler entry: ${trimmed}`);
    }
    names.push(trimmed);
  }
  return names;
}

/** Extract commands.allow = [ "a", "b" ] from a permission TOML. */
function parseTomlAllowList(toml) {
  const match = toml.match(/commands\.allow\s*=\s*\[([\s\S]*?)\]/);
  if (!match) fail("could not find commands.allow = [...] in permission TOML");
  const names = [];
  for (const m of match[1].matchAll(/"([^"]+)"/g)) {
    names.push(m[1]);
  }
  return names;
}

function setEq(a, b) {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

function formatSet(s) {
  return [...s].sort().join(", ") || "(empty)";
}

function diffSets(labelA, setA, labelB, setB) {
  const onlyA = [...setA].filter((x) => !setB.has(x)).sort();
  const onlyB = [...setB].filter((x) => !setA.has(x)).sort();
  const parts = [];
  if (onlyA.length) parts.push(`only in ${labelA}: ${onlyA.join(", ")}`);
  if (onlyB.length) parts.push(`only in ${labelB}: ${onlyB.join(", ")}`);
  return parts.join("; ");
}

function main() {
  const handlerCmds = parseGenerateHandler(read(LIB_RS));
  const mainCmds = parseTomlAllowList(read(MAIN_TOML));
  const httpCmds = parseTomlAllowList(read(HTTP_TOML));

  const handlerSet = new Set(handlerCmds);
  const mainSet = new Set(mainCmds);
  const httpSet = new Set(httpCmds);

  if (handlerCmds.length !== handlerSet.size) {
    fail("duplicate commands in generate_handler!");
  }
  if (mainCmds.length !== mainSet.size) {
    fail("duplicate commands in main-commands.toml");
  }
  if (httpCmds.length !== httpSet.size) {
    fail("duplicate commands in embedded-http.toml");
  }

  // Main and FUT sets must be disjoint.
  for (const cmd of mainSet) {
    if (httpSet.has(cmd)) {
      fail(`command appears in both main and embedded-http: ${cmd}`);
    }
  }

  // Union of ACL sets must equal generate_handler exact set.
  const aclUnion = new Set([...mainSet, ...httpSet]);
  if (!setEq(handlerSet, aclUnion)) {
    fail(
      `generate_handler! vs ACL exact-set mismatch — ${diffSets(
        "handler",
        handlerSet,
        "main∪http",
        aclUnion
      )}`
    );
  }

  // HTTP bridge is exactly one known command.
  if (!setEq(httpSet, new Set(["embedded_http_request"]))) {
    fail(
      `embedded-http.toml must be exactly {embedded_http_request}; got {${formatSet(httpSet)}}`
    );
  }

  // Capabilities
  const defaultCap = JSON.parse(read(DEFAULT_CAP));
  const futCap = JSON.parse(read(FUT_CAP));

  if (!Array.isArray(defaultCap.windows) || !defaultCap.windows.includes("main")) {
    fail("default.json must include window main");
  }
  if (defaultCap.windows.includes("fut")) {
    fail("default.json must not include window fut");
  }
  const defaultPerms = new Set(defaultCap.permissions || []);
  if (!defaultPerms.has("core:default") || !defaultPerms.has("allow-main-commands")) {
    fail("default.json permissions must include core:default and allow-main-commands");
  }
  if (defaultPerms.has("allow-embedded-http-request")) {
    fail("main capability must not include allow-embedded-http-request");
  }

  if (!Array.isArray(futCap.windows) || !futCap.windows.includes("fut")) {
    fail("fut.json must include window fut");
  }
  if (futCap.windows.includes("main")) {
    fail("fut.json must not include window main");
  }
  if (futCap.local !== false) {
    fail("fut.json must set local: false");
  }
  const futPerms = new Set(futCap.permissions || []);
  if (!setEq(futPerms, new Set(["allow-embedded-http-request"]))) {
    fail(
      `fut.json permissions must be exactly {allow-embedded-http-request}; got {${formatSet(
        futPerms
      )}}`
    );
  }
  if (futPerms.has("core:default") || futPerms.has("allow-main-commands")) {
    fail("fut capability must not include core:default or allow-main-commands");
  }

  // Remote URL patterns — exact FUT hosts only (no localhost in production).
  const urls = (futCap.remote && futCap.remote.urls) || [];
  if (!urls.length) fail("fut.json remote.urls must not be empty");
  for (const url of urls) {
    if (typeof url !== "string") fail("fut remote url must be string");
    if (url.includes("localhost") || url.includes("127.0.0.1")) {
      fail("production fut.json must not include localhost / loopback");
    }
    if (
      !url.startsWith("https://www.ea.com/") &&
      !url.startsWith("https://www.easports.com/")
    ) {
      fail(`fut remote url host not allowlisted: ${url}`);
    }
  }

  // Snapshot of denied main commands for FUT (negative inventory).
  const futDenied = [
    "get_diagnostics",
    "get_settings",
    "update_settings",
    "open_fut_web_app",
    "privileged_main_only_ping",
    "reset_companion_settings",
    "export_diagnostics_json",
    "clear_embedded_site_data_cmd",
    "check_update_status"
  ];
  for (const cmd of futDenied) {
    if (!mainSet.has(cmd)) {
      fail(`expected denied main command missing from main ACL: ${cmd}`);
    }
  }

  console.log("[check-acl-inventory] OK");
  console.log(`  handler commands: ${handlerSet.size}`);
  console.log(`  main-only:        ${mainSet.size} → ${formatSet(mainSet)}`);
  console.log(`  fut-only:         ${formatSet(httpSet)}`);
  console.log(`  default windows:  ${(defaultCap.windows || []).join(", ")}`);
  console.log(`  fut windows:      ${(futCap.windows || []).join(", ")}`);
  console.log(`  fut remote urls:  ${urls.length}`);
}

main();
