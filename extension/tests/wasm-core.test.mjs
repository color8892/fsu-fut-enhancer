import assert from "assert";
import { getWasmCoreVersion, isWasmCoreReady } from "../src/fsu/infra/WasmCore.js";

export function runWasmCoreTests() {
  assert.strictEqual(isWasmCoreReady(), false);
  assert.strictEqual(getWasmCoreVersion(), null);
}