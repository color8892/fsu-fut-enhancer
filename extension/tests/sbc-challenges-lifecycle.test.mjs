import assert from "node:assert/strict";
import { PatchLifecycleRegistry } from "../src/fsu/core/PatchLifecycleRegistry.js";
import {
  SBC_CHALLENGES_PATCH_IDS,
  registerSbcChallengesLifecycleEvents
} from "../src/fsu/patches/sbc-challenges.js";

export function runSbcChallengesLifecycleTests() {
  const globalDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "UTSBCChallengesViewController"
  );
  try {
    const calls = [];
    class ChallengesController {
      viewDidAppear(value) {
        calls.push(["ea", value]);
        return "appeared";
      }
    }
    globalThis.UTSBCChallengesViewController = ChallengesController;
    const registry = new PatchLifecycleRegistry();
    const events = {
      sbcSubPrice: () => calls.push(["price"]),
      createButton: () => {
        throw new Error("Malformed requirements must not add controls");
      },
      sbcListNeedCount: () => calls.push(["list"]),
      setSbcChallengesPatchEnabled: undefined
    };
    const deps = {
      info: { set: { info_sbcs: true } },
      events,
      sbcReadAdapter: {
        readRequirement: () => ({
          success: false,
          error: { code: "EA_CAPABILITY_UNAVAILABLE" }
        }),
        getSetName: () => ({
          success: false,
          error: { code: "EA_CAPABILITY_UNAVAILABLE" }
        })
      },
      eligibilityKeys: { TEAM_RATING: 44 },
      localize: (key) => key,
      patchLifecycle: registry
    };

    registerSbcChallengesLifecycleEvents(deps);
    assert.equal(events.setSbcChallengesPatchEnabled(true).status, "installed");
    const controller = new ChallengesController();
    controller.sbset = {
      id: 6,
      awards: [],
      challenges: new Map([
        [
          17,
          {
            isCompleted: () => false,
            eligibilityRequirements: [{}]
          }
        ]
      ])
    };
    controller.getView = () => ({});
    assert.equal(controller.viewDidAppear("first"), "appeared");
    assert.deepEqual(calls, [["ea", "first"], ["price"]]);
    assert.equal(
      registry.isInstalled(SBC_CHALLENGES_PATCH_IDS.VIEW_DID_APPEAR),
      true
    );

    assert.equal(
      events.setSbcChallengesPatchEnabled(false).status,
      "restored"
    );
    calls.length = 0;
    assert.equal(controller.viewDidAppear("disabled"), "appeared");
    assert.deepEqual(calls, [["ea", "disabled"]]);
    assert.equal(
      events.setSbcChallengesPatchEnabled(true).status,
      "installed"
    );

    delete globalThis.UTSBCChallengesViewController;
    assert.equal(
      events.setSbcChallengesPatchEnabled(false).status,
      "restored"
    );
    assert.equal(
      events.setSbcChallengesPatchEnabled(true).status,
      "unsupported"
    );
  } finally {
    if (globalDescriptor) {
      Object.defineProperty(
        globalThis,
        "UTSBCChallengesViewController",
        globalDescriptor
      );
    } else {
      delete globalThis.UTSBCChallengesViewController;
    }
  }
}
