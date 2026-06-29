import assert from "assert";
import { applyFsuLodashMixins } from "../src/fsu/domain/lodashMixins.js";
import { SbcRatingService } from "../src/fsu/domain/SbcRatingService.js";

function installLodashMock() {
  const lodash = {
    values(target) {
      return Array.isArray(target) ? [...target] : Object.values(target || {});
    },
    concat(...parts) {
      return parts.flat();
    },
    flatMap(collection, iteratee) {
      if (Array.isArray(collection)) {
        return collection.flatMap((item, index) => {
          const result = iteratee(item, index);
          if (result == null) return [];
          return Array.isArray(result) ? result : [result];
        });
      }
      return Object.entries(collection || {}).flatMap(([key, value]) => {
        const result = iteratee(value, key);
        if (result == null) return [];
        return Array.isArray(result) ? result : [result];
      });
    },
    forEach(collection, iteratee) {
      collection.forEach(iteratee);
    },
    indexOf(collection, value) {
      return collection.indexOf(value);
    },
    slice(collection, start, end) {
      return collection.slice(start, end);
    },
    countBy(collection) {
      return collection.reduce((acc, value) => {
        const key = String(value);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
    },
    times(count, iteratee) {
      return Array.from({ length: count }, (_, index) => iteratee(index));
    },
    constant(value) {
      return () => value;
    },
    sum(collection) {
      return collection.reduce((total, value) => total + value, 0);
    },
    orderBy(collection, iteratees, orders) {
      return [...collection].sort((left, right) => {
        for (let index = 0; index < iteratees.length; index++) {
          const key = iteratees[index];
          const order = orders[index] === "desc" ? -1 : 1;
          if (left[key] < right[key]) return -1 * order;
          if (left[key] > right[key]) return 1 * order;
        }
        return 0;
      });
    },
    take(collection, count) {
      return collection.slice(0, count);
    },
    mixin(source) {
      Object.assign(lodash, source);
    }
  };

  applyFsuLodashMixins(lodash);
  globalThis._ = lodash;
}

export function runSbcRatingTests() {
  installLodashMock();
  const service = new SbcRatingService();

  assert.strictEqual(service.teamRatingCount([80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80]), 80);

  const availableRatings = Array.from({ length: 99 - 45 + 1 }, (_entry, index) => 99 - index);
  const results = service.needRatingsCountFromOptionsJs({
    target: 84,
    existing_ratings: [],
    brick_count: 0,
    available_ratings: availableRatings,
    available_counts: {},
    price_by_rating: {},
    squad_absent: true
  });

  assert.ok(results.length > 0);
  assert.ok(results.length <= 3);
  for (const result of results) {
    assert.strictEqual(result.ratings.length, 11);
    assert.strictEqual(result.squadRating, service.teamRatingCount(result.ratings));
    assert.ok(result.squadRating >= 84);
  }
}