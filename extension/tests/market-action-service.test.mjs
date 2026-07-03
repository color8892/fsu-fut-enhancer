import assert from "assert";
import { MarketActionService } from "../src/fsu/domain/MarketActionService.js";

export async function runMarketActionServiceTests() {
  const service = new MarketActionService();
  const helpers = {
    getInfo: () => ({ base: { sId: "sid" } }),
    notice: () => {},
    xmlHttpRequest: ({ onload }) => {
      onload({
        status: 200,
        response: "{\"auctionInfo\":[{\"buyNowPrice\":1200}]}"
      });
    }
  };

  const auctions = await service._getAuctionPrice(1, 1000, helpers);
  assert.deepStrictEqual(auctions, [{ buyNowPrice: 1200 }]);

  const emptyAuctions = await service._getAuctionPrice(1, 1000, {
    ...helpers,
    xmlHttpRequest: ({ onload }) => {
      onload({
        status: 200,
        response: "<html>bad gateway</html>"
      });
    }
  });
  assert.deepStrictEqual(emptyAuctions, []);
}
