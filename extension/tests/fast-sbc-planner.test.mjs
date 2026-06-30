import assert from "assert";
import { FastSbcPlannerService } from "../src/fsu/domain/FastSbcPlannerService.js";

function createPlayer(overrides = {}) {
  return {
    id: 1,
    databaseId: 100,
    definitionId: 200,
    duplicateId: 10,
    untradeableCount: 1,
    loans: -1,
    endTime: -1,
    rating: 75,
    rareflag: 0,
    isPlayer() {
      return true;
    },
    isGoldRating() {
      return this.rating >= 75;
    },
    isBronzeRating() {
      return this.rating <= 64;
    },
    isSilverRating() {
      return this.rating >= 65 && this.rating <= 74;
    },
    isEnrolledInAcademy() {
      return false;
    },
    ...overrides
  };
}

export function runFastSbcPlannerTests() {
  const planner = new FastSbcPlannerService();

  const info = {
    lock: [99],
    squad: [50],
    set: { goldenrange: 83 },
    base: { fastsbc: { "1#10": [{ c: 1, t: { rs: 2 } }] } },
    SBCCount: { count: 0 }
  };

  const repositories = {
    Item: {
      getUnassignedItems() {
        return [
          createPlayer({ id: 1, databaseId: 100 }),
          createPlayer({ id: 2, databaseId: 101, rating: 90 }),
          createPlayer({ id: 99, databaseId: 102 }),
          createPlayer({ id: 3, databaseId: 103, duplicateId: 0 }),
          createPlayer({ id: 4, databaseId: 104, untradeableCount: 0 })
        ];
      }
    }
  };

  const pool = planner.getSafeUnassignedPool(repositories, info);
  assert.strictEqual(pool.length, 1);
  assert.strictEqual(pool[0].id, 1);

  const helpers = {
    info,
    isPrecious: () => false,
    getCachePrice: () => ({ num: 100 }),
    getItemBy: (_type, _criteria, _insert, replaceData) => replaceData,
    ignorePlayerToCriteria: (criteria) => ({ ...criteria, removeSquad: true }),
    build: { strictlypcik: true },
    isEligibleForOneFill: () => false
  };

  assert.strictEqual(planner.isPlayerSafe(createPlayer({ id: 99 }), helpers), false);
  helpers.info.squad = [50];
  assert.strictEqual(planner.isPlayerSafe(createPlayer({ id: 50 }), helpers), false);
  assert.strictEqual(planner.isPlayerSafe(createPlayer({ rating: 90 }), helpers), false);

  const fill = planner.resolveFillPlayers([{ c: 1, t: { rs: 2 } }], pool, helpers);
  assert.strictEqual(fill.length, 1);
  assert.strictEqual(fill[0].id, 1);

  const services = {
    SBC: {
      repository: {
        getSetById(id) {
          if (id !== 10) return null;
          return {
            id: 10,
            name: "Daily Test",
            isComplete() {
              return false;
            },
            challengesCount: 1,
            getChallenge(cId) {
              return cId === 1 ? { isCompleted() { return false; } } : null;
            }
          };
        }
      }
    }
  };

  const plan = planner.planBatch({
    info,
    services,
    repositories,
    helpers: {
      ...helpers,
      getItemBy: (_type, criteria, _insert, replaceData) => {
        if (criteria.rs === 2) {
          return replaceData.slice(0, 1);
        }
        return [];
      }
    }
  });

  assert.strictEqual(plan.entries.length, 1);
  assert.strictEqual(plan.entries[0].name, "Daily Test");
}