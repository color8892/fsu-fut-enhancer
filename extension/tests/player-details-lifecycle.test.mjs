import assert from "node:assert/strict";
import { PatchLifecycleRegistry } from "../src/fsu/core/PatchLifecycleRegistry.js";
import {
  PLAYER_DETAILS_PATCH_IDS,
  installPlayerDetailsEntryPatch,
  registerPlayerDetailsLifecycleEvents
} from "../src/fsu/patches/panel-patches.js";
import {
  resolvePlayerDetailsItem,
  resolvePlayerDetailsTarget
} from "../src/fsu/ui/PlayerDetailsRenderer.js";

function install(registry, originalMethod, events) {
  return installPlayerDetailsEntryPatch({
    call: { panel: { quickRender: originalMethod } },
    events,
    patchLifecycle: registry
  });
}

export function runPlayerDetailsLifecycleTests() {
  const globalDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "UTQuickListPanelViewController"
  );
  try {
    const calls = [];
    class QuickListController {
      renderView(...args) {
        calls.push(["ea", this, args]);
        return "rendered";
      }
    }
    globalThis.UTQuickListPanelViewController = QuickListController;
    const originalMethod = QuickListController.prototype.renderView;
    const registry = new PatchLifecycleRegistry();
    const events = {
      detailsButtonSet(controller) {
        calls.push(["details", controller]);
      }
    };
    assert.equal(install(registry, originalMethod, events).status, "installed");
    const controller = new QuickListController();
    assert.equal(controller.renderView("desktop"), "rendered");
    assert.deepEqual(calls, [
      ["ea", controller, ["desktop"]],
      ["details", controller]
    ]);
    assert.equal(
      registry.isInstalled(PLAYER_DETAILS_PATCH_IDS.QUICK_LIST_RENDER),
      true
    );

    const lifecycleEvents = { ...events };
    registerPlayerDetailsLifecycleEvents({
      call: { panel: { quickRender: originalMethod } },
      events: lifecycleEvents,
      patchLifecycle: registry
    });
    assert.equal(
      lifecycleEvents.setPlayerDetailsPatchEnabled(false).status,
      "restored"
    );
    calls.length = 0;
    controller.renderView("disabled");
    assert.deepEqual(calls, [["ea", controller, ["disabled"]]]);
    assert.equal(
      lifecycleEvents.setPlayerDetailsPatchEnabled(true).status,
      "installed"
    );

    class MismatchedController {
      renderView() {}
    }
    globalThis.UTQuickListPanelViewController = MismatchedController;
    const mismatch = install(
      new PatchLifecycleRegistry(),
      originalMethod,
      events
    );
    assert.equal(mismatch.status, "verify-failed");

    delete globalThis.UTQuickListPanelViewController;
    const unsupported = install(
      new PatchLifecycleRegistry(),
      originalMethod,
      events
    );
    assert.equal(unsupported.status, "unsupported");

    const desktopPanel = {};
    const desktopController = { panel: desktopPanel };
    assert.deepEqual(
      resolvePlayerDetailsTarget({
        isPhone: false,
        currentController: {},
        rightController: desktopController
      }),
      { controller: desktopController, panelView: desktopPanel }
    );
    const mobilePanel = {};
    const mobileRoot = { panelView: mobilePanel };
    assert.deepEqual(
      resolvePlayerDetailsTarget({
        isPhone: true,
        currentController: { rootController: mobileRoot },
        rightController: null
      }),
      { controller: mobileRoot, panelView: mobilePanel }
    );
    assert.equal(
      resolvePlayerDetailsTarget({
        isPhone: false,
        currentController: {},
        rightController: null
      }),
      null
    );
    const player = { definitionId: 77, isPlayer: () => true };
    assert.deepEqual(resolvePlayerDetailsItem(player), {
      item: player,
      definitionId: 77
    });
    assert.equal(
      resolvePlayerDetailsItem({ definitionId: "77", isPlayer: () => true }),
      null
    );
    assert.equal(
      resolvePlayerDetailsItem({ definitionId: 77, isPlayer: () => false }),
      null
    );
  } finally {
    if (globalDescriptor) {
      Object.defineProperty(
        globalThis,
        "UTQuickListPanelViewController",
        globalDescriptor
      );
    } else {
      delete globalThis.UTQuickListPanelViewController;
    }
  }
}
