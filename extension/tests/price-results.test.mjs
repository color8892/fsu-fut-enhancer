import assert from "node:assert/strict";
import {
  PRICE_RESULT_INVALID,
  parseFutbinPrices,
  parseFutGgPrices,
  parseFutNextPrices
} from "../src/fsu/domain/PriceResults.js";

export function runPriceResultTests() {
  assert.deepEqual(
    parseFutGgPrices(
      {
        data: [
          {
            eaId: 101,
            price: 1500,
            isExtinct: false,
            isSbc: false,
            isObjective: false,
            premiumSeasonPassLevel: null,
            standardSeasonPassLevel: null
          },
          {
            eaId: 102,
            price: null,
            isExtinct: false,
            isSbc: true,
            isObjective: false,
            premiumSeasonPassLevel: null,
            standardSeasonPassLevel: null
          }
        ]
      },
      10_000
    ),
    {
      success: true,
      data: {
        prices: {
          101: { n: 1500, y: 0, _ts: 10_000 },
          102: { n: 0, y: 1, _ts: 10_000 }
        }
      },
      stale: false
    }
  );

  const partialInvalid = parseFutGgPrices(
    {
      data: [
        { eaId: 101, price: 1500 },
        { eaId: 102, price: "invalid" }
      ]
    },
    10_000
  );
  assert.equal(partialInvalid.success, false);
  assert.equal(partialInvalid.error?.code, PRICE_RESULT_INVALID);
  assert.deepEqual(partialInvalid.data.prices, {});

  assert.deepEqual(parseFutGgPrices({ data: [] }, 10_000), {
    success: true,
    data: { prices: {} },
    stale: false
  });

  assert.deepEqual(
    parseFutNextPrices(
      [
        { definitionId: 201, prices: [900] },
        { definitionId: 202, prices: [] }
      ],
      20_000
    ),
    {
      success: true,
      data: { prices: { 201: { n: 900, y: 0, _ts: 20_000 } } },
      stale: false
    }
  );

  const malformedFutNext = parseFutNextPrices(
    [{ definitionId: 201, prices: ["900"] }],
    20_000
  );
  assert.equal(malformedFutNext.success, false);
  assert.equal(malformedFutNext.error?.provider, "futnext");

  assert.deepEqual(
    parseFutbinPrices(
      {
        data: [
          {
            Player_Resource: "301",
            pc_LCPrice: "2100",
            pc_MinPrice: "100",
            pc_MaxPrice: "5000"
          }
        ]
      },
      {
        definitionIdKey: "Player_Resource",
        platform: "pc",
        now: 30_000
      }
    ),
    {
      success: true,
      data: { prices: { 301: { n: 2100, y: 0, _ts: 30_000 } } },
      stale: false
    }
  );

  const malformedFutbin = parseFutbinPrices(
    { data: [{ Player_Resource: 301, LCPrice: "not-a-price" }] },
    {
      definitionIdKey: "Player_Resource",
      platform: "pc",
      now: 30_000
    }
  );
  assert.equal(malformedFutbin.success, false);
  assert.equal(malformedFutbin.error?.provider, "futbin");
}
