import assert from "node:assert/strict";
import {
  parsePackPreview,
  parsePackProbability,
  parsePlayerPickPreview
} from "../src/fsu/domain/PackPreviewResults.js";
import { PackPreviewService } from "../src/fsu/domain/PackPreviewService.js";

export async function runPackPreviewTests() {
  assert.deepEqual(
    parsePlayerPickPreview(
      "https://cdn.futnext.com/player/123.png x https://cdn.futnext.com/player/123.png https://cdn.futnext.com/player/456.png"
    ),
    { success: true, data: [123, 456] }
  );
  assert.equal(parsePlayerPickPreview("bad").success, false);

  const packText =
    String.raw`x packItem\":{\"items\":[],\"pack\":{\"returns\":{\"avgReturns\":10}}},\"renderItemByDefault`;
  const pack = parsePackPreview(packText);
  assert.equal(pack.success, true);
  assert.equal(pack.data.packItem.pack.returns.avgReturns, 10);

  const probabilityText =
    String.raw`x \"rarityOdds\":[{\"rarity\":{\"id\":1},\"odds\":0.1}],\"ratingOdds\":[{\"rating\":90,\"odds\":0.01}]},\"returns`;
  const probability = parsePackProbability(probabilityText);
  assert.equal(probability.success, true);
  assert.deepEqual(probability.data.rarity, [{ id: 1, odds: 0.1 }]);

  const urls = [];
  const service = new PackPreviewService({
    request: async (_method, url) => {
      urls.push(url);
      return "bad";
    }
  });
  await service.getPackPreview({ id: 1001, name: "Gold Pack" });
  assert.equal(
    urls[0],
    "https://www.futnext.com/pack/Gold-Pack/1001/open"
  );
  assert.equal(service.buildUrl("pack", 0, "bad", true), null);
}
