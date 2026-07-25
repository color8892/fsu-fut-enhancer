import assert from "node:assert/strict";
import { requestUnassignedItemsSafely } from "../src/fsu/patches/unassigned.js";

function createController({ view, result, notify = true }) {
  const calls = {
    interactionStates: [],
    logs: [],
    notifications: 0,
    notified: 0,
    rendered: 0,
    handledStatuses: [],
    unobserved: 0
  };
  const networkErrorController = {
    checkCriticalStatus(status) {
      return status === 401;
    },
    handleStatus(status) {
      calls.handledStatuses.push(status);
    }
  };
  const controller = {
    getView() {
      return view === null
        ? null
        : {
            setInteractionState(state) {
              calls.interactionStates.push(state);
            }
          };
    },
    onDataChange: {
      notify() {
        calls.notified += 1;
      }
    },
    renderView() {
      calls.rendered += 1;
    },
    viewmodel: {
      requestUnassignedItems() {
        return {
          observe(owner, callback) {
            assert.equal(owner, controller);
            callback(
              {
                unobserve(unobserveOwner) {
                  assert.equal(unobserveOwner, controller);
                  calls.unobserved += 1;
                }
              },
              result
            );
          }
        };
      }
    }
  };
  const helpers = {
    debug: {
      log(message) {
        calls.logs.push(message);
      }
    },
    getNetworkErrorController: () => networkErrorController,
    notifyLoadFailure() {
      calls.notifications += 1;
    }
  };

  requestUnassignedItemsSafely(controller, notify, helpers);
  return calls;
}

export function runUnassignedRefreshTests() {
  const success = createController({
    view: {},
    result: { success: true }
  });
  assert.deepEqual(success.interactionStates, [true]);
  assert.equal(success.rendered, 1);
  assert.equal(success.notified, 1);
  assert.equal(success.unobserved, 1);

  const detached = createController({
    view: null,
    result: { success: true }
  });
  assert.deepEqual(detached.interactionStates, []);
  assert.equal(detached.rendered, 0);
  assert.equal(detached.notified, 0);
  assert.equal(detached.unobserved, 1);
  assert.match(detached.logs[0], /detached view/);

  const criticalFailure = createController({
    view: {},
    result: { success: false, status: 401 }
  });
  assert.deepEqual(criticalFailure.handledStatuses, [401]);
  assert.equal(criticalFailure.notifications, 0);

  const ordinaryFailure = createController({
    view: {},
    result: { success: false, status: 500 }
  });
  assert.deepEqual(ordinaryFailure.handledStatuses, []);
  assert.equal(ordinaryFailure.notifications, 1);

  const noNotification = createController({
    view: {},
    result: { success: true },
    notify: false
  });
  assert.equal(noNotification.rendered, 1);
  assert.equal(noNotification.notified, 0);

  assert.equal(
    requestUnassignedItemsSafely(
      { viewmodel: null },
      true,
      {
        getNetworkErrorController: () => null,
        notifyLoadFailure() {}
      }
    ),
    false
  );
}
