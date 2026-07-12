import assert from "assert";
import { PatchInstaller } from "../src/fsu/core/PatchInstaller.js";

const PHASES = [
  "installEarly",
  "installHubAndLists",
  "installSbcCore",
  "installMarketAndSquad",
  "installClubAndUi",
  "installLate"
];

function createInstaller(overrides = {}) {
  const debugCalls = [];
  const installer = new PatchInstaller({
    debug: {
      log: (...args) => debugCalls.push(args)
    }
  });
  const calls = [];
  for (const phase of PHASES) {
    installer[phase] = () => {
      calls.push(phase);
      overrides[phase]?.();
    };
  }
  return { installer, calls, debugCalls };
}

export function runPatchInstallerTests() {
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
}
