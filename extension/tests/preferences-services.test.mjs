import assert from "assert";
import { SettingsService } from "../src/fsu/domain/SettingsService.js";
import { BuildPreferencesService } from "../src/fsu/domain/BuildPreferencesService.js";
import { PlayerLockService } from "../src/fsu/domain/PlayerLockService.js";
import { SbcCountService } from "../src/fsu/domain/SbcCountService.js";

globalThis._ = {
  merge(target, source) {
    return Object.assign(target, source);
  },
  has(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }
};

function createInfo() {
  return {
    set: {},
    setfield: { card: ["price"] },
    build: { league: true },
    lock: [],
    SBCCount: {},
    nave: {}
  };
}

export function runPreferencesServiceTests() {
  const info = createInfo();
  const writes = [];

  const store = {
    getObject(key, fallback) {
      return writes.find((entry) => entry.key === key)?.value ?? fallback;
    },
    getArray(key, fallback) {
      const value = this.getObject(key, fallback);
      return Array.isArray(value) ? value : fallback;
    },
    setJson(key, value) {
      const existing = writes.findIndex((entry) => entry.key === key);
      if (existing === -1) {
        writes.push({ key, value });
      } else {
        writes[existing].value = value;
      }
    }
  };

  let saved = false;
  const settings = new SettingsService({
    store,
    getInfo: () => info,
    debug: { log: () => {} }
  });
  settings.setOnSave(() => {
    saved = true;
  });
  settings.init(false);
  assert.strictEqual(info.set.card_price, true);
  settings.save("card_price", false);
  assert.strictEqual(saved, true);
  assert.strictEqual(info.set.card_price, false);

  const build = new BuildPreferencesService({
    store,
    getInfo: () => info,
    debug: { log: () => {} }
  });
  build.set("league", false);
  assert.strictEqual(info.build.league, false);

  let lockMessage = "";
  const lock = new PlayerLockService({
    store,
    getInfo: () => info,
    debug: { log: () => {} }
  });
  lock.setOnToggle((action) => {
    lockMessage = action;
  });
  lock.toggle(42);
  assert.deepStrictEqual(info.lock, [42]);
  assert.strictEqual(lockMessage, "lock");
  lock.toggle(42);
  assert.deepStrictEqual(info.lock, []);
  assert.strictEqual(lockMessage, "unlock");

  const sbcCount = new SbcCountService({
    store,
    getInfo: () => info,
    debug: { log: () => {} }
  });
  sbcCount.init();
  assert.strictEqual(info.SBCCount.count, 0);
  sbcCount.recordCompletion();
  assert.strictEqual(info.SBCCount.count, 1);
  sbcCount.recordCompletion();
  assert.strictEqual(info.SBCCount.count, 2);
}