import assert from "assert";
import { FastSbcService } from "../src/fsu/domain/FastSbcService.js";
import { SbcPlayerMatchService } from "../src/fsu/domain/SbcPlayerMatchService.js";
import { OneFillCriteriaService } from "../src/fsu/domain/OneFillCriteriaService.js";

function installLodashMock() {
  globalThis._ = {
    size(value) {
      return Array.isArray(value) ? value.length : Object.keys(value || {}).length;
    },
    cloneDeep(value) {
      return JSON.parse(JSON.stringify(value));
    },
    each(collection, iteratee) {
      collection.forEach(iteratee);
    },
    get(object, path, fallback) {
      return object?.[path] ?? fallback;
    },
    has(object, key) {
      return Object.prototype.hasOwnProperty.call(object, key);
    },
    set(object, key, value) {
      object[key] = value;
      return object;
    },
    min(values) {
      return Math.min(...values);
    },
    max(values) {
      return Math.max(...values);
    },
    flatMap(collection, iteratee) {
      return collection.flatMap(iteratee);
    },
    uniq(collection) {
      return [...new Set(collection)];
    },
    uniqBy(collection, key) {
      const seen = new Set();
      return collection.filter((item) => {
        const marker = item[key];
        if (seen.has(marker)) return false;
        seen.add(marker);
        return true;
      });
    },
    map(collection, iteratee) {
      return collection.map(iteratee);
    },
    isEmpty(value) {
      return value == null || (Array.isArray(value) ? value.length === 0 : Object.keys(value).length === 0);
    },
    keys(value) {
      return Object.keys(value || {});
    },
    sortBy(collection, iteratee) {
      const copy = [...collection];
      if (!iteratee) {
        return copy.sort();
      }
      return copy.sort((left, right) => {
        const leftValue = typeof iteratee === "function" ? iteratee(left) : left[iteratee];
        const rightValue = typeof iteratee === "function" ? iteratee(right) : right[iteratee];
        return String(leftValue).localeCompare(String(rightValue));
      });
    },
    intersection(left, right) {
      const rightSet = new Set(right);
      return left.filter((value) => rightSet.has(value));
    },
    isEqual(left, right) {
      return JSON.stringify(left) === JSON.stringify(right);
    },
    every(collection, predicate) {
      return collection.every(predicate);
    },
    filter(collection, predicate) {
      return collection.filter(predicate);
    },
    reject(collection, predicate) {
      return collection.filter((item) => !predicate(item));
    },
    includes(collection, value) {
      return collection.includes(value);
    },
    find(collection, predicate) {
      return collection.find(predicate);
    },
    flatMap(collection, iteratee) {
      return collection.flatMap(iteratee);
    },
    orderBy(collection, iteratees, orders) {
      return [...collection].sort((left, right) => {
        for (let index = 0; index < iteratees.length; index++) {
          const iteratee = iteratees[index];
          const order = orders[index] === "desc" ? -1 : 1;
          const leftValue = typeof iteratee === "function" ? iteratee(left) : left[iteratee];
          const rightValue = typeof iteratee === "function" ? iteratee(right) : right[iteratee];
          if (leftValue < rightValue) return -1 * order;
          if (leftValue > rightValue) return 1 * order;
        }
        return 0;
      });
    },
    first(collection) {
      return collection[0];
    },
    indexOf(collection, value) {
      return collection.indexOf(value);
    }
  };
}

export function runSbcServiceTests() {
  installLodashMock();
  const fastSbcService = new FastSbcService();
  const helpers = {
    build: { strictlypcik: true },
    isEligibleForOneFill: () => false,
    ignorePlayerToCriteria: (value) => value,
    getItemBy: () => [{ id: 1 }, { id: 2 }]
  };
  const criteria = [{ c: 2, t: { rs: [1] } }, { c: 1, t: { rs: [1] } }];
  const playerPool = [{ id: 1 }, { id: 2 }, { id: 3 }];

  const clubQuantity = fastSbcService.calculateQuantity({
    clubMode: true,
    playerPool,
    criteria,
    helpers
  });
  assert.strictEqual(clubQuantity, 1);

  const unassignedQuantity = fastSbcService.calculateQuantity({
    clubMode: false,
    playerPool,
    criteria,
    helpers
  });
  assert.strictEqual(unassignedQuantity, 2);

  const matchService = new SbcPlayerMatchService();
  const controller = {
    squad: {
      _fsu: { hasChemistry: false },
      _fsuHasRating: false,
      getFieldPlayers: () => [{ inPossiblePosition: true, item: { id: 1 } }],
      getPlayers: () => []
    },
    viewmodel: {
      current: () => ({
        index: 0,
        item: { rating: 80 },
        position: { typeId: 10 }
      })
    },
    challenge: {}
  };

  const players = matchService.findMeetsPlayers(controller, {
    calculateChemistry: () => ({ totalChemistry: 0 }),
    getChemistryPlayers: () => [],
    getItemBy: () => [{ id: 10, databaseId: 1 }],
    createVirtualChallenge: () => ({
      squad: {
        getPlayers: () => [{ getItem: () => ({ id: 10 }) }],
        setPlayers(list) {
          this.players = list;
        }
      },
      meetsRequirements: () => true
    })
  });

  assert.strictEqual(players.length, 1);
  assert.strictEqual(players[0].id, 10);

  const oneFillService = new OneFillCriteriaService();
  const eligibilityKeys = {
    PLAYER_QUALITY: "PLAYER_QUALITY",
    PLAYER_LEVEL: "PLAYER_LEVEL",
    PLAYER_RARITY: "PLAYER_RARITY",
    PLAYER_RARITY_GROUP: "PLAYER_RARITY_GROUP",
    PLAYER_MIN_OVR: "PLAYER_MIN_OVR",
    TEAM_RATING: "TEAM_RATING",
    CHEMISTRY_POINTS: "CHEMISTRY_POINTS"
  };
  const oneFillCriteria = oneFillService.createFromRequirements(
    [
      {
        count: 5,
        getFirstKey: () => "PLAYER_QUALITY",
        getFirstValue: () => 3
      }
    ],
    5,
    eligibilityKeys
  );
  assert.ok(Array.isArray(oneFillCriteria));
  assert.strictEqual(oneFillCriteria.length, 1);
  assert.strictEqual(oneFillCriteria[0].c, 5);
  assert.strictEqual(oneFillCriteria[0].t.rs, 2);

  assert.strictEqual(
    oneFillService.isEligibleForOneFill([
      { t: { rs: 2 } },
      { t: { rs: 2, gs: true } }
    ]),
    true
  );
  assert.strictEqual(
    oneFillService.isEligibleForOneFill([
      { t: { rs: 2 } },
      { t: { rs: 3 } }
    ]),
    false
  );
}