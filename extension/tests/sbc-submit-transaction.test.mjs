import assert from "node:assert/strict";
import { PatchLifecycleRegistry } from "../src/fsu/core/PatchLifecycleRegistry.js";
import { SbcSubmitTransactionService } from "../src/fsu/domain/SbcSubmitTransactionService.js";
import {
  SBC_SUBMIT_ERROR_CODES,
  parseSbcCompletionResponse
} from "../src/fsu/domain/SbcSubmitResults.js";
import {
  EA_OBSERVABLE_ERROR_CODES,
  EaObservableAdapter
} from "../src/fsu/ea/EaObservableAdapter.js";
import {
  SBC_SUBMIT_PATCH_IDS,
  installSbcSubmitPatch
} from "../src/fsu/patches/sbc-submit.js";

class ControlledObservable {
  constructor() {
    this.observers = [];
    this.unobserved = 0;
  }

  observe(context, callback) {
    this.observers.push({ context, callback });
    return this;
  }

  unobserve() {
    this.unobserved++;
  }

  emit(response) {
    for (const observer of [...this.observers]) {
      observer.callback(this, response);
    }
  }
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

export async function runSbcSubmitTransactionTests() {
  const service = new SbcSubmitTransactionService();
  const observable = new ControlledObservable();
  const diagnostics = [];
  let invokeCalls = 0;
  let successCalls = 0;
  const options = {
    args: [{ id: 17, canSubmit: () => true }, { id: 6 }],
    observerContext: {},
    invoke: () => {
      invokeCalls++;
      return observable;
    },
    onSuccess: () => successCalls++,
    onDiagnostic: (result) => diagnostics.push(result)
  };
  const first = service.intercept(options);
  const second = service.intercept(options);
  assert.strictEqual(first, observable);
  let duplicateResponse;
  second.observe({}, (_sender, response) => {
    duplicateResponse = response;
  });
  await flushPromises();
  assert.equal(duplicateResponse.status, 409);
  assert.equal(
    duplicateResponse.error.code,
    SBC_SUBMIT_ERROR_CODES.IN_FLIGHT
  );
  assert.equal(invokeCalls, 1);
  observable.emit({ success: true, data: { setId: 6 } });
  await flushPromises();
  assert.equal(successCalls, 1);
  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0].error.code,
    SBC_SUBMIT_ERROR_CODES.IN_FLIGHT
  );
  assert.equal(observable.unobserved, 1);

  let rejectedResponse;
  const rejected = service.intercept({
    ...options,
    args: [{ id: 17, canSubmit: () => false }, { id: 6 }]
  });
  rejected.observe({}, (_sender, response) => {
    rejectedResponse = response;
  });
  await flushPromises();
  assert.equal(rejectedResponse.success, false);
  assert.equal(
    rejectedResponse.error.code,
    SBC_SUBMIT_ERROR_CODES.PRECONDITION
  );

  const timeoutDiagnostics = [];
  const timeoutObservable = new ControlledObservable();
  let timeoutInvokeCalls = 0;
  const timeoutService = new SbcSubmitTransactionService({
    observableAdapter: new EaObservableAdapter({
      timeoutMs: 1,
      setTimer: (callback) => {
        queueMicrotask(callback);
        return 1;
      },
      clearTimer: () => {}
    })
  });
  timeoutService.intercept({
    ...options,
    invoke: () => {
      timeoutInvokeCalls++;
      return timeoutObservable;
    },
    onDiagnostic: (result) => timeoutDiagnostics.push(result)
  });
  await flushPromises();
  assert.equal(
    timeoutDiagnostics[0].error.code,
    EA_OBSERVABLE_ERROR_CODES.TIMEOUT
  );
  const afterTimeout = timeoutService.intercept({
    ...options,
    invoke: () => {
      timeoutInvokeCalls++;
      return new ControlledObservable();
    },
    onDiagnostic: (result) => timeoutDiagnostics.push(result)
  });
  let afterTimeoutResponse;
  afterTimeout.observe({}, (_sender, response) => {
    afterTimeoutResponse = response;
  });
  await flushPromises();
  assert.equal(timeoutInvokeCalls, 1);
  assert.equal(
    afterTimeoutResponse.error.code,
    SBC_SUBMIT_ERROR_CODES.IN_FLIGHT
  );

  const throwingPrecondition = service.intercept({
    ...options,
    args: [
      {
        id: 18,
        canSubmit: () => {
          throw new Error("EA capability drift");
        }
      },
      { id: 6 }
    ]
  });
  let throwingPreconditionResponse;
  throwingPrecondition.observe({}, (_sender, response) => {
    throwingPreconditionResponse = response;
  });
  await flushPromises();
  assert.equal(
    throwingPreconditionResponse.error.code,
    SBC_SUBMIT_ERROR_CODES.PRECONDITION
  );

  assert.deepEqual(
    parseSbcCompletionResponse({
      success: true,
      data: { setId: "6", setCompleted: true }
    }),
    {
      success: true,
      data: {
        response: {
          success: true,
          data: { setId: "6", setCompleted: true }
        },
        setId: 6,
        setCompleted: true
      }
    }
  );
  assert.equal(
    parseSbcCompletionResponse({ success: true, data: {} }).error.code,
    SBC_SUBMIT_ERROR_CODES.INVALID_RESPONSE
  );

  const globalDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "UTSBCService"
  );
  try {
    const patchObservable = new ControlledObservable();
    let originalCalls = 0;
    class SubmitService {
      submitChallenge() {
        originalCalls++;
        return patchObservable;
      }
    }
    globalThis.UTSBCService = SubmitService;
    const originalMethod = SubmitService.prototype.submitChallenge;
    const registry = new PatchLifecycleRegistry();
    let completions = 0;
    let navUpdates = 0;
    const installed = installSbcSubmitPatch({
      sbcCountService: {
        recordCompletion: () => completions++
      },
      onCountChanged: () => navUpdates++,
      patchLifecycle: registry,
      debug: { log: () => {} }
    });
    assert.equal(installed.status, "installed");
    const submitService = new SubmitService();
    const challenge = { id: 22, canSubmit: () => true };
    const setEntity = { id: 9 };
    const patchedFirst = submitService.submitChallenge(
      challenge,
      setEntity
    );
    const patchedSecond = submitService.submitChallenge(
      challenge,
      setEntity
    );
    assert.strictEqual(patchedFirst, patchObservable);
    let patchedDuplicateResponse;
    patchedSecond.observe({}, (_sender, response) => {
      patchedDuplicateResponse = response;
    });
    await flushPromises();
    assert.equal(
      patchedDuplicateResponse.error.code,
      SBC_SUBMIT_ERROR_CODES.IN_FLIGHT
    );
    assert.equal(originalCalls, 1);
    patchObservable.emit({ success: true, data: { setId: 9 } });
    await flushPromises();
    assert.equal(completions, 1);
    assert.equal(navUpdates, 1);
    assert.equal(
      registry.isInstalled(SBC_SUBMIT_PATCH_IDS.TRANSACTION),
      true
    );
    assert.equal(
      registry.restore(SBC_SUBMIT_PATCH_IDS.TRANSACTION).status,
      "restored"
    );
    assert.strictEqual(SubmitService.prototype.submitChallenge, originalMethod);

    delete globalThis.UTSBCService;
    assert.equal(
      installSbcSubmitPatch({
        sbcCountService: { recordCompletion: () => {} },
        onCountChanged: () => {},
        patchLifecycle: new PatchLifecycleRegistry(),
        debug: { log: () => {} }
      }).status,
      "unsupported"
    );
  } finally {
    if (globalDescriptor) {
      Object.defineProperty(globalThis, "UTSBCService", globalDescriptor);
    } else {
      delete globalThis.UTSBCService;
    }
  }
}
