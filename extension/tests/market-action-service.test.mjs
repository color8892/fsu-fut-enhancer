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

  let currentMaxBuy = 0;
  const queriedPrices = [];
  const readOnlyResult = await service.readAuctionPrices(123, 1000, null, {
    getInfo: () => ({ set: { queries_number: 2 }, futbinId: {} }),
    changeLoadingText: () => {},
    getCachePrice: () => ({ num: 1000 }),
    wait: async () => {},
    notice: () => {},
    sendPinEvents: () => {},
    futbinId: {},
    debug: { log: () => {} },
    ea: {
      createPlayerMarketSearch() {
        return {
          setMaxBuy(value) {
            currentMaxBuy = value;
          },
          getMaxBuy() {
            return currentMaxBuy;
          },
          getCriteria() {
            return { maxBuy: currentMaxBuy };
          }
        };
      },
      clearTransferMarketCache() {},
      searchTransferMarket(receivedCriteria) {
        queriedPrices.push(receivedCriteria.maxBuy);
        const items = queriedPrices.length === 1 ? [] : [{ id: 11 }];
        return Promise.resolve({ success: true, data: { items } });
      },
      incrementMarketPrice(value, direction) {
        assert.strictEqual(direction, "above");
        return value + 100;
      }
    }
  });
  assert.deepStrictEqual(queriedPrices, [1000, 1100]);
  assert.deepStrictEqual(readOnlyResult, [{ id: 11 }]);
}
