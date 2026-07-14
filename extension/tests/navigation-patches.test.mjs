import assert from "assert";
import { PatchRegistry } from "../src/fsu/core/PatchRegistry.js";
import { installNavigationPatches } from "../src/fsu/patches/navigation.js";

export function runNavigationPatchTests() {
  const originalNavigation = globalThis.UTGameFlowNavigationController;
  const originalAcademy = globalThis.UTAcademyHubViewController;

  class NavigationController {
    didPush(controller) {
      this.directPushes.push(controller);
    }

    viewDidAppear() {
      this.didAppearCount++;
    }
  }
  class AcademyController {}
  globalThis.UTGameFlowNavigationController = NavigationController;
  globalThis.UTAcademyHubViewController = AcademyController;

  try {
    const pushed = [];
    const registry = new PatchRegistry();
    const info = { douagain: {}, set: { sbc_headentrance: false } };
    const results = installNavigationPatches({
      call: { view: { push(controller) { pushed.push(controller); } } },
      events: { createElementWithConfig: () => ({}) },
      info,
      isPhone: () => false,
      SBCCount: { createElement: () => {} }
    }, registry);

    assert.deepStrictEqual(
      results.map((result) => [result.id, result.status]),
      [
        ["navigation.did-push", "installed"],
        ["navigation.view-did-appear", "installed"]
      ]
    );

    const controller = new NavigationController();
    controller.directPushes = [];
    controller.didPush({ className: "UTSBCSquadSplitViewController" });
    assert.strictEqual(controller.directPushes.length, 0);
    assert.deepStrictEqual(pushed, [{ className: "UTSBCSquadSplitViewController" }]);

    assert.deepStrictEqual(registry.restore("navigation.did-push"), {
      id: "navigation.did-push",
      status: "restored"
    });
    controller.didPush({ className: "restored" });
    assert.deepStrictEqual(controller.directPushes, [{ className: "restored" }]);
    assert.deepStrictEqual(registry.restore("navigation.view-did-appear"), {
      id: "navigation.view-did-appear",
      status: "restored"
    });
  } finally {
    globalThis.UTGameFlowNavigationController = originalNavigation;
    globalThis.UTAcademyHubViewController = originalAcademy;
  }
}
