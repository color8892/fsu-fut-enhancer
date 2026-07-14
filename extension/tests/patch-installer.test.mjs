import assert from "assert";
import { PatchInstaller } from "../src/fsu/core/PatchInstaller.js";
import { PatchRegistry } from "../src/fsu/core/PatchRegistry.js";

const PHASES = [
  "installEarly",
  "installHubAndLists",
  "installSbcCore",
  "installMarketAndSquad",
  "installClubAndUi",
  "installLate"
];

function createInstaller(overrides = {}, patchRegistry = null) {
  const debugCalls = [];
  const installer = new PatchInstaller({
    debug: {
      log: (...args) => debugCalls.push(args)
    }
  }, patchRegistry);
  const calls = [];
  for (const phase of PHASES) {
    if (overrides[phase] !== undefined) {
      installer[phase] = () => {
        calls.push(phase);
        overrides[phase].call(installer);
      };
    } else {
      installer[phase] = () => {
        calls.push(phase);
      };
    }
  }
  return { installer, calls, debugCalls };
}

export function runPatchInstallerTests() {
  // 1. Basic installation of phases
  const { installer, calls } = createInstaller();
  const firstResult = installer.installAll();
  assert.strictEqual(firstResult.status, "installed");
  assert.deepStrictEqual(calls, PHASES);
  assert.deepStrictEqual(
    firstResult.phases.map((phase) => [phase.name, phase.status]),
    [
      ["early", "installed"],
      ["hub-and-lists", "installed"],
      ["sbc-core", "installed"],
      ["market-and-squad", "installed"],
      ["club-and-ui", "installed"],
      ["late", "installed"]
    ]
  );

  const repeatedResult = installer.installAll();
  assert.strictEqual(repeatedResult.status, "already-installed");
  assert.deepStrictEqual(calls, PHASES);

  // 2. Exception in a phase method directly (outside runFeaturePatch)
  const failed = createInstaller({
    installSbcCore() {
      throw new Error("missing EA SBC runtime");
    }
  });
  const failedResult = failed.installer.installAll();
  assert.strictEqual(failedResult.status, "completed-with-errors");
  assert.deepStrictEqual(failed.calls, PHASES);
  assert.deepStrictEqual(failedResult.phases[2], {
    name: "sbc-core",
    status: "failed",
    error: "missing EA SBC runtime"
  });
  assert.deepStrictEqual(failed.debugCalls, [
    ["Patch phase failed", "sbc-core", new Error("missing EA SBC runtime")]
  ]);

  // 3. Feature-level duplicate protection and failure isolation using PatchRegistry
  const registry = new PatchRegistry();
  let subPatch1Count = 0;
  let subPatch2Count = 0;
  let subPatch3Count = 0;

  const isolated = createInstaller({
    installEarly() {
      this.runFeaturePatch("sub-patch-1", () => {
        subPatch1Count++;
      });
      this.runFeaturePatch("sub-patch-2", () => {
        subPatch2Count++;
        throw new Error("sub-patch-2 error");
      });
      this.runFeaturePatch("sub-patch-3", () => {
        subPatch3Count++;
      });
    }
  }, registry);

  const isolatedResult = isolated.installer.installAll();
  assert.strictEqual(isolatedResult.status, "completed-with-errors");
  assert.strictEqual(subPatch1Count, 1);
  assert.strictEqual(subPatch2Count, 1);
  assert.strictEqual(subPatch3Count, 1); // sub-patch-3 ran despite sub-patch-2 failure!

  assert.deepStrictEqual(isolatedResult.phases[0], {
    name: "early",
    status: "failed",
    error: "sub-patch-2: sub-patch-2 error",
    features: [
      { id: "sub-patch-1", status: "installed" },
      { id: "sub-patch-2", status: "failed", error: "sub-patch-2 error" },
      { id: "sub-patch-3", status: "installed" }
    ]
  });

  // Verify that running again does not execute subPatch1 or subPatch3 again
  // (We instantiate a new PatchInstaller instance but share the same PatchRegistry)
  const repeatedRegistryRuns = createInstaller({
    installEarly() {
      this.runFeaturePatch("sub-patch-1", () => {
        subPatch1Count++;
      });
      this.runFeaturePatch("sub-patch-3", () => {
        subPatch3Count++;
      });
    }
  }, registry);

  const repeatedRegistryResult = repeatedRegistryRuns.installer.installAll();
  assert.strictEqual(repeatedRegistryResult.status, "installed");
  assert.strictEqual(subPatch1Count, 1); // Not incremented! (Duplicate protection)
  assert.strictEqual(subPatch3Count, 1); // Not incremented!
  assert.deepStrictEqual(repeatedRegistryResult.phases[0], {
    name: "early",
    status: "installed",
    features: [
      { id: "sub-patch-1", status: "already-installed" },
      { id: "sub-patch-3", status: "already-installed" }
    ]
  });
}
