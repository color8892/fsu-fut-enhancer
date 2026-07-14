import assert from "assert";
import { PatchRegistry } from "../src/fsu/core/PatchRegistry.js";
import { installSquadBuilderPatches } from "../src/fsu/patches/squad-builder.js";

export function runSquadBuilderPatchTests() {
  const originalController = globalThis.UTSquadBuilderViewController;
  class SquadBuilderController {
    viewDidAppear() {
      this.originalAppearCount++;
    }
  }
  globalThis.UTSquadBuilderViewController = SquadBuilderController;

  try {
    const callBuild = [];
    const registry = new PatchRegistry();
    const deps = {
      call: { view: { build() { callBuild.push(this); } } },
      events: { createToggle: () => ({}) },
      fy: (key) => key,
      info: { set: { shield_league: [] }, build: {} },
      build: { set: () => {} }
    };
    assert.deepStrictEqual(installSquadBuilderPatches(deps, registry), [
      { id: "squad-builder.view-did-appear", status: "installed" }
    ]);

    const controller = new SquadBuilderController();
    controller.originalAppearCount = 0;
    controller.squad = { isSBC: () => false };
    controller.viewDidAppear();
    assert.strictEqual(controller.originalAppearCount, 0);
    assert.deepStrictEqual(callBuild, [controller]);

    assert.deepStrictEqual(installSquadBuilderPatches(deps, registry), [
      { id: "squad-builder.view-did-appear", status: "already-installed" }
    ]);
    assert.deepStrictEqual(registry.restore("squad-builder.view-did-appear"), {
      id: "squad-builder.view-did-appear",
      status: "restored"
    });
    controller.viewDidAppear();
    assert.strictEqual(controller.originalAppearCount, 1);
  } finally {
    globalThis.UTSquadBuilderViewController = originalController;
  }
}
