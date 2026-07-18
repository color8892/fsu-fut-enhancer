import assert from "assert";
import { RemoteConfigService } from "../src/fsu/domain/RemoteConfigService.js";

function installLodashMock() {
  globalThis._ = {
    flatMap(collection, iteratee) {
      return Object.entries(collection).flatMap(([key, value]) => iteratee(value, key));
    },
    forEach(collection, iteratee) {
      Object.entries(collection || {}).forEach(([key, value]) => iteratee(value, key));
    },
    fromPairs(pairs) {
      return Object.fromEntries(pairs);
    },
    has(object, key) {
      return Object.prototype.hasOwnProperty.call(object || {}, key);
    },
    map(collection, iteratee) {
      return collection.map(iteratee);
    },
    size(value) {
      return Array.isArray(value) ? value.length : Object.keys(value || {}).length;
    }
  };
}

function createInfo() {
  return {
    api: {},
    base: { fastsbc: {}, oddo: null },
    evolutions: { new: [] },
    inpacks: {},
    meta: {},
    task: { sbc: {} }
  };
}

export function runRemoteConfigServiceTests() {
  installLodashMock();

  const info = createInfo();
  const notices = [];
  const requests = [];
  const headers = [];
  const service = new RemoteConfigService({
    info,
    fy: (key) => key,
    debug: { log: () => {} },
    notice: (...args) => notices.push(args),
    request: (details) => requests.push(details),
    taskHtml: (count, rewards) => `count:${count};rewards:${rewards}`,
    scriptVersion: "1",
    nowSeconds: () => 100,
    applyLowprice: (target, data) => {
      target.lowpriceApplied = data;
    }
  });

  service.load({ onHeaderReady: (header) => headers.push(header) });
  assert.strictEqual(requests.length, 1);
  assert.strictEqual(requests[0].url, "https://api.fut.to/26/updata.json");

  requests[0].onload({
    status: 200,
    response: JSON.stringify({
      version: 2,
      updateURL: "https://example.com/update",
      api: {
        meta: "m1",
        fastsbc: "f1",
        sbc: "s1",
        evolutions: "e1",
        lowprice: "l1"
      }
    })
  });

  assert.deepStrictEqual(notices, [["notice.upgradeconfirm", 1]]);
  assert.deepStrictEqual(headers, [
    { urlText: "top.upgrade", urlLink: "https://example.com/update" }
  ]);
  assert.strictEqual(requests.length, 6);
  assert.strictEqual(requests[1].url, "https://api.fut.to/26/meta.json?m1");
  assert.strictEqual(requests[2].url, "https://api.fut.to/26/fast.json?f1");
  assert.strictEqual(requests[3].url, "https://api.fut.to/26/sbc.json?s1");
  assert.strictEqual(requests[4].url, "https://api.fut.to/26/evolutions.json?e1");
  assert.strictEqual(requests[5].url, "https://api.fut.to/26/lowprice.json?l1");

  requests[1].onload({
    response: JSON.stringify({
      bodyType: { 2: [10, 11] },
      baseBodyType: { 10: 2 },
      realFace: [10]
    })
  });
  assert.deepStrictEqual(info.meta.bodyType, { 10: 2, 11: 2 });
  assert.deepStrictEqual(info.meta.baseBodyType, { 10: 2 });
  assert.deepStrictEqual(info.meta.realFace, [10]);
  const previousMeta = structuredClone(info.meta);
  assert.strictEqual(
    service.applyMeta({
      bodyType: { 2: ["bad"] },
      baseBodyType: {},
      realFace: []
    }),
    false
  );
  assert.deepStrictEqual(info.meta, previousMeta);

  requests[2].onload({
    response: JSON.stringify({
      "1#2": { t: 200, g: [{ c: 1, t: { rating: 84 } }] },
      expired: { t: 10, g: [{ c: 2, t: { gs: 1 } }] }
    })
  });
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(info.base.fastsbc)),
    { "1#2": [{ c: 1, t: { rating: 84 } }] }
  );

  requests[3].onload({
    response: JSON.stringify({ reward: [1, 2], new: [7, 8] })
  });
  assert.deepStrictEqual(info.task.sbc.stat, { reward: [1, 2], new: [7, 8] });
  assert.strictEqual(info.task.sbc.html, "count:2;rewards:task.player、task.pack");

  requests[4].onload({ response: JSON.stringify({ new: [99] }) });
  assert.deepStrictEqual(info.evolutions.new, [99]);

  requests[5].onload({ response: JSON.stringify({ pc: { 84: 1200 } }) });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(info.lowpriceApplied)), {
    pc: { "84": 1200 }
  });

  info.playermeta = { 5: { badytype: 1, weight: 70, realface: 0 } };
  assert.strictEqual(service.applyPlayerMeta([[6, 2, "invalid", 1]]), false);
  assert.deepStrictEqual(info.playermeta, {
    5: { badytype: 1, weight: 70, realface: 0 }
  });
  assert.strictEqual(service.applyPlayerMeta([[6, 2, 80, 1]]), true);
  assert.deepStrictEqual(info.playermeta, {
    6: { badytype: 2, weight: 80, realface: 1 }
  });

  // Malformed refresh retains previous good state.
  info.base.fastsbc = { keep: [{ c: 9 }] };
  assert.strictEqual(service.applyFastSbc({ bad: true }), false);
  assert.deepStrictEqual(info.base.fastsbc, { keep: [{ c: 9 }] });

  info.base.oddo = { "1": 10 };
  assert.strictEqual(service.applyPack(null), false);
  assert.deepStrictEqual(info.base.oddo, { "1": 10 });

  info.task.sbc.stat = { reward: [1], new: [2] };
  assert.strictEqual(service.applySbc({ reward: "nope" }), false);
  assert.deepStrictEqual(info.task.sbc.stat, { reward: [1], new: [2] });

  // Endpoint failure isolation: pack fail does not block sbc apply.
  assert.strictEqual(service.applyPack({ x: Number.NaN }), false);
  assert.strictEqual(service.applySbc({ reward: [2], new: [3] }), true);
  assert.deepStrictEqual(info.task.sbc.stat, { reward: [2], new: [3] });
}
