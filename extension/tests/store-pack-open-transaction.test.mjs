import assert from "node:assert/strict";
import { PatchLifecycleRegistry } from "../src/fsu/core/PatchLifecycleRegistry.js";
import {
  STORE_PACK_OPEN_ERROR_CODES
} from "../src/fsu/domain/StorePackOpenResults.js";
import { StorePackOpenTransactionService } from "../src/fsu/domain/StorePackOpenTransactionService.js";
import { StorePackOpenAdapter } from "../src/fsu/ea/StorePackOpenAdapter.js";
import {
  STORE_PATCH_IDS,
  commitStorePackOpenState,
  installStorePackOpenPatch,
  registerStorePackOpenLifecycleEvents
} from "../src/fsu/patches/store.js";

function createScheduler() {
  let now = 0;
  const callbacks = [];
  return {
    now: () => now,
    setTimer(callback) {
      callbacks.push(callback);
      return callbacks.length;
    },
    runNext(elapsed = 50) {
      now += elapsed;
      const callback = callbacks.shift();
      assert.equal(typeof callback, "function");
      callback();
    }
  };
}

function createController(pack) {
  return {
    isOpeningPack: false,
    viewmodel: {
      getPackById: () => pack
    }
  };
}

export function runStorePackOpenTransactionTests() {
  let inventory = [{ id: 7 }, { id: 7 }, { id: 8 }];
  const adapter = new StorePackOpenAdapter({
    openEvent: "open",
    getMyPacks: () => inventory
  });
  const controller = createController({ id: 7, isMyPack: true });
  const args = [{}, "open", { articleId: 7, tradable: true }];
  assert.deepEqual(adapter.prepare(controller, args), {
    success: true,
    data: {
      tracked: true,
      key: "7-t",
      packId: 7,
      initialCount: 2
    }
  });
  assert.deepEqual(
    adapter.prepare(
      createController({ id: 9, isMyPack: false }),
      [{}, "open", { articleId: 9 }]
    ),
    { success: true, data: { tracked: false } }
  );

  const scheduler = createScheduler();
  const service = new StorePackOpenTransactionService({
    adapter,
    now: scheduler.now,
    setTimer: scheduler.setTimer,
    timeoutMs: 1000,
    settleMs: 100,
    pollMs: 50
  });
  const diagnostics = [];
  const successes = [];
  let invokeCalls = 0;
  const options = {
    controller,
    args,
    invoke: () => {
      invokeCalls++;
      controller.isOpeningPack = true;
      return "ea-open";
    },
    onSuccess: (result) => successes.push(result),
    onDiagnostic: (result) => diagnostics.push(result)
  };
  assert.equal(service.intercept(options), "ea-open");
  assert.equal(service.intercept(options), undefined);
  assert.equal(invokeCalls, 1);
  assert.equal(
    diagnostics[0].error.code,
    STORE_PACK_OPEN_ERROR_CODES.DUPLICATE
  );
  inventory = [{ id: 7 }, { id: 8 }];
  scheduler.runNext();
  assert.deepEqual(successes, [
    {
      packId: 7,
      remainingCount: 1,
      availablePackIds: [7, 8]
    }
  ]);

  const info = { douagain: { pack: 0 } };
  commitStorePackOpenState(info, successes[0]);
  assert.equal(info.douagain.pack, 7);
  commitStorePackOpenState(info, {
    packId: 7,
    remainingCount: 0,
    availablePackIds: [8]
  });
  assert.equal(info.douagain.pack, 0);
  info.douagain.pack = 8;
  commitStorePackOpenState(info, {
    packId: 7,
    remainingCount: 0,
    availablePackIds: [8]
  });
  assert.equal(info.douagain.pack, 8);

  inventory = [{ id: 10 }];
  const rejectionScheduler = createScheduler();
  const rejectionController = createController({ id: 10, isMyPack: true });
  const rejectionDiagnostics = [];
  const rejectionService = new StorePackOpenTransactionService({
    adapter: new StorePackOpenAdapter({
      openEvent: "open",
      getMyPacks: () => inventory
    }),
    now: rejectionScheduler.now,
    setTimer: rejectionScheduler.setTimer,
    timeoutMs: 1000,
    settleMs: 100,
    pollMs: 50
  });
  rejectionService.intercept({
    controller: rejectionController,
    args: [{}, "open", { articleId: 10 }],
    invoke: () => {
      rejectionController.isOpeningPack = true;
    },
    onSuccess: () => assert.fail("Rejected open must not commit"),
    onDiagnostic: (result) => rejectionDiagnostics.push(result)
  });
  rejectionScheduler.runNext();
  rejectionController.isOpeningPack = false;
  rejectionScheduler.runNext();
  rejectionScheduler.runNext(100);
  assert.equal(
    rejectionDiagnostics[0].error.code,
    STORE_PACK_OPEN_ERROR_CODES.REJECTED
  );

  inventory = [{ id: 11 }];
  const timeoutScheduler = createScheduler();
  const timeoutController = createController({ id: 11, isMyPack: true });
  const timeoutDiagnostics = [];
  let timeoutInvokeCalls = 0;
  const timeoutService = new StorePackOpenTransactionService({
    adapter: new StorePackOpenAdapter({
      openEvent: "open",
      getMyPacks: () => inventory
    }),
    now: timeoutScheduler.now,
    setTimer: timeoutScheduler.setTimer,
    timeoutMs: 100,
    settleMs: 50,
    pollMs: 50
  });
  const timeoutOptions = {
    controller: timeoutController,
    args: [{}, "open", { articleId: 11 }],
    invoke: () => {
      timeoutInvokeCalls++;
      timeoutController.isOpeningPack = true;
    },
    onSuccess: () => assert.fail("Timed out open must not commit"),
    onDiagnostic: (result) => timeoutDiagnostics.push(result)
  };
  timeoutService.intercept(timeoutOptions);
  timeoutScheduler.runNext(100);
  assert.equal(
    timeoutDiagnostics[0].error.code,
    STORE_PACK_OPEN_ERROR_CODES.TIMEOUT
  );
  timeoutService.intercept(timeoutOptions);
  assert.equal(timeoutInvokeCalls, 1);
  assert.equal(
    timeoutDiagnostics[1].error.code,
    STORE_PACK_OPEN_ERROR_CODES.DUPLICATE
  );

  let passthroughCalls = 0;
  const malformedResult = timeoutService.intercept({
    ...timeoutOptions,
    args: [{}, "open", { articleId: "bad" }],
    invoke: () => {
      passthroughCalls++;
      return "passthrough";
    }
  });
  assert.equal(malformedResult, "passthrough");
  assert.equal(passthroughCalls, 1);

  const throwingAdapterService = new StorePackOpenTransactionService({
    adapter: {
      prepare() {
        throw new Error("adapter drift");
      },
      readCompletion() {
        throw new Error("unreachable");
      }
    }
  });
  let throwingAdapterInvokeCalls = 0;
  assert.equal(
    throwingAdapterService.intercept({
      controller: createController({ id: 12, isMyPack: true }),
      args: [{}, "open", { articleId: 12 }],
      invoke: () => {
        throwingAdapterInvokeCalls++;
        return "ea-fallback";
      },
      onSuccess: () => {},
      onDiagnostic: (result) => {
        assert.equal(
          result.error.code,
          STORE_PACK_OPEN_ERROR_CODES.PRECONDITION
        );
      }
    }),
    "ea-fallback"
  );
  assert.equal(throwingAdapterInvokeCalls, 1);

  const globalDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "UTStoreViewController"
  );
  try {
    class StoreViewController {
      eOpenPack(...openArgs) {
        return ["ea", ...openArgs];
      }
    }
    globalThis.UTStoreViewController = StoreViewController;
    const originalMethod = StoreViewController.prototype.eOpenPack;
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      StoreViewController.prototype,
      "eOpenPack"
    );
    const registry = new PatchLifecycleRegistry();
    const intercepted = [];
    const transactionService = {
      intercept(transactionOptions) {
        intercepted.push(transactionOptions.args);
        return transactionOptions.invoke();
      }
    };
    const lifecycleOptions = {
      call: { other: { store: { eOpenPack: originalMethod } } },
      events: {},
      patchLifecycle: registry,
      transactionService,
      onSuccess: () => {},
      onDiagnostic: () => {}
    };
    assert.equal(installStorePackOpenPatch(lifecycleOptions).status, "installed");
    const instance = new StoreViewController();
    assert.deepEqual(instance.eOpenPack("view", "open", { articleId: 7 }), [
      "ea",
      "view",
      "open",
      { articleId: 7 }
    ]);
    assert.equal(intercepted.length, 1);
    assert.equal(
      registry.isInstalled(STORE_PATCH_IDS.PACK_OPEN_TRANSACTION),
      true
    );
    assert.equal(
      installStorePackOpenPatch(lifecycleOptions).status,
      "already-installed"
    );

    registerStorePackOpenLifecycleEvents(lifecycleOptions);
    assert.equal(
      lifecycleOptions.events.setStorePackOpenPatchEnabled(false).status,
      "restored"
    );
    assert.deepEqual(
      Object.getOwnPropertyDescriptor(
        StoreViewController.prototype,
        "eOpenPack"
      ),
      originalDescriptor
    );
    assert.equal(
      lifecycleOptions.events.setStorePackOpenPatchEnabled(true).status,
      "installed"
    );
    assert.equal(
      lifecycleOptions.events.setStorePackOpenPatchEnabled(false).status,
      "restored"
    );

    class MismatchedStoreViewController {
      eOpenPack() {}
    }
    globalThis.UTStoreViewController = MismatchedStoreViewController;
    assert.equal(
      installStorePackOpenPatch({
        ...lifecycleOptions,
        patchLifecycle: new PatchLifecycleRegistry()
      }).status,
      "verify-failed"
    );
    delete globalThis.UTStoreViewController;
    assert.equal(
      installStorePackOpenPatch({
        ...lifecycleOptions,
        patchLifecycle: new PatchLifecycleRegistry()
      }).status,
      "unsupported"
    );
  } finally {
    if (globalDescriptor) {
      Object.defineProperty(
        globalThis,
        "UTStoreViewController",
        globalDescriptor
      );
    } else {
      delete globalThis.UTStoreViewController;
    }
  }
}
