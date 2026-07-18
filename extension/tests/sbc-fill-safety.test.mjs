import assert from "node:assert/strict";
import { CancellableOperation } from "../src/fsu/core/CancellableOperation.js";
import { OperationScope } from "../src/fsu/core/OperationScope.js";
import { SbcTemplateService } from "../src/fsu/domain/SbcTemplateService.js";
import { SbcUndoHistoryService } from "../src/fsu/domain/SbcUndoHistoryService.js";
import {
  SBC_FILL_CAPABILITIES,
  SbcVirtualChallengeAdapter
} from "../src/fsu/ea/SbcVirtualChallengeAdapter.js";

function createTemplateController() {
  const interactionStates = [];
  return {
    interactionStates,
    setInteractionState(value) {
      interactionStates.push(value);
    },
    challenge: {
      id: 17,
      squad: {
        _fsu: {},
        getFieldPlayers: () => [],
        getFormation: () => ({ generalPositions: [] })
      }
    }
  };
}

function createLodashStub() {
  return {
    get: (object, _path) => object?.challenge?.squad?._fsu,
    set: (object, _path, value) => {
      object.challenge.squad._fsu = value;
      return object;
    },
    filter: (items, predicate) => items.filter(predicate),
    reject: (items, predicate) => items.filter((item) => !predicate(item)),
    includes: (items, value) => items.includes(value),
    map: (items, iteratee) =>
      typeof iteratee === "string"
        ? items.map((item) => item?.[iteratee])
        : items.map(iteratee),
    flatMap: (items, iteratee) => items.flatMap(iteratee),
    has: (object, key) =>
      object != null && Object.prototype.hasOwnProperty.call(object, key),
    find: (items, predicate = (value) => Boolean(value)) => items.find(predicate),
    sortBy: (items, iteratee) => [...items].sort((a, b) => iteratee(a) - iteratee(b)),
    orderBy: (items) => [...items],
    first: (items) => items[0],
    indexOf: (items, value) => items.indexOf(value)
  };
}

