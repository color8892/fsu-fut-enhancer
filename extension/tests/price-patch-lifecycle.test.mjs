import assert from "node:assert/strict";
import { PatchLifecycleRegistry } from "../src/fsu/core/PatchLifecycleRegistry.js";
import {
  PRICE_PATCH_IDS,
  installSquadPricePatch,
  registerPriceLifecycleEvents
} from "../src/fsu/patches/player-list.js";
import { renderSquadPrice } from "../src/fsu/ui/PriceRenderer.js";

function install(registry, originalMethod, events, getSquadValueElement) {
  return installSquadPricePatch({
    call: { plist: { squadGR: originalMethod } },
    events,
    patchLifecycle: registry,
    getSquadValueElement
  });
}

export function runPricePatchLifecycleTests() {
  const globalDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "UTSquadEntity"
  );

  try {
    const originalCalls = [];
    class SquadEntity {
      getRating(...args) {
        originalCalls.push({ receiver: this, args });
        return 87;
      }

      getFieldPlayers() {
        return [
          { item: { definitionId: 1 } },
          { item: { definitionId: 2 } }
        ];
      }
    }
    globalThis.UTSquadEntity = SquadEntity;
    const originalMethod = SquadEntity.prototype.getRating;
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      SquadEntity.prototype,
      "getRating"
    );
    const totalElement = { innerText: "" };
    const events = {
      getCachePrice(definitionId) {
        return { num: definitionId === 1 ? 1200 : 800 };
      }
    };
    const getSquadValueElement = () => totalElement;
    const registry = new PatchLifecycleRegistry();

    const installed = install(
      registry,
      originalMethod,
      events,
      getSquadValueElement
    );
    assert.equal(installed.status, "installed");
    assert.equal(registry.isInstalled(PRICE_PATCH_IDS.SQUAD_VALUE), true);
    const patchedMethod = SquadEntity.prototype.getRating;
    const squad = new SquadEntity();
    assert.equal(squad.getRating("refresh"), 87);
    assert.equal(totalElement.innerText, "2,000");
    assert.deepEqual(originalCalls, [
      { receiver: squad, args: ["refresh"] }
    ]);

    assert.equal(
      install(registry, originalMethod, events, getSquadValueElement).status,
      "already-installed"
    );
    assert.strictEqual(SquadEntity.prototype.getRating, patchedMethod);

    const lifecycleEvents = { ...events };
    registerPriceLifecycleEvents({
      call: { plist: { squadGR: originalMethod } },
      events: lifecycleEvents,
      patchLifecycle: registry,
      getSquadValueElement
    });
    assert.equal(lifecycleEvents.setSquadPricePatchEnabled(false).status, "restored");
    assert.deepEqual(
      Object.getOwnPropertyDescriptor(SquadEntity.prototype, "getRating"),
      originalDescriptor
    );
    totalElement.innerText = "";
    assert.equal(squad.getRating(), 87);
    assert.equal(totalElement.innerText, "");
    assert.equal(lifecycleEvents.setSquadPricePatchEnabled(true).status, "installed");
    assert.equal(squad.getRating(), 87);
    assert.equal(totalElement.innerText, "2,000");

    class MismatchedSquad {
      getRating() {
        return 1;
      }
    }
    globalThis.UTSquadEntity = MismatchedSquad;
    const mismatchedMethod = MismatchedSquad.prototype.getRating;
    const mismatchRegistry = new PatchLifecycleRegistry();
    const mismatch = install(
      mismatchRegistry,
      originalMethod,
      events,
      getSquadValueElement
    );
    assert.equal(mismatch.status, "verify-failed");
    assert.strictEqual(MismatchedSquad.prototype.getRating, mismatchedMethod);

    delete globalThis.UTSquadEntity;
    const unsupportedRegistry = new PatchLifecycleRegistry();
    const unsupported = install(
      unsupportedRegistry,
      originalMethod,
      events,
      getSquadValueElement
    );
    assert.equal(unsupported.status, "unsupported");
    assert.deepEqual(unsupported.missing, ["UTSquadEntity.prototype.getRating"]);

    assert.equal(renderSquadPrice(null, 1000), false);
    assert.equal(renderSquadPrice(totalElement, Number.NaN), false);
  } finally {
    if (globalDescriptor) {
      Object.defineProperty(globalThis, "UTSquadEntity", globalDescriptor);
    } else {
      delete globalThis.UTSquadEntity;
    }
  }
}
