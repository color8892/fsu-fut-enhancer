import assert from "node:assert/strict";
import { CancellableOperation } from "../src/fsu/core/CancellableOperation.js";
import { SbcTemplateService } from "../src/fsu/domain/SbcTemplateService.js";
import { SbcUndoHistoryService } from "../src/fsu/domain/SbcUndoHistoryService.js";
import {
  SBC_FILL_CAPABILITIES,
  SbcVirtualChallengeAdapter
} from "../src/fsu/ea/SbcVirtualChallengeAdapter.js";

export async function runSbcFillSafetyTests() {
  const operation = new CancellableOperation();
  const first = operation.start();
  const second = operation.start();
  assert.equal(first.isActive(), false);
  assert.equal(second.isActive(), true);
  assert.equal(operation.cancel(), true);
  assert.equal(second.isActive(), false);
  assert.equal(operation.isRunning(), false);

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

  globalThis._ = {
    get: (object, _path) => object?.challenge?.squad?._fsu,
    set: (object, _path, value) => {
      object.challenge.squad._fsu = value;
      return object;
    },
    filter: (items, predicate) => items.filter(predicate),
    reject: (items, predicate) => items.filter((item) => !predicate(item)),
    includes: (items, value) => items.includes(value)
  };
  let resolvePlans;
  let fetchCount = 0;
  let saveCount = 0;
  const templateService = new SbcTemplateService();
  const loading = templateService.loadTemplate(
    {
      setInteractionState: () => {},
      challenge: {
        id: 17,
        squad: {
          _fsu: {},
          getFieldPlayers: () => [],
          getFormation: () => ({ generalPositions: [] })
        }
      }
    },
    1,
    0,
    {
      showLoader: () => {},
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
      },
      saveOldSquad: () => {},
      getGoldenRange: () => 90,
      getFormationMap: () => ({}),
      debug: { log: () => {} },
      isPhone: () => false,
      navigateBack: () => {}
    }
  );
  assert.equal(templateService.isRunning(), true);
  assert.equal(templateService.cancel(), true);
  resolvePlans([{ id: 77, likes: 1 }]);
  await loading;
  assert.equal(fetchCount, 1);
  assert.equal(saveCount, 0);
  assert.equal(templateService.isRunning(), false);
}
