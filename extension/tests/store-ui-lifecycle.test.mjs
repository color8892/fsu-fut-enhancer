import assert from "node:assert/strict";
import { PatchLifecycleRegistry } from "../src/fsu/core/PatchLifecycleRegistry.js";
import {
  STORE_PATCH_IDS,
  installStoreCategoryPatch,
  installStoreHubPatch,
  installStoreHubPackCountPatch,
  installStorePackAnimationPatch,
  installStoreRevealPatch
} from "../src/fsu/patches/store.js";

function saveGlobals(names) {
  return new Map(
    names.map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name)
    ])
  );
}

function restoreGlobals(descriptors) {
  for (const [name, descriptor] of descriptors) {
    if (descriptor) {
      Object.defineProperty(globalThis, name, descriptor);
    } else {
      delete globalThis[name];
    }
  }
}

export function runStoreUiLifecycleTests() {
  const globalDescriptors = saveGlobals([
    "UTStoreRevealModalListView",
    "UTPackAnimationViewController",
    "UTStoreViewController",
    "UTStoreHubViewController",
    "UTStoreHubView"
  ]);

  try {
    class RevealView {
      addItems(...args) {
        return ["ea-reveal", ...args];
      }
    }
    class AnimationController {}
    class StoreViewController {
      setCategory(...args) {
        return ["ea-category", ...args];
      }
    }
    class StoreHubController {
      onPackLoadComplete(...args) {
        return ["ea-hub", ...args];
      }
    }
    class StoreHubView {
      constructor(root) {
        this._packsTile = {
          getRootElement: () => root
        };
      }

      togglePackTileDisplay(...args) {
        return ["ea-pack-count", ...args];
      }
    }
    globalThis.UTStoreRevealModalListView = RevealView;
    globalThis.UTPackAnimationViewController = AnimationController;
    globalThis.UTStoreViewController = StoreViewController;
    globalThis.UTStoreHubViewController = StoreHubController;
    globalThis.UTStoreHubView = StoreHubView;

    const originals = {
      reveal: RevealView.prototype.addItems,
      category: StoreViewController.prototype.setCategory,
      hub: StoreHubController.prototype.onPackLoadComplete,
      packCount: StoreHubView.prototype.togglePackTileDisplay
    };
    const descriptors = {
      reveal: Object.getOwnPropertyDescriptor(
        RevealView.prototype,
        "addItems"
      ),
      category: Object.getOwnPropertyDescriptor(
        StoreViewController.prototype,
        "setCategory"
      ),
      hub: Object.getOwnPropertyDescriptor(
        StoreHubController.prototype,
        "onPackLoadComplete"
      ),
      packCount: Object.getOwnPropertyDescriptor(
        StoreHubView.prototype,
        "togglePackTileDisplay"
      )
    };
    const calls = [];
    function revealPatch(...args) {
      calls.push(["reveal", ...args]);
    }
    function animationPatch(...args) {
      calls.push(["animation", ...args]);
    }
    function categoryPatch(...args) {
      calls.push(["category", ...args]);
    }
    function hubPatch(...args) {
      calls.push(["hub", ...args]);
    }
    const call = {
      plist: { storeReveal: originals.reveal },
      other: {
        store: {
          setCategory: originals.category,
          onPackLoadComplete: originals.hub
        }
      }
    };
    const registry = new PatchLifecycleRegistry();
    const installers = [
      () =>
        installStoreRevealPatch({
          call,
          patchLifecycle: registry,
          patchedMethod: revealPatch
        }),
      () =>
        installStorePackAnimationPatch({
          patchLifecycle: registry,
          patchedMethod: animationPatch
        }),
      () =>
        installStoreCategoryPatch({
          call,
          patchLifecycle: registry,
          patchedMethod: categoryPatch
        }),
      () =>
        installStoreHubPatch({
          call,
          patchLifecycle: registry,
          patchedMethod: hubPatch
        }),
      () =>
        installStoreHubPackCountPatch({
          patchLifecycle: registry,
          getPackCount: () => 4
        })
    ];
    assert.deepEqual(
      installers.map((install) => install().status),
      ["installed", "installed", "installed", "installed", "installed"]
    );
    assert.equal(new RevealView().addItems("a"), undefined);
    assert.equal(new AnimationController().runAnimation("b"), undefined);
    assert.equal(new StoreViewController().setCategory("c"), undefined);
    assert.equal(
      new StoreHubController().onPackLoadComplete("d"),
      undefined
    );
    const packTileAttributes = new Map();
    const packTileRoot = {
      setAttribute: (name, value) => packTileAttributes.set(name, value),
      removeAttribute: (name) => packTileAttributes.delete(name)
    };
    assert.deepEqual(
      new StoreHubView(packTileRoot).togglePackTileDisplay(true),
      ["ea-pack-count", true]
    );
    assert.equal(packTileAttributes.get("data-num"), "4");
    new StoreHubView(packTileRoot).togglePackTileDisplay(false);
    assert.equal(packTileAttributes.has("data-num"), false);
    assert.deepEqual(calls, [
      ["reveal", "a"],
      ["animation", "b"],
      ["category", "c"],
      ["hub", "d"]
    ]);
    assert.deepEqual(
      installers.map((install) => install().status),
      [
        "already-installed",
        "already-installed",
        "already-installed",
        "already-installed",
        "already-installed"
      ]
    );

    assert.equal(
      registry.restore(STORE_PATCH_IDS.REVEAL_LIST).status,
      "restored"
    );
    assert.deepEqual(
      Object.getOwnPropertyDescriptor(RevealView.prototype, "addItems"),
      descriptors.reveal
    );
    assert.equal(
      registry.restore(STORE_PATCH_IDS.PACK_ANIMATION).status,
      "restored"
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        AnimationController.prototype,
        "runAnimation"
      ),
      false
    );
    assert.equal(
      registry.restore(STORE_PATCH_IDS.CATEGORY_NAVIGATION).status,
      "restored"
    );
    assert.deepEqual(
      Object.getOwnPropertyDescriptor(
        StoreViewController.prototype,
        "setCategory"
      ),
      descriptors.category
    );
    assert.equal(
      registry.restore(STORE_PATCH_IDS.HUB_TILES).status,
      "restored"
    );
    assert.deepEqual(
      Object.getOwnPropertyDescriptor(
        StoreHubController.prototype,
        "onPackLoadComplete"
      ),
      descriptors.hub
    );
    assert.equal(
      registry.restore(STORE_PATCH_IDS.HUB_PACK_COUNT).status,
      "restored"
    );
    assert.deepEqual(
      Object.getOwnPropertyDescriptor(
        StoreHubView.prototype,
        "togglePackTileDisplay"
      ),
      descriptors.packCount
    );
    assert.strictEqual(
      StoreHubView.prototype.togglePackTileDisplay,
      originals.packCount
    );

    class MismatchedReveal {
      addItems() {}
    }
    globalThis.UTStoreRevealModalListView = MismatchedReveal;
    const mismatchMethod = MismatchedReveal.prototype.addItems;
    assert.equal(
      installStoreRevealPatch({
        call,
        patchLifecycle: new PatchLifecycleRegistry(),
        patchedMethod: revealPatch
      }).status,
      "verify-failed"
    );
    assert.strictEqual(MismatchedReveal.prototype.addItems, mismatchMethod);

    delete globalThis.UTStoreRevealModalListView;
    const isolatedRegistry = new PatchLifecycleRegistry();
    assert.equal(
      installStoreRevealPatch({
        call,
        patchLifecycle: isolatedRegistry,
        patchedMethod: revealPatch
      }).status,
      "unsupported"
    );
    assert.equal(
      installStoreCategoryPatch({
        call,
        patchLifecycle: isolatedRegistry,
        patchedMethod: categoryPatch
      }).status,
      "installed"
    );
    assert.equal(
      isolatedRegistry.isInstalled(
        STORE_PATCH_IDS.CATEGORY_NAVIGATION
      ),
      true
    );
  } finally {
    restoreGlobals(globalDescriptors);
  }
}
