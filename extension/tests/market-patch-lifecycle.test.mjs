import assert from "node:assert/strict";
import { PatchLifecycleRegistry } from "../src/fsu/core/PatchLifecycleRegistry.js";
import {
  MARKET_PATCH_IDS,
  disableMarketSearchGeneratePatch,
  installMarketSearchGeneratePatch,
  registerMarketLifecycleEvents
} from "../src/fsu/patches/market.js";

function install(registry, originalMethod) {
  return installMarketSearchGeneratePatch({
    call: { view: { market: originalMethod } },
    patchLifecycle: registry
  });
}

export function runMarketPatchLifecycleTests() {
  const globalDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "UTMarketSearchView"
  );

  try {
    const calls = [];
    class MarketSearchView {
      _generate(...args) {
        calls.push({ receiver: this, args });
        return "ea-result";
      }
    }
    globalThis.UTMarketSearchView = MarketSearchView;
    const originalMethod = MarketSearchView.prototype._generate;
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      MarketSearchView.prototype,
      "_generate"
    );
    const registry = new PatchLifecycleRegistry();

    const installed = install(registry, originalMethod);
    assert.equal(installed.status, "installed");
    assert.equal(
      registry.isInstalled(MARKET_PATCH_IDS.SEARCH_VIEW_GENERATE),
      true
    );
    const patchedMethod = MarketSearchView.prototype._generate;
    assert.notStrictEqual(patchedMethod, originalMethod);
    const patchedDescriptor = Object.getOwnPropertyDescriptor(
      MarketSearchView.prototype,
      "_generate"
    );
    assert.equal(patchedDescriptor.configurable, originalDescriptor.configurable);
    assert.equal(patchedDescriptor.enumerable, originalDescriptor.enumerable);
    assert.equal(patchedDescriptor.writable, originalDescriptor.writable);

    const view = new MarketSearchView();
    view._generated = false;
    assert.equal(view._generate("first", 2), undefined);
    assert.deepEqual(calls, [{ receiver: view, args: ["first", 2] }]);

    view._generated = true;
    view._generate("blocked");
    assert.equal(calls.length, 1);

    assert.equal(install(registry, originalMethod).status, "already-installed");
    assert.strictEqual(MarketSearchView.prototype._generate, patchedMethod);

    const disabled = disableMarketSearchGeneratePatch(registry);
    assert.equal(disabled.status, "restored");
    assert.deepEqual(
      Object.getOwnPropertyDescriptor(MarketSearchView.prototype, "_generate"),
      originalDescriptor
    );
    assert.equal(view._generate("after-disable"), "ea-result");
    assert.equal(calls.length, 2);

    const lifecycleEvents = {};
    registerMarketLifecycleEvents({
      call: { view: { market: originalMethod } },
      events: lifecycleEvents,
      patchLifecycle: registry
    });
    assert.equal(
      lifecycleEvents.setMarketSearchGenerateEnabled(true).status,
      "installed"
    );
    assert.equal(
      lifecycleEvents.setMarketSearchGenerateEnabled(false).status,
      "restored"
    );
    assert.strictEqual(MarketSearchView.prototype._generate, originalMethod);

    class MismatchedMarketSearchView {
      _generate() {
        return "different";
      }
    }
    globalThis.UTMarketSearchView = MismatchedMarketSearchView;
    const mismatchRegistry = new PatchLifecycleRegistry();
    const mismatchedMethod = MismatchedMarketSearchView.prototype._generate;
    const mismatch = install(mismatchRegistry, originalMethod);
    assert.equal(mismatch.status, "verify-failed");
    assert.deepEqual(mismatch.missing, [
      "UTMarketSearchView.prototype._generate.original-mismatch"
    ]);
    assert.strictEqual(
      MismatchedMarketSearchView.prototype._generate,
      mismatchedMethod
    );

    class ParentMarketSearchView {
      _generate() {}
    }
    class InheritedMarketSearchView extends ParentMarketSearchView {}
    globalThis.UTMarketSearchView = InheritedMarketSearchView;
    const inheritedRegistry = new PatchLifecycleRegistry();
    assert.equal(
      install(inheritedRegistry, ParentMarketSearchView.prototype._generate)
        .status,
      "verify-failed"
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        InheritedMarketSearchView.prototype,
        "_generate"
      ),
      false
    );

    delete globalThis.UTMarketSearchView;
    const unsupportedRegistry = new PatchLifecycleRegistry();
    const unsupported = install(unsupportedRegistry, originalMethod);
    assert.equal(unsupported.status, "unsupported");
    assert.deepEqual(unsupported.missing, [
      "UTMarketSearchView.prototype._generate"
    ]);
  } finally {
    if (globalDescriptor) {
      Object.defineProperty(
        globalThis,
        "UTMarketSearchView",
        globalDescriptor
      );
    } else {
      delete globalThis.UTMarketSearchView;
    }
  }
}