export async function runSbcFillSafetyTests() {
  const operation = new CancellableOperation();
  const first = operation.start();
  const second = operation.start();
  assert.equal(first.isActive(), false);
  assert.equal(second.isActive(), true);
  assert.equal(operation.cancel(), true);
  assert.equal(second.isActive(), false);
  assert.equal(operation.isRunning(), false);

  const scope = new OperationScope();
  let supersedeA = 0;
  let cleanupA = 0;
  let cleanupB = 0;
  const tokenA = scope.start({
    onSupersede: () => supersedeA++,
    onCleanup: () => cleanupA++
  });
  const tokenB = scope.start({ onCleanup: () => cleanupB++ });
  assert.equal(tokenA.isActive(), false);
  assert.equal(tokenB.isActive(), true);
  assert.equal(supersedeA, 1);
  assert.equal(scope.finish(tokenA), false);
  assert.equal(cleanupA, 0);
  assert.equal(scope.finish(tokenB), true);
  assert.equal(cleanupB, 1);
  assert.equal(scope.finish(tokenB), false);
  assert.equal(cleanupB, 1);

  const cancelScope = new OperationScope();
  let cancelCleanups = 0;
  cancelScope.start({ onCleanup: () => cancelCleanups++ });
  assert.equal(cancelScope.cancel(), true);
  assert.equal(cancelCleanups, 1);
  assert.equal(cancelScope.cancel(), false);
  assert.equal(cancelCleanups, 1);

  const history = new SbcUndoHistoryService();
  const playerA = { id: 1, definitionId: 101, concept: false };
  const playerB = { id: 2, definitionId: 102, concept: true };
  const firstHistory = history.capture(null, [playerA, playerB]);
  assert.equal(firstHistory.changed, true);
  assert.equal(firstHistory.index, 0);
  assert.equal(Object.isFrozen(firstHistory.snapshots[0]), true);
  assert.throws(() => {
    firstHistory.snapshots[0][0] = playerB;
  }, TypeError);

  const duplicate = history.capture(firstHistory, [playerA, playerB]);
  assert.equal(duplicate.changed, false);
  const replaced = history.replaceCurrentItem(
    firstHistory,
    0,
    { id: 3, definitionId: 101, concept: false }
  );
  assert.equal(replaced.changed, true);
  assert.equal(firstHistory.snapshots[0][0], playerA);
  assert.equal(replaced.snapshots[0][0].id, 3);

  const missingAdapter = new SbcVirtualChallengeAdapter();
  const missing = missingAdapter.create({});
  assert.equal(missing.success, false);
  assert.equal(
    missing.error.capability,
    SBC_FILL_CAPABILITIES.VIRTUAL_CHALLENGE
  );

  class ChallengeEntity {
    constructor(data) {
      Object.assign(this, data);
    }
  }
  class NullItemEntity {}
  class ItemEntity {}
  class ChemistryUtils {
    constructor(chemistry, teamConfig) {
      this.chemistry = chemistry;
      this.teamConfig = teamConfig;
    }
  }
  class SquadEntity {
    constructor(options, dao, chemistry) {
      this.options = options;
      this.dao = dao;
      this.chemistry = chemistry;
    }

    setPlayers(players, refresh) {
      this.players = players;
      this.refresh = refresh;
    }
  }
  const virtualAdapter = new SbcVirtualChallengeAdapter({
    getRuntime: () => ({
      UTSBCChallengeEntity: ChallengeEntity,
      UTNullItemEntity: NullItemEntity,
      UTItemEntity: ItemEntity,
      UTSquadEntity: SquadEntity,
      UTSquadChemCalculatorUtils: ChemistryUtils,
      generateSbcSquadOptions: (info, factory, brickIndices) => ({
        info,
        factory,
        brickIndices
      }),
      sbcFactory: {},
      squadDao: {},
      chemistryService: {},
      teamConfig: {}
    })
  });
  const ownedPlayer = { id: 9 };
  const virtual = virtualAdapter.create({
    eligibilityRequirements: [],
    eligibilityOperation: "AND",
    squad: {
      simpleBrickIndices: [1],
      getFormation: () => ({ name: "f442" }),
      getPlayers: () => [{ getItem: () => ownedPlayer }]
    }
  });
  assert.equal(virtual.success, true);
  assert.equal(virtual.data.squad.players[0], ownedPlayer);
  assert.equal(virtual.data.squad.refresh, true);
  assert.equal(
    virtual.data.squad.options.brickIndices[1].playerType,
    "BRICK"
  );

  globalThis._ = createLodashStub();

  // Cancel during first fetch cleans loader + interaction.
  {
    let resolvePlans;
    let fetchCount = 0;
    let saveCount = 0;
    let showLoaderCount = 0;
    let hideLoaderCount = 0;
    const controller = createTemplateController();
    const templateService = new SbcTemplateService();
    const loading = templateService.loadTemplate(controller, 1, 0, {
      showLoader: () => showLoaderCount++,
      hideLoader: () => hideLoaderCount++,
      changeLoadingText: () => {},
      notice: () => {},
      getFutbinSbcSquad: async () => {
        fetchCount++;
        return new Promise((resolve) => {
          resolvePlans = resolve;
        });
      },
      getItemBy: () => [],
      ignorePlayerToCriteria: (value) => value,
      createVirtualChallenge: () => null,
      saveSquad: async () => {
        saveCount++;
        return { success: true };
      },
      saveOldSquad: () => {},
      getGoldenRange: () => 90,
      getFormationMap: () => ({}),
      debug: { log: () => {} },
      isPhone: () => false,
      navigateBack: () => {}
    });
    assert.equal(templateService.isRunning(), true);
    assert.equal(templateService.cancel(), true);
    resolvePlans([{ id: 77, likes: 1 }]);
    const result = await loading;
    assert.deepEqual(result, { success: false, reason: "cancelled" });
    assert.equal(fetchCount, 1);
    assert.equal(saveCount, 0);
    assert.equal(templateService.isRunning(), false);
    assert.equal(showLoaderCount, 1);
    assert.equal(hideLoaderCount, 1);
    assert.deepEqual(controller.interactionStates, [0, 1]);
  }

  // Empty plan cleans up.
  {
    let hideLoaderCount = 0;
    const controller = createTemplateController();
    const templateService = new SbcTemplateService();
    const result = await templateService.loadTemplate(controller, 1, 0, {
      showLoader: () => {},
      hideLoader: () => hideLoaderCount++,
      changeLoadingText: () => {},
      notice: () => {},
      getFutbinSbcSquad: async () => [],
      getItemBy: () => [],
      ignorePlayerToCriteria: (value) => value,
      createVirtualChallenge: () => null,
      saveSquad: async () => ({ success: true }),
      saveOldSquad: () => {},
      getGoldenRange: () => 90,
      getFormationMap: () => ({}),
      debug: { log: () => {} },
      isPhone: () => false,
      navigateBack: () => {}
    });
    assert.deepEqual(result, { success: false, reason: "empty-plan" });
    assert.equal(hideLoaderCount, 1);
    assert.deepEqual(controller.interactionStates, [0, 1]);
  }

  // Virtual challenge unavailable cleans up.
  {
    let hideLoaderCount = 0;
    const controller = createTemplateController();
    controller.challenge.squad.getFieldPlayers = () => [
      {
        isBrick: () => false,
        getGeneralPosition: () => 0
      }
    ];
    // Force concept path via a plan squad with concept player and empty club.
    globalThis.UTItemEntity = class {
      constructor() {
        this.groups = [];
        this.concept = false;
      }
    };
    globalThis.PlayerPosition = { ST: 0 };
    const conceptPlayer = {
      Player_Resource: 999,
      alternativePositions: [],
      org_pos: "ST",
      price: 100,
      rating: 80,
      club: 1,
      league: 1,
      nation: 1,
      raretype: 0
    };
    const templateService = new SbcTemplateService();
    const result = await templateService.loadTemplate(controller, 2, 55, {
      showLoader: () => {},
      hideLoader: () => hideLoaderCount++,
      changeLoadingText: () => {},
      notice: () => {},
      getFutbinSbcSquad: async () => ({
        Formation: "f442",
        cardlid11: conceptPlayer
      }),
      getItemBy: () => [],
      ignorePlayerToCriteria: (value) => value,
      createVirtualChallenge: () => null,
      saveSquad: async () => ({ success: true }),
      saveOldSquad: () => {},
      getGoldenRange: () => 90,
      getFormationMap: () => ({}),
      debug: { log: () => {} },
      isPhone: () => false,
      navigateBack: () => {}
    });
    assert.deepEqual(result, {
      success: false,
      reason: "virtual-challenge-unavailable"
    });
    assert.equal(hideLoaderCount, 1);
    assert.deepEqual(controller.interactionStates, [0, 1]);
  }

  // Save failure cleans up.
  {
    let hideLoaderCount = 0;
    const controller = createTemplateController();
    const templateService = new SbcTemplateService();
    const result = await templateService.loadTemplate(controller, 2, 9, {
      showLoader: () => {},
      hideLoader: () => hideLoaderCount++,
      changeLoadingText: () => {},
      notice: () => {},
      getFutbinSbcSquad: async () => ({ Formation: "f442" }),
      getItemBy: () => [],
      ignorePlayerToCriteria: (value) => value,
      createVirtualChallenge: () => null,
      saveSquad: async () => ({ success: false }),
      saveOldSquad: () => {},
      getGoldenRange: () => 90,
      getFormationMap: () => ({}),
      debug: { log: () => {} },
      isPhone: () => false,
      navigateBack: () => {}
    });
    assert.deepEqual(result, { success: false, reason: "save-failed" });
    assert.equal(hideLoaderCount, 1);
    assert.deepEqual(controller.interactionStates, [0, 1]);
  }

  // Helper throw cleans up.
  {
    let hideLoaderCount = 0;
    const controller = createTemplateController();
    const templateService = new SbcTemplateService();
    const result = await templateService.loadTemplate(controller, 1, 0, {
      showLoader: () => {},
      hideLoader: () => hideLoaderCount++,
      changeLoadingText: () => {},
      notice: () => {},
      getFutbinSbcSquad: async () => {
        throw new Error("network");
      },
      getItemBy: () => [],
      ignorePlayerToCriteria: (value) => value,
      createVirtualChallenge: () => null,
      saveSquad: async () => ({ success: true }),
      saveOldSquad: () => {},
      getGoldenRange: () => 90,
      getFormationMap: () => ({}),
      debug: { log: () => {} },
      isPhone: () => false,
      navigateBack: () => {}
    });
    assert.deepEqual(result, { success: false, reason: "error" });
    assert.equal(hideLoaderCount, 1);
    assert.deepEqual(controller.interactionStates, [0, 1]);
  }

  // Old operation cleanup must not hide the new operation loader.
  {
    const controllerA = createTemplateController();
    const controllerB = createTemplateController();
    const templateService = new SbcTemplateService();
    let hideA = 0;
    let hideB = 0;
    let resolveA;
    const loadA = templateService.loadTemplate(controllerA, 1, 0, {
      showLoader: () => {},
      hideLoader: () => hideA++,
      changeLoadingText: () => {},
      notice: () => {},
      getFutbinSbcSquad: async () =>
        new Promise((resolve) => {
          resolveA = resolve;
        }),
      getItemBy: () => [],
      ignorePlayerToCriteria: (value) => value,
      createVirtualChallenge: () => null,
      saveSquad: async () => ({ success: true }),
      saveOldSquad: () => {},
      getGoldenRange: () => 90,
      getFormationMap: () => ({}),
      debug: { log: () => {} },
      isPhone: () => false,
      navigateBack: () => {}
    });
    const loadB = templateService.loadTemplate(controllerB, 1, 0, {
      showLoader: () => {},
      hideLoader: () => hideB++,
      changeLoadingText: () => {},
      notice: () => {},
      getFutbinSbcSquad: async () => [],
      getItemBy: () => [],
      ignorePlayerToCriteria: (value) => value,
      createVirtualChallenge: () => null,
      saveSquad: async () => ({ success: true }),
      saveOldSquad: () => {},
      getGoldenRange: () => 90,
      getFormationMap: () => ({}),
      debug: { log: () => {} },
      isPhone: () => false,
      navigateBack: () => {}
    });
    const resultB = await loadB;
    assert.deepEqual(resultB, { success: false, reason: "empty-plan" });
    assert.equal(hideB, 1);
    assert.deepEqual(
      controllerA.interactionStates,
      [0, 1],
      "superseding must immediately restore the old controller"
    );
    resolveA([{ id: 1, likes: 1 }]);
    const resultA = await loadA;
    assert.equal(resultA.success, false);
    assert.equal(resultA.reason, "cancelled");
    assert.equal(hideA, 0, "stale operation must not hide the newer loader");
    assert.deepEqual(controllerA.interactionStates, [0, 1]);
  }
}
