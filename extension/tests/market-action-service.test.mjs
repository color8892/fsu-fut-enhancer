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

  const info = { base: { sId: "expired" } };
  const notices = [];
  const unauthorizedAuctions = await service._getAuctionPrice(1, 1000, {
    getInfo: () => info,
    notice: (...args) => notices.push(args),
    ea: {
      getUtasSessionId: () => "refreshed",
      inspect: () => ({ supported: true, missing: [] })
    },
    xmlHttpRequest: ({ onload }) => onload({ status: 401 })
  });
  assert.deepStrictEqual(unauthorizedAuctions, []);
  assert.strictEqual(info.base.sId, "refreshed");
  assert.deepStrictEqual(notices, [["notice.loaderror", 2]]);

  const networkErrorAuctions = await service._getAuctionPrice(1, 1000, {
    ...helpers,
    xmlHttpRequest: ({ onerror }) => onerror(new Error("offline"))
  });
  assert.deepStrictEqual(networkErrorAuctions, []);

  const criteria = { maxBuy: 1200 };
  const delegatedResponse = { success: true, data: { items: [{ id: 9 }] } };
  const delegated = await service.searchTransferMarket(criteria, 1, {
    ea: {
      searchTransferMarket(receivedCriteria, type, context) {
        assert.strictEqual(receivedCriteria, criteria);
        assert.strictEqual(type, 1);
        assert.strictEqual(context, service);
        return Promise.resolve(delegatedResponse);
      }
    }
  });
  assert.strictEqual(delegated, delegatedResponse);
}
