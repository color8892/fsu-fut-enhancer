import assert from "assert";
import { PatchLifecycleRegistry } from "../src/fsu/core/PatchLifecycleRegistry.js";
import { registerAppInitEvents } from "../src/fsu/patches/app-init.js";

function createDeps(patchLifecycle, overrides = {}) {
  return {
    events: {},
    info: {
      base: {},
      evolutions: {
        newCount: 1,
        html: "new evolution"
      }
    },
    fy: (key) => key,
    patchLifecycle,
    ...overrides
  };
}

export function runAppInitLifecycleTests() {
  const globalDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "UTHomeHubView"
  );

  try {
    class HomeHubView {}
    globalThis.UTHomeHubView = HomeHubView;

    const inserted = [];
    const events = {
      createDF: (html) => ({ html })
    };
    const info = {
      base: {},
      evolutions: {
        newCount: 1,
        html: "new evolution"
      }
    };
    const registry = new PatchLifecycleRegistry();
    const deps = createDeps(registry, { events, info });

    registerAppInitEvents(deps);
    const installedMethod = HomeHubView.prototype.getAcademyTile;
    assert.strictEqual(typeof installedMethod, "function");
    assert.strictEqual(registry.isInstalled("home.academy-tile"), true);
    assert.strictEqual(registry.getDiagnostics().at(-1).status, "installed");

    const academyTile = {
      __root: {
        querySelector: () => null
      },
      __tileContent: {
        before: (element) => inserted.push(element)
      }
    };
    const view = new HomeHubView();
    view._academyTile = academyTile;
    assert.strictEqual(view.getAcademyTile(), academyTile);
    assert.deepStrictEqual(inserted, [{ html: '<div class="fsu-task">new evolution</div>' }]);

    registerAppInitEvents(deps);
    assert.strictEqual(HomeHubView.prototype.getAcademyTile, installedMethod);
    assert.strictEqual(registry.getDiagnostics().at(-1).status, "already-installed");

    assert.strictEqual(registry.restore("home.academy-tile").status, "restored");
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(
        HomeHubView.prototype,
        "getAcademyTile"
      ),
      false
    );

    class ExistingHomeHubView {}
    const existingMethod = function existingMethod() {
      return "ea-owned";
    };
    ExistingHomeHubView.prototype.getAcademyTile = existingMethod;
    globalThis.UTHomeHubView = ExistingHomeHubView;
    const existingRegistry = new PatchLifecycleRegistry();
    registerAppInitEvents(createDeps(existingRegistry));
    assert.strictEqual(
      existingRegistry.getDiagnostics().at(-1).status,
      "verify-failed"
    );
    assert.strictEqual(
      ExistingHomeHubView.prototype.getAcademyTile,
      existingMethod
    );

    class ParentHomeHubView {
      getAcademyTile() {
        return "inherited-ea-method";
      }
    }
    class InheritedHomeHubView extends ParentHomeHubView {}
    globalThis.UTHomeHubView = InheritedHomeHubView;
    const inheritedRegistry = new PatchLifecycleRegistry();
    registerAppInitEvents(createDeps(inheritedRegistry));
    assert.strictEqual(
      inheritedRegistry.getDiagnostics().at(-1).status,
      "verify-failed"
    );
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(
        InheritedHomeHubView.prototype,
        "getAcademyTile"
      ),
      false
    );

    delete globalThis.UTHomeHubView;
    const unsupportedRegistry = new PatchLifecycleRegistry();
    registerAppInitEvents(createDeps(unsupportedRegistry));
    const unsupported = unsupportedRegistry.getDiagnostics().at(-1);
    assert.strictEqual(unsupported.status, "unsupported");
    assert.deepStrictEqual(unsupported.missing, [
      "UTHomeHubView.prototype.getAcademyTile"
    ]);
  } finally {
    if (globalDescriptor) {
      Object.defineProperty(globalThis, "UTHomeHubView", globalDescriptor);
    } else {
      delete globalThis.UTHomeHubView;
    }
  }
}
