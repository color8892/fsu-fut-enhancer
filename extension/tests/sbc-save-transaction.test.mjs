import assert from "node:assert/strict";
import { SbcSquadSaveService } from "../src/fsu/domain/SbcSquadSaveService.js";
import {
  SBC_SAVE_ERROR_CODES
} from "../src/fsu/domain/SbcSaveResults.js";
import {
  EA_OBSERVABLE_ERROR_CODES,
  EaObservableAdapter
} from "../src/fsu/ea/EaObservableAdapter.js";

function immediateObservable(response, counters) {
  return {
    observe(context, callback) {
      counters.observed++;
      callback(this, response);
    },
    unobserve() {
      counters.unobserved++;
    }
  };
}

function createSquad(originalPlayer) {
  return {
    players: [originalPlayer],
    removeCalls: 0,
    setCalls: [],
    getPlayers() {
      return this.players.map((item) => ({ getItem: () => item }));
    },
    removeAllItems() {
      this.removeCalls++;
      this.players = [];
    },
    setPlayers(players) {
      this.players = [...players];
      this.setCalls.push([...players]);
    }
  };
}

function createHelpers(overrides = {}) {
  const state = {
    saving: [],
    notices: [],
    hidden: 0,
    loadedPlayers: [],
    counters: { observed: 0, unobserved: 0 }
  };
  const loadedPlayer = { id: 3 };
  const loadedSquad = { _players: [{ _item: loadedPlayer }] };
  return {
    state,
    loadedPlayer,
    loadedSquad,
    helpers: {
      setSaving: (value) => state.saving.push(value),
      saveChallenge: () =>
        immediateObservable({ success: true }, state.counters),
      loadChallengeData: () =>
        immediateObservable(
          { response: { squad: loadedSquad } },
          state.counters
        ),
      notice: (...args) => state.notices.push(args),
      hideLoader: () => state.hidden++,
      loadPlayerInfo: (players) => state.loadedPlayers.push(players),
      isPhone: () => false,
      getCurrentController: () => ({}),
      getActiveView: () => null,
      debug: { log: () => {} },
      ...overrides
    }
  };
}

function createChallenge(squad) {
  return {
    id: 17,
    squad,
    notifications: [],
    onDataChange: {
      notify(value) {
        this.notifications = value;
      }
    }
  };
}

export async function runSbcSaveTransactionTests() {
  const originalPlayer = { id: 1 };
  const requestedPlayer = { id: 2 };
  const squad = createSquad(originalPlayer);
  const challenge = createChallenge(squad);
  const successSetup = createHelpers();
  const service = new SbcSquadSaveService();
  const success = await service.save(
    challenge,
    squad,
    [requestedPlayer],
    successSetup.helpers
  );
  assert.equal(success.success, true);
  assert.deepEqual(squad.players, [successSetup.loadedPlayer]);
  assert.deepEqual(successSetup.state.saving, [true, false]);
  assert.equal(successSetup.state.hidden, 1);
  assert.deepEqual(successSetup.state.notices, [
    ["notice.templatesuccess", 0]
  ]);
  assert.equal(successSetup.state.counters.observed, 2);
  assert.equal(successSetup.state.counters.unobserved, 2);

  const rejectedSquad = createSquad(originalPlayer);
  const rejectedSetup = createHelpers({
    saveChallenge: () =>
      immediateObservable(
        { success: false },
        { observed: 0, unobserved: 0 }
      ),
    loadChallengeData: () => {
      throw new Error("load must not run after rejected save");
    }
  });
  const rejected = await new SbcSquadSaveService().save(
    createChallenge(rejectedSquad),
    rejectedSquad,
    [requestedPlayer],
    rejectedSetup.helpers
  );
  assert.equal(rejected.success, false);
  assert.equal(rejected.error.code, SBC_SAVE_ERROR_CODES.REJECTED);
  assert.deepEqual(rejectedSquad.players, [originalPlayer]);
  assert.deepEqual(rejectedSetup.state.notices, [
    ["notice.templateerror", 2]
  ]);
  assert.equal(rejectedSetup.state.hidden, 1);

  const malformedSquad = createSquad(originalPlayer);
  const malformedSetup = createHelpers({
    loadChallengeData: () =>
      immediateObservable(
        { response: { squad: { _players: [{}] } } },
        { observed: 0, unobserved: 0 }
      )
  });
  const malformed = await new SbcSquadSaveService().save(
    createChallenge(malformedSquad),
    malformedSquad,
    [requestedPlayer],
    malformedSetup.helpers
  );
  assert.equal(malformed.success, false);
  assert.equal(
    malformed.error.code,
    SBC_SAVE_ERROR_CODES.INVALID_RESPONSE
  );
  assert.deepEqual(malformedSquad.players, [originalPlayer]);
  assert.equal(malformedSetup.state.hidden, 1);

  let saveCallback;
  let saveCalls = 0;
  const dedupeSquad = createSquad(originalPlayer);
  const dedupeSetup = createHelpers({
    saveChallenge: () => {
      saveCalls++;
      return {
        observe(_context, callback) {
          saveCallback = callback;
        },
        unobserve() {}
      };
    }
  });
  const dedupeService = new SbcSquadSaveService();
  const first = dedupeService.save(
    createChallenge(dedupeSquad),
    dedupeSquad,
    [requestedPlayer],
    dedupeSetup.helpers
  );
  const second = dedupeService.save(
    createChallenge(dedupeSquad),
    dedupeSquad,
    [{ id: 99 }],
    dedupeSetup.helpers
  );
  assert.strictEqual(first, second);
  assert.equal(saveCalls, 1);
  assert.equal(dedupeSquad.removeCalls, 1);
  saveCallback({ unobserve() {} }, { success: true });
  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.strictEqual(firstResult, secondResult);
  assert.equal(firstResult.success, true);

  const timeoutAdapter = new EaObservableAdapter({
    timeoutMs: 1,
    setTimer: (callback) => {
      queueMicrotask(callback);
      return 1;
    },
    clearTimer: () => {}
  });
  const timeoutSquad = createSquad(originalPlayer);
  const timeoutSetup = createHelpers({
    saveChallenge: () => ({
      observe() {},
      unobserve() {}
    })
  });
  const timeout = await new SbcSquadSaveService({
    observableAdapter: timeoutAdapter
  }).save(
    createChallenge(timeoutSquad),
    timeoutSquad,
    [requestedPlayer],
    timeoutSetup.helpers
  );
  assert.equal(timeout.success, false);
  assert.equal(timeout.error.code, EA_OBSERVABLE_ERROR_CODES.TIMEOUT);
  assert.deepEqual(timeoutSquad.players, [originalPlayer]);

  const invalid = await service.save({}, {}, null, successSetup.helpers);
  assert.equal(invalid.success, false);
  assert.equal(invalid.error.code, SBC_SAVE_ERROR_CODES.PRECONDITION);
  assert.equal(successSetup.state.hidden, 2);
}
