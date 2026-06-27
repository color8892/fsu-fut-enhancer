import assert from "assert";
import { PlayerSearchService } from "../src/fsu/domain/PlayerSearchService.js";
import { PlayerValueService } from "../src/fsu/domain/PlayerValueService.js";
import { TtlCache } from "../src/fsu/core/TtlCache.js";
import { PriceRequestQueue } from "../src/fsu/core/PriceRequestQueue.js";

function installLodashMock() {
  globalThis._ = {
    concat(a, b) {
      return [...a, ...b];
    },
    has(object, key) {
      return Object.prototype.hasOwnProperty.call(object, key);
    },
    includes(collection, value) {
      return collection.includes(value);
    },
    isArray(value) {
      return Array.isArray(value);
    },
    isEqual(a, b) {
      return JSON.stringify(a) === JSON.stringify(b);
    },
    map(collection, iteratee) {
      return collection.map(iteratee);
    },
    orderBy(collection, keys, orders) {
      const normalizedKeys = Array.isArray(keys) ? keys : [keys];
      const normalizedOrders = Array.isArray(orders) ? orders : [orders];
      return [...collection].sort((a, b) => {
        for (let i = 0; i < normalizedKeys.length; i++) {
          const key = normalizedKeys[i];
          const av = typeof key === "function" ? key(a) : a[key];
          const bv = typeof key === "function" ? key(b) : b[key];
          if (av === bv) continue;
          const order = normalizedOrders[i] === "desc" ? -1 : 1;
          return av > bv ? order : -order;
        }
        return 0;
      });
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
    forEach(collection, iteratee) {
      collection.forEach(iteratee);
    },
    intersection(a, b) {
      const set = new Set(b);
      return a.filter((x) => set.has(x));
    },
    gte(a, b) {
      return a >= b;
    }
  };

  globalThis.ItemRarity = { NONE: 0, RARE: 1 };
}

function makePlayer(overrides = {}) {
  return {
    id: 1,
    databaseId: 100,
    definitionId: 1000,
    rating: 80,
    rareflag: 0,
    loans: -1,
    endTime: -1,
    pile: 1,
    untradeableCount: 0,
    groups: [],
    possiblePositions: ["ST"],
    basePossiblePositions: ["ST"],
    leagueId: 13,
    _itemPriceLimits: { minimum: 200, maximum: 10000 },
    isPlayer() {
      return true;
    },
    isEnrolledInAcademy() {
      return false;
    },
    isSpecial() {
      return false;
    },
    isBronzeRating() {
      return false;
    },
    isSilverRating() {
      return false;
    },
    isGoldRating() {
      return true;
    },
    getNumBasicPlayStyles() {
      return 0;
    },
    getNumPlusPlayStyles() {
      return 0;
    },
    ...overrides
  };
}

function makeHelpers(players) {
  const info = {
    build: { sbfirstcommon: true },
    set: { goldenrange: 74 },
    lock: [],
    squad: []
  };

  return {
    getClubPlayers: () => players,
    getStorageItems: () => [],
    getInfo: () => info,
    getBuild: () => info.build,
    getSet: () => info.set,
    getLock: () => info.lock,
    debug: { log: () => {} },
    repositories: {
      Item: { storage: { get: () => null } },
      Squad: {
        squads: { get: () => null }
      }
    },
    services: {
      User: { getUser: () => ({ selectedPersona: 1 }) },
      Squad: { activeSquad: 1 }
    }
  };
}

export function runPlayerSearchTests() {
  installLodashMock();

  const service = new PlayerSearchService();
  const helpers = makeHelpers([makePlayer(), makePlayer({ id: 2, databaseId: 101, definitionId: 1001, rating: 70 })]);

  const first = service.search(2, { GTrating: 60 }, false, false, helpers);
  const second = service.search(2, { GTrating: 60 }, false, false, helpers);

  assert.strictEqual(first.length, 2);
  assert.strictEqual(second.length, 2);
  assert.deepStrictEqual(
    first.map((p) => p.definitionId),
    second.map((p) => p.definitionId)
  );

  service.invalidateCache();
  const ids = service.search(1, { GTrating: 60 }, false, false, helpers);
  assert.deepStrictEqual(ids, [1001, 1000]);

  const valueService = new PlayerValueService(() => ({ base: { price: { 80: 500 } } }));
  assert.strictEqual(valueService.isPrecious(80, ItemRarity.NONE, 0, 0), true);
  assert.strictEqual(valueService.isPrecious(80, ItemRarity.NONE, 1000, 0), true);
  assert.strictEqual(valueService.isPrecious(80, ItemRarity.NONE, 200, 0), false);

  const cache = new TtlCache({ maxSize: 2, ttlMs: 50 });
  cache.set("a", 1);
  assert.strictEqual(cache.get("a"), 1);
  cache.set("b", 2);
  cache.set("c", 3);
  assert.strictEqual(cache.get("a"), undefined);

  let calls = 0;
  const queue = new PriceRequestQueue();
  const run = queue.run("k", async () => {
    calls += 1;
    return 42;
  });
  const run2 = queue.run("k", async () => {
    calls += 1;
    return 99;
  });
  assert.strictEqual(calls, 1);
  assert.strictEqual(run, run2);
}