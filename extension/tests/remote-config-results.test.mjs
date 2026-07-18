import assert from "node:assert/strict";
import {
  parseFastSbcConfig,
  parseFgConfig,
  parseInpacksConfig,
  parseLowpriceConfig,
  parseOtherConfig,
  parsePackConfig,
  parseSbcConfig,
  parseUpdataConfig,
  REMOTE_CONFIG_INVALID
} from "../src/fsu/domain/RemoteConfigResults.js";

export function runRemoteConfigResultsTests() {
  // updata success
  const updata = parseUpdataConfig({
    version: 3,
    updateURL: "https://example.com/update",
    api: { meta: "m1", fastsbc: "f1" }
  });
  assert.equal(updata.success, true);
  assert.equal(updata.data.version, 3);
  assert.equal(updata.data.updateURL, "https://example.com/update");
  assert.equal(updata.data.api.meta, "m1");

  assert.equal(parseUpdataConfig(null).success, false);
  assert.equal(parseUpdataConfig({ updateURL: "http://insecure" }).success, false);
  assert.equal(
    parseUpdataConfig({ api: { unknown: "x" } }).success,
    false
  );
  assert.equal(
    parseUpdataConfig({ api: { meta: "bad token!" } }).success,
    false
  );
  const pollutedUpdata = parseUpdataConfig(
    JSON.parse('{"version":1,"api":{"__proto__":"x"}}')
  );
  assert.equal(pollutedUpdata.success, false);
  assert.equal(pollutedUpdata.error.code, REMOTE_CONFIG_INVALID);
  assert.ok(!JSON.stringify(pollutedUpdata.error).includes("response body"));

  // fastsbc
  const fast = parseFastSbcConfig(
    {
      "1#2": { t: 200, g: [{ c: 1, t: { rating: 84 } }] },
      expired: { t: 10, g: [{ c: 2, t: { gs: 1, rs: 2 } }] }
    },
    100
  );
  assert.equal(fast.success, true);
  assert.deepEqual(
    JSON.parse(JSON.stringify(fast.data)),
    { "1#2": [{ c: 1, t: { rating: 84 } }] }
  );
  assert.equal(parseFastSbcConfig([], 1).success, false);
  assert.equal(
    parseFastSbcConfig({ a: { t: Number.NaN, g: [] } }, 1).success,
    false
  );
  assert.equal(
    parseFastSbcConfig(JSON.parse('{"__proto__":{"t":999,"g":[]}}'), 1).success,
    false
  );
  assert.equal(
    parseFastSbcConfig({ a: { t: 999, g: [{ c: 1, t: {} }] } }, 1).success,
    false
  );

  // pack
  const pack = parsePackConfig({ "100": 500, "200": 0 });
  assert.equal(pack.success, true);
  assert.equal(pack.data["100"], 500);
  assert.equal(parsePackConfig({ x: Infinity }).success, false);
  assert.equal(parsePackConfig("nope").success, false);

  // sbc
  const sbc = parseSbcConfig({ reward: [1, 2], new: [7, 8] });
  assert.equal(sbc.success, true);
  assert.deepEqual(sbc.data, { reward: [1, 2], new: [7, 8] });
  assert.equal(parseSbcConfig({ reward: [-1] }).success, false);
  assert.equal(parseSbcConfig({ new: ["x"] }).success, false);

  // inpacks
  const inpacks = parseInpacksConfig({ defIds: [1, 2], rarityIds: [0, 3] });
  assert.equal(inpacks.success, true);
  assert.equal(parseInpacksConfig({ defIds: [-1] }).success, false);
  assert.equal(parseInpacksConfig([]).success, false);

  // other
  const other = parseOtherConfig({
    dynamic: {
      "12": {
        exp: 9999999999,
        change: [1, 4],
        url: "players/123/example"
      }
    },
    chem: {
      "3": {
        full: 1,
        nation: 2,
        league: 3,
        club: 4,
        allNation: 5,
        allLeague: 6,
        url: "players/456/example"
      }
    }
  });
  assert.equal(other.success, true);
  assert.deepEqual(other.data.dynamic["12"].change, [1, 4]);
  assert.equal(other.data.dynamic["12"].url, "players/123/example");
  assert.equal(other.data.chem["3"].allLeague, 6);
  assert.equal(other.data.chem["3"].url, "players/456/example");
  assert.equal(
    parseOtherConfig(JSON.parse('{"dynamic":{"__proto__":{}}}')).success,
    false
  );
  assert.equal(parseOtherConfig({ dynamic: { "x": {} } }).success, false);
  assert.equal(
    parseOtherConfig({
      dynamic: { "12": { change: [], url: "https://evil.example/" } }
    }).success,
    false
  );
  assert.equal(
    parseOtherConfig({
      chem: { "3": { full: Number.NaN, url: "players/3" } }
    }).success,
    false
  );

  // fgconfig
  const fg = parseFgConfig({
    attribute: { 1: { id: 1, reduce: 0, factor: 1 } },
    roles: [{ posId: 0, role: 1, factors: { 1: 2 }, multiplier: 1 }],
    weakFoot: {},
    skillMoves: {},
    foot: {},
    playStyle: {},
    plusPlayStyle: {},
    height: { min: { value: 1, id: 1 }, max: { value: 2, id: 2 } },
    weight: { min: { value: 1, id: 1 }, max: { value: 2, id: 2 } },
    minExpectedScore: 0,
    maxExpectedScore: 100,
    targetMin: 0,
    targetMax: 10,
    smoothnessFactor: 1,
    special1: 1,
    special2: 2
  });
  assert.equal(fg.success, true);
  assert.equal(Object.getPrototypeOf(fg.data.attribute), null);
  assert.equal(parseFgConfig({ attribute: {} }).success, false);
  assert.equal(parseFgConfig({ roles: [] }).success, false);
  assert.equal(
    parseFgConfig({
      attribute: {},
      roles: [],
      weakFoot: {},
      skillMoves: {},
      foot: {},
      playStyle: {},
      plusPlayStyle: {},
      height: {},
      weight: {},
      minExpectedScore: Number.NaN
    }).success,
    false
  );

  // lowprice
  const low = parseLowpriceConfig({ pc: { 84: 1200 }, ps: { 85: 900 } });
  assert.equal(low.success, true);
  assert.equal(low.data.pc["84"], 1200);
  assert.equal(parseLowpriceConfig({ pc: { 200: 1 } }).success, false);
  assert.equal(parseLowpriceConfig({ pc: { 84: -1 } }).success, false);
  assert.equal(
    parseLowpriceConfig(JSON.parse('{"__proto__":{"84":1}}')).success,
    false
  );

  // oversized array reject
  const big = new Array(5001).fill(1);
  assert.equal(parseSbcConfig({ new: big }).success, false);
}
