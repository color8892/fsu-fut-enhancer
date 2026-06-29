import assert from "assert";
import {
  applyLowpriceToInfo,
  buildPriceByRating,
  parseLowpricePlatform,
  resolvePriceByRating
} from "../src/fsu/infra/RatingPrices.js";

export function runRatingPricesTests() {
  const data = {
    pc: { 84: 1200, 85: 1500, low: 45, high: 99 },
    ps: { 84: 1100 }
  };

  const pc = parseLowpricePlatform(data, "pc");
  assert.strictEqual(pc[84], 1200);
  assert.strictEqual(pc[85], 1500);
  assert.strictEqual(pc.low, undefined);

  const info = { base: { platform: "ps", price: {} } };
  applyLowpriceToInfo(info, data);
  assert.strictEqual(info.base.price[84], 1100);
  assert.strictEqual(resolvePriceByRating(info, 84), 1100);

  const priceMap = buildPriceByRating(info, [84, 83]);
  assert.strictEqual(priceMap[84], 1100);
  assert.strictEqual(priceMap[83], 0);
}