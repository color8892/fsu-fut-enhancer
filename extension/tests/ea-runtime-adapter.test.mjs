import assert from "assert";
import {
  EA_CAPABILITIES,
  EaRuntimeAdapter
} from "../src/fsu/ea/EaRuntimeAdapter.js";

export async function runEaRuntimeAdapterTests() {
  const missingServices = new EaRuntimeAdapter();
  assert.deepStrictEqual(missingServices.inspect(EA_CAPABILITIES.UTAS_SESSION), {
    name: EA_CAPABILITIES.UTAS_SESSION,
    supported: false,
    missing: ["services"]
  });
  assert.strictEqual(missingServices.getUtasSessionId(), null);
  assert.deepStrictEqual(missingServices.inspect("unknown.capability"), {
    name: "unknown.capability",
    supported: false,
    missing: ["capability:unknown.capability"]
  });

  const runtime = { Authentication: { utasSession: { id: "session-1" } } };
  const adapter = new EaRuntimeAdapter({ getServices: () => runtime });
  assert.strictEqual(adapter.supports(EA_CAPABILITIES.UTAS_SESSION), true);
  assert.strictEqual(adapter.getUtasSessionId(), "session-1");

  runtime.Authentication.utasSession.id = "session-2";
  assert.strictEqual(adapter.getUtasSessionId(), "session-2");

  let cacheCleared = false;
  let observedContext = null;
  const marketRuntime = {
    Item: {
      clearTransferMarketCache() {
        cacheCleared = true;
      },
      searchTransferMarket(criteria, type) {
        assert.deepStrictEqual(criteria, { maxBuy: 1200 });
        assert.strictEqual(type, 1);
        return {
          observe(context, callback) {
            observedContext = context;
            callback(this, { success: true, data: { items: [{ id: 7 }] } });
          }
        };
      }
    }
  };
  const marketAdapter = new EaRuntimeAdapter({ getServices: () => marketRuntime });
  assert.strictEqual(marketAdapter.supports(EA_CAPABILITIES.MARKET_SEARCH), true);
  assert.strictEqual(marketAdapter.clearTransferMarketCache(), true);
  assert.strictEqual(cacheCleared, true);

  const observerContext = { name: "market-test" };
  const marketResponse = await marketAdapter.searchTransferMarket(
    { maxBuy: 1200 },
    1,
    observerContext
  );
  assert.strictEqual(observedContext, observerContext);
  assert.deepStrictEqual(marketResponse, {
    success: true,
    data: { items: [{ id: 7 }] }
  });

  const unavailableMarket = await missingServices.searchTransferMarket({}, 1, null);
  assert.deepStrictEqual(unavailableMarket, {
    success: false,
    data: { items: [] },
    error: {
      code: "EA_CAPABILITY_UNAVAILABLE",
      capability: EA_CAPABILITIES.MARKET_SEARCH,
      missing: ["services"],
      cause: undefined
    }
  });

  class SearchCriteria {}
  class SearchModel {
    constructor() {
      this.defaultSearchCriteria = {};
      this.searchCriteria = {};
      this.searchFeature = null;
    }

    updateSearchCriteria(criteria) {
      this.searchCriteria = { ...criteria };
    }
  }
  class CurrencyInput {
    static getIncrementAboveVal(value) {
      return value + 100;
    }

    static getIncrementBelowVal(value) {
      return value - 100;
    }
  }
  const queryAdapter = new EaRuntimeAdapter({
    getMarketRuntime: () => ({
      UTSearchCriteriaDTO: SearchCriteria,
      UTBucketedItemSearchViewModel: SearchModel,
      UTCurrencyInputControl: CurrencyInput,
      SearchType: { PLAYER: "player" },
      SearchCategory: { ANY: "any" },
      ItemSearchFeature: { MARKET: "market" }
    })
  });
  assert.strictEqual(queryAdapter.supports(EA_CAPABILITIES.MARKET_QUERY_MODEL), true);
  assert.strictEqual(queryAdapter.supports(EA_CAPABILITIES.CURRENCY_STEPS), true);

  const searchSession = queryAdapter.createPlayerMarketSearch(123);
  assert.ok(searchSession);
  assert.deepStrictEqual(searchSession.getCriteria(), {
    defId: [123],
    type: "player",
    category: "any"
  });
  searchSession.setMaxBuy(1200);
  assert.strictEqual(searchSession.getMaxBuy(), 1200);
  assert.strictEqual(searchSession.getCriteria().maxBuy, 1200);
  assert.strictEqual(queryAdapter.incrementMarketPrice(1200, "above"), 1300);
  assert.strictEqual(queryAdapter.incrementMarketPrice(1200, "below"), 1100);

  assert.strictEqual(missingServices.createPlayerMarketSearch(123), null);
  assert.strictEqual(missingServices.incrementMarketPrice(1200, "above"), null);

  const notifications = [];
  const handledStatuses = [];
  let unobservedContext = null;
  let moveResponse = { success: true, data: { itemIds: [1, 2] } };
  const moveServices = {
    Item: {
      move(items, pile) {
        assert.deepStrictEqual(items, [1, 2, 3]);
        assert.strictEqual(pile, "club");
        return {
          observe(_context, callback) {
            callback(
              { unobserve: (context) => (unobservedContext = context) },
              moveResponse
            );
          }
        };
      }
    },
    Localization: {
      localize: (key, args) => `${key}:${args?.[0] ?? ""}`
    },
    Notification: {
      queue: (payload) => notifications.push(payload)
    }
  };
  const moveAdapter = new EaRuntimeAdapter({
    getServices: () => moveServices,
    getItemRuntime: () => ({
      ItemPile: { CLUB: "club" },
      UINotificationType: { NEUTRAL: "neutral", NEGATIVE: "negative" },
      NetworkErrorManager: {
        handleStatus: (status) => handledStatuses.push(status)
      }
    })
  });
  assert.strictEqual(moveAdapter.supports(EA_CAPABILITIES.ITEM_MOVE_TO_CLUB), true);
  const moveContext = { name: "move-context" };
  const moved = await moveAdapter.moveItemsToClub([1, 2, 3], moveContext);
  assert.deepStrictEqual(moved, { success: true, movedCount: 2 });
  assert.strictEqual(unobservedContext, moveContext);
  assert.deepStrictEqual(notifications, [
    ["notification.item.allToClub:2", "neutral"]
  ]);

  moveResponse = {
    success: false,
    status: 500,
    data: { untradeableSwap: false }
  };
  const failedMove = await moveAdapter.moveItemsToClub([1, 2, 3], moveContext);
  assert.deepStrictEqual(failedMove, {
    success: false,
    movedCount: 0,
    untradeableSwap: false,
    status: 500
  });
  assert.deepStrictEqual(notifications.at(-1), ["notification.item.moveFailed:", "negative"]);
  assert.deepStrictEqual(handledStatuses, [500]);

  moveResponse = {
    success: false,
    status: 409,
    data: { untradeableSwap: true }
  };
  const swapFailure = await moveAdapter.moveItemsToClub([1, 2, 3], moveContext);
  assert.strictEqual(swapFailure.untradeableSwap, true);
  assert.deepStrictEqual(handledStatuses, [500]);

  const unavailableMove = await missingServices.moveItemsToClub([], null);
  assert.deepStrictEqual(unavailableMove, {
    success: false,
    movedCount: 0,
    error: {
      code: "EA_CAPABILITY_UNAVAILABLE",
      capability: EA_CAPABILITIES.ITEM_MOVE_TO_CLUB,
      missing: ["services"],
      cause: undefined
    }
  });

  assert.deepStrictEqual(adapter.inspect("unknown.capability"), {
    name: "unknown.capability",
    supported: false,
    missing: ["capability:unknown.capability"]
  });
}
