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

  let bidResponse = { success: true };
  let purchaseMoveResponse = { success: true };
  const purchaseUnobservedContexts = [];
  const purchaseCalls = [];
  const purchaseServices = {
    User: {
      getUser() {
        return {
          getCurrency(currency) {
            assert.strictEqual(currency, "coins");
            return { amount: 5000 };
          }
        };
      }
    },
    Item: {
      bid(item, price) {
        purchaseCalls.push(["bid", item, price]);
        return {
          observe(_context, callback) {
            callback(
              {
                unobserve(context) {
                  purchaseUnobservedContexts.push(["bid", context]);
                }
              },
              bidResponse
            );
          }
        };
      },
      move(item, pile) {
        purchaseCalls.push(["move", item, pile]);
        return {
          observe(_context, callback) {
            callback(
              {
                unobserve(context) {
                  purchaseUnobservedContexts.push(["move", context]);
                }
              },
              purchaseMoveResponse
            );
          }
        };
      }
    }
  };
  const purchaseAdapter = new EaRuntimeAdapter({
    getServices: () => purchaseServices,
    getItemRuntime: () => ({
      ItemPile: { CLUB: "club" },
      GameCurrency: { COINS: "coins" },
      UtasErrorCode: { PERMISSION_DENIED: "permission-denied" }
    })
  });
  const purchaseContext = { name: "purchase-context" };
  let hasFunds = true;
  let secondsRemaining = 30;
  const purchaseItem = {
    getAuctionData() {
      return {
        canBuy(balance) {
          assert.strictEqual(balance, 5000);
          return hasFunds;
        },
        getSecondsRemaining() {
          return secondsRemaining;
        }
      };
    }
  };
  let beforeBidCalls = 0;
  assert.strictEqual(
    purchaseAdapter.supports(EA_CAPABILITIES.ITEM_PURCHASE_TO_CLUB),
    true
  );
  const purchased = await purchaseAdapter.purchaseItemToClub(
    purchaseItem,
    1200,
    purchaseContext,
    () => beforeBidCalls++
  );
  assert.deepStrictEqual(purchased, { success: true, price: 1200 });
  assert.strictEqual(beforeBidCalls, 1);
  assert.deepStrictEqual(purchaseCalls, [
    ["bid", purchaseItem, 1200],
    ["move", purchaseItem, "club"]
  ]);
  assert.deepStrictEqual(purchaseUnobservedContexts, [
    ["bid", purchaseContext],
    ["move", purchaseContext]
  ]);

  hasFunds = false;
  assert.deepStrictEqual(
    await purchaseAdapter.purchaseItemToClub(purchaseItem, 1200, purchaseContext),
    { success: false, reason: "insufficient-funds" }
  );
  hasFunds = true;
  secondsRemaining = 0;
  assert.deepStrictEqual(
    await purchaseAdapter.purchaseItemToClub(purchaseItem, 1200, purchaseContext),
    { success: false, reason: "expired" }
  );
  secondsRemaining = 30;
  bidResponse = { success: false, error: { code: "permission-denied" } };
  assert.deepStrictEqual(
    await purchaseAdapter.purchaseItemToClub(purchaseItem, 1200, purchaseContext),
    { success: false, reason: "bid-failed", permissionDenied: true }
  );
  bidResponse = { success: true };
  purchaseMoveResponse = { success: false };
  assert.deepStrictEqual(
    await purchaseAdapter.purchaseItemToClub(purchaseItem, 1200, purchaseContext),
    {
      success: false,
      reason: "move-failed",
      purchased: true,
      price: 1200
    }
  );

  purchaseServices.Item.move = () => {
    throw new Error("move failed");
  };
  assert.deepStrictEqual(
    await purchaseAdapter.purchaseItemToClub(purchaseItem, 1200, purchaseContext),
    {
      success: false,
      reason: "move-failed",
      purchased: true,
      price: 1200,
      error: {
        code: "EA_PURCHASED_ITEM_MOVE_FAILED",
        capability: EA_CAPABILITIES.ITEM_PURCHASE_TO_CLUB,
        missing: [],
        cause: "move failed"
      }
    }
  );

  purchaseServices.Item.move = () => ({});
  assert.deepStrictEqual(
    await purchaseAdapter.purchaseItemToClub(purchaseItem, 1200, purchaseContext),
    {
      success: false,
      reason: "move-failed",
      purchased: true,
      price: 1200,
      error: {
        code: "EA_PURCHASED_ITEM_MOVE_FAILED",
        capability: EA_CAPABILITIES.ITEM_PURCHASE_TO_CLUB,
        missing: ["services.Item.move.observe"],
        cause: undefined
      }
    }
  );

  let listingResponse = { success: true };
  const listingNotifications = [];
  const handledListingStatuses = [];
  const listingCalls = [];
  let listingUnobservedContext = null;
  const listingServices = {
    Item: {
      list(item, startingPrice, buyNowPrice, durationSeconds) {
        listingCalls.push([item, startingPrice, buyNowPrice, durationSeconds]);
        return {
          observe(_context, callback) {
            callback(
              {
                unobserve(context) {
                  listingUnobservedContext = context;
                }
              },
              listingResponse
            );
          }
        };
      }
    },
    Localization: {
      localize: (key) => `localized:${key}`
    },
    Notification: {
      queue: (payload) => listingNotifications.push(payload)
    }
  };
  const listingAdapter = new EaRuntimeAdapter({
    getServices: () => listingServices,
    getItemRuntime: () => ({
      UINotificationType: { NEGATIVE: "negative" },
      NetworkErrorManager: {
        checkCriticalStatus: (status) => status === 503,
        handleStatus: (status) => handledListingStatuses.push(status)
      },
      HttpStatusCode: { FORBIDDEN: 403 },
      UtasErrorCode: {
        PERMISSION_DENIED: "permission-denied",
        STATE_INVALID: "state-invalid",
        DESTINATION_FULL: "destination-full",
        CARD_IN_TRADE: "card-in-trade"
      }
    })
  });
  const listingContext = { name: "listing-context" };
  const listingItem = { id: 99 };
  assert.strictEqual(listingAdapter.supports(EA_CAPABILITIES.ITEM_LIST_FOR_SALE), true);
  assert.deepStrictEqual(
    await listingAdapter.listItemForSale(listingItem, 900, 1000, 3600, listingContext),
    { success: true }
  );
  assert.deepStrictEqual(listingCalls, [[listingItem, 900, 1000, 3600]]);
  assert.strictEqual(listingUnobservedContext, listingContext);

  listingResponse = { success: false, error: { code: "permission-denied" } };
  assert.deepStrictEqual(
    await listingAdapter.listItemForSale(listingItem, 900, 1000, 3600, listingContext),
    {
      success: false,
      critical: false,
      code: "permission-denied",
      messageKey: "popup.error.list.PermissionDenied"
    }
  );
  assert.deepStrictEqual(listingNotifications, [
    ["localized:popup.error.list.PermissionDenied", "negative"]
  ]);

  listingResponse = { success: false, status: 503 };
  assert.deepStrictEqual(
    await listingAdapter.listItemForSale(listingItem, 900, 1000, 3600, listingContext),
    { success: false, critical: true, code: 503 }
  );
  assert.deepStrictEqual(handledListingStatuses, [503]);

  assert.deepStrictEqual(
    await missingServices.listItemForSale(listingItem, 900, 1000, 3600, listingContext),
    {
      success: false,
      error: {
        code: "EA_CAPABILITY_UNAVAILABLE",
        capability: EA_CAPABILITIES.ITEM_LIST_FOR_SALE,
        missing: ["services"],
        cause: undefined
      }
    }
  );

  let resetCalls = 0;
  const resetAdapter = new EaRuntimeAdapter({
    getServices: () => ({
      Item: {
        itemDao: {
          itemRepo: {
            unassigned: {
              async reset() {
                resetCalls++;
              }
            }
          }
        }
      }
    })
  });
  assert.strictEqual(resetAdapter.supports(EA_CAPABILITIES.UNASSIGNED_RESET), true);
  assert.deepStrictEqual(await resetAdapter.resetUnassignedItems(), { success: true });
  assert.strictEqual(resetCalls, 1);
  assert.deepStrictEqual(await missingServices.resetUnassignedItems(), {
    success: false,
    error: {
      code: "EA_CAPABILITY_UNAVAILABLE",
      capability: EA_CAPABILITIES.UNASSIGNED_RESET,
      missing: ["services"],
      cause: undefined
    }
  });

  const listingRepositoryItem = { id: "club-item" };
  const repositoryAdapter = new EaRuntimeAdapter({
    getRepositories: () => ({
      Item: {
        getStaticDataByDefId: (definitionId) => ({ name: `Player ${definitionId}` }),
        numItemsInCache: (pile) => (pile === "purchased" ? 50 : 99),
        getPileSize: () => 100,
        transfer: {
          get: () => null,
          _collection: { "already-listed": true }
        },
        unassigned: { get: () => null },
        club: { items: { get: (id) => (id === "club-item" ? listingRepositoryItem : null) } }
      }
    }),
    getItemRuntime: () => ({ ItemPile: { PURCHASED: "purchased", TRANSFER: "transfer" } })
  });
  assert.strictEqual(repositoryAdapter.supports(EA_CAPABILITIES.ITEM_STATIC_DATA), true);
  assert.strictEqual(repositoryAdapter.supports(EA_CAPABILITIES.ITEM_PURCHASE_CAPACITY), true);
  assert.strictEqual(repositoryAdapter.supports(EA_CAPABILITIES.ITEM_LISTING_INVENTORY), true);
  assert.deepStrictEqual(repositoryAdapter.getStaticItemData(42), {
    success: true,
    data: { name: "Player 42" }
  });
  assert.deepStrictEqual(repositoryAdapter.isPurchaseCapacityReached(50), {
    success: true,
    reached: true
  });
  assert.deepStrictEqual(repositoryAdapter.findListingItem("club-item"), {
    success: true,
    item: listingRepositoryItem,
    alreadyListed: false
  });
  assert.deepStrictEqual(repositoryAdapter.findListingItem("already-listed"), {
    success: true,
    item: null,
    alreadyListed: true
  });
  assert.deepStrictEqual(repositoryAdapter.hasTransferListingCapacity(), {
    success: true,
    hasCapacity: true
  });
  assert.deepStrictEqual(missingServices.getStaticItemData(42), {
    success: false,
    error: {
      code: "EA_CAPABILITY_UNAVAILABLE",
      capability: EA_CAPABILITIES.ITEM_STATIC_DATA,
      missing: ["repositories.Item.getStaticDataByDefId"],
      cause: undefined
    }
  });

  const unavailablePurchase = await missingServices.purchaseItemToClub({}, 1200, null);
  assert.deepStrictEqual(unavailablePurchase, {
    success: false,
    reason: "capability-unavailable",
    error: {
      code: "EA_CAPABILITY_UNAVAILABLE",
      capability: EA_CAPABILITIES.ITEM_PURCHASE_TO_CLUB,
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
