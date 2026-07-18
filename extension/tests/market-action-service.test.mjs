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

  const malformedAuctionResult = await service._getAuctionPriceResult(1, 1000, {
    ...helpers,
    xmlHttpRequest: ({ onload }) => {
      onload({
        status: 200,
        response: "{\"auctionInfo\":[{\"buyNowPrice\":\"1200\"}]}"
      });
    }
  });
  assert.equal(malformedAuctionResult.success, false);
  assert.equal(malformedAuctionResult.error?.code, "MARKET_RESULT_INVALID");

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
  assert.deepStrictEqual(delegated, delegatedResponse);

  const malformedSearch = await service.searchTransferMarket(criteria, 1, {
    ea: {
      searchTransferMarket: async () => ({ success: true, data: { items: null } })
    }
  });
  assert.equal(malformedSearch.success, false);
  assert.equal(malformedSearch.error?.code, "MARKET_RESULT_INVALID");

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

  const controller = {
    refreshListCalled: false,
    refreshList() {
      this.refreshListCalled = true;
    }
  };
  const moveNotices = [];
  await service.transferToClub(controller, [1, 2, 3], {
    notice: (...args) => moveNotices.push(args),
    isPhone: () => true,
    debug: { log: () => {} },
    ea: {
      moveItemsToClub: async () => ({ success: true, movedCount: 2 })
    }
  });
  assert.strictEqual(controller.refreshListCalled, true);
  assert.deepStrictEqual(moveNotices, [[[
    "transfertoclub.unable",
    1
  ], 2]]);

  const unavailableNotices = [];
  await service.transferToClub(controller, [1], {
    notice: (...args) => unavailableNotices.push(args),
    isPhone: () => false,
    debug: { log: () => {} },
    ea: {
      moveItemsToClub: async () => ({
        success: false,
        movedCount: 0,
        error: { code: "EA_CAPABILITY_UNAVAILABLE" }
      })
    }
  });
  assert.deepStrictEqual(unavailableNotices, [["notice.loaderror", 2]]);

  const originalReadAuctionPrices = service.readAuctionPrices;
  try {
    const player = {
      definitionId: 123,
      isPlayer: () => true,
      getStaticData: () => ({ name: "Test Player" })
    };
    const marketItem = { _auction: { buyNowPrice: 1200 } };
    service.readAuctionPrices = async () => [marketItem];

    const purchaseNotices = [];
    let showLoaderCalls = 0;
    let hideLoaderCalls = 0;
    let pinCalls = 0;
    let markedDefinitionId = null;
    let purchaseResult = { success: true, price: 1200 };
    const purchaseHelpers = {
      showLoader: () => showLoaderCalls++,
      hideLoader: () => hideLoaderCalls++,
      notice: (...args) => purchaseNotices.push(args),
      changeLoadingText: () => {},
      sendPinEvents: (event) => {
        assert.strictEqual(event, "Item - Detail View");
        pinCalls++;
      },
      cardAddBuyErrorTips: (definitionId) => (markedDefinitionId = definitionId),
      fy: (key) => key,
      debug: { log: () => {} },
      isPhone: () => false,
      getCurrentController: () => null,
      ea: {
        isPurchaseCapacityReached: (maxItems) => {
          assert.strictEqual(maxItems, 100);
          return { success: true, reached: false };
        },
        getStaticItemData: () => ({ success: true, data: { name: "Test Player" } }),
        async purchaseItemToClub(item, price, context, onBeforeBid) {
          assert.strictEqual(item, marketItem);
          assert.strictEqual(price, 1200);
          assert.strictEqual(context, service);
          onBeforeBid();
          return purchaseResult;
        }
      }
    };

    await service.buyPlayer(player, null, purchaseHelpers);
    assert.strictEqual(showLoaderCalls, 1);
    assert.strictEqual(hideLoaderCalls, 1);
    assert.strictEqual(pinCalls, 1);
    assert.strictEqual(markedDefinitionId, null);
    assert.deepStrictEqual(purchaseNotices, [
      [["buyplayer.success", "Test Player", 1200], 0],
      [["buyplayer.sendclub.success", "Test Player"], 0]
    ]);

    purchaseNotices.length = 0;
    purchaseResult = {
      success: false,
      reason: "move-failed",
      purchased: true,
      price: 1200
    };
    await service.buyPlayer(player, null, purchaseHelpers);
    assert.strictEqual(markedDefinitionId, null);
    assert.deepStrictEqual(purchaseNotices, [
      [["buyplayer.success", "Test Player", 1200], 0],
      [["buyplayer.sendclub.error", "Test Player"], 2]
    ]);

    purchaseNotices.length = 0;
    purchaseResult = {
      success: false,
      reason: "bid-failed",
      permissionDenied: true
    };
    await service.buyPlayer(player, null, purchaseHelpers);
    assert.strictEqual(markedDefinitionId, 123);
    assert.deepStrictEqual(purchaseNotices, [
      [["buyplayer.error", "Test Player", "buyplayer.error.child1"], 2]
    ]);

    purchaseNotices.length = 0;
    purchaseResult = { purchased: true };
    await service.buyPlayer(player, null, purchaseHelpers);
    assert.deepStrictEqual(purchaseNotices, [["notice.loaderror", 2]]);
  } finally {
    service.readAuctionPrices = originalReadAuctionPrices;
  }

  const originalBulkReadAuctionPrices = service.readAuctionPrices;
  try {
    const firstPlayer = {
      definitionId: 101,
      isPlayer: () => true,
      getStaticData: () => ({ name: "First Player" })
    };
    const secondPlayer = {
      definitionId: 202,
      isPlayer: () => true,
      getStaticData: () => ({ name: "Second Player" })
    };
    const marketItems = new Map([
      [firstPlayer, { _auction: { buyNowPrice: 1000 } }],
      [secondPlayer, { _auction: { buyNowPrice: 2000 } }]
    ]);
    service.readAuctionPrices = async (player) => [marketItems.get(player)];

    const bulkNotices = [];
    const markedDefinitionIds = [];
    const purchaseResults = [
      { success: true, price: 1000 },
      {
        success: false,
        reason: "move-failed",
        purchased: true,
        price: 2000
      }
    ];
    const bulkInfo = { run: { bulkbuy: false } };
    let bulkShow = 0;
    let bulkHide = 0;
    const bulkSummary = await service.buyConceptPlayer([firstPlayer, secondPlayer], null, {
      getInfo: () => bulkInfo,
      showLoader: () => bulkShow++,
      hideLoader: () => bulkHide++,
      notice: (...args) => bulkNotices.push(args),
      changeLoadingText: () => {},
      sendPinEvents: (event) => assert.strictEqual(event, "Item - Detail View"),
      wait: async () => {},
      cardAddBuyErrorTips: (definitionId) => markedDefinitionIds.push(definitionId),
      fy: (key) => key,
      debug: { log: () => {} },
      isPhone: () => false,
      getCurrentController: () => null,
      ea: {
        isPurchaseCapacityReached: (maxItems) => {
          assert.strictEqual(maxItems, 100);
          return { success: true, reached: false };
        },
        getStaticItemData: () => ({ success: true, data: { name: "Unused" } }),
        async purchaseItemToClub(item, price, context, onBeforeBid) {
          assert.strictEqual(context, service);
          assert.ok([...marketItems.values()].includes(item));
          onBeforeBid();
          const result = purchaseResults.shift();
          assert.strictEqual(price, result.price);
          return result;
        }
      }
    });
    assert.strictEqual(bulkInfo.run.bulkbuy, false);
    assert.strictEqual(bulkShow, 1);
    assert.strictEqual(bulkHide, 1);
    assert.strictEqual(bulkSummary.requested, 2);
    assert.strictEqual(bulkSummary.purchased, 2);
    assert.strictEqual(bulkSummary.moved, 1);
    assert.strictEqual(bulkSummary.failed, 1);
    assert.deepStrictEqual(markedDefinitionIds, [202]);
    assert.deepStrictEqual(bulkNotices, [
      [["buyplayer.success", "First Player", 1000], 0],
      [["buyplayer.sendclub.success", "First Player"], 0],
      [["buyplayer.success", "Second Player", 2000], 0],
      [["buyplayer.sendclub.error", "Second Player"], 2],
      [["buyplayer.bibresults", 2, 0, 3000], 0]
    ]);

    // Capacity unavailable must not leave bulkbuy flag set.
    const unavailableInfo = { run: { bulkbuy: false } };
    const unavailable = await service.buyConceptPlayer([firstPlayer], null, {
      getInfo: () => unavailableInfo,
      showLoader: () => assert.fail("loader must not start"),
      hideLoader: () => assert.fail("loader must not hide"),
      notice: () => {},
      changeLoadingText: () => {},
      sendPinEvents: () => {},
      wait: async () => {},
      cardAddBuyErrorTips: () => {},
      fy: (key) => key,
      debug: { log: () => {} },
      isPhone: () => false,
      getCurrentController: () => null,
      ea: {
        isPurchaseCapacityReached: () => ({ success: false, error: { code: "missing" } }),
        getStaticItemData: () => ({ success: true, data: { name: "Unused" } }),
        purchaseItemToClub: async () => assert.fail("must not purchase")
      }
    });
    assert.strictEqual(unavailableInfo.run.bulkbuy, false);
    assert.strictEqual(unavailable.reason, "capacity-unavailable");

    // Capacity reached leaves no flag or loader.
    const reachedInfo = { run: { bulkbuy: false } };
    const reached = await service.buyConceptPlayer([firstPlayer], null, {
      getInfo: () => reachedInfo,
      showLoader: () => assert.fail("loader must not start"),
      hideLoader: () => assert.fail("loader must not hide"),
      notice: () => {},
      changeLoadingText: () => {},
      sendPinEvents: () => {},
      wait: async () => {},
      cardAddBuyErrorTips: () => {},
      fy: (key) => key,
      debug: { log: () => {} },
      isPhone: () => false,
      getCurrentController: () => null,
      ea: {
        isPurchaseCapacityReached: () => ({ success: true, reached: true }),
        getStaticItemData: () => ({ success: true, data: { name: "Unused" } }),
        purchaseItemToClub: async () => assert.fail("must not purchase")
      }
    });
    assert.strictEqual(reachedInfo.run.bulkbuy, false);
    assert.strictEqual(reached.reason, "capacity-reached");

    // Cancel after first item breaks the loop.
    const cancelInfo = { run: { bulkbuy: false } };
    let cancelAttempts = 0;
    service.readAuctionPrices = async (player) => {
      cancelAttempts++;
      if (cancelAttempts === 1) {
        cancelInfo.run.bulkbuy = false;
      }
      return [marketItems.get(player)];
    };
    const cancelled = await service.buyConceptPlayer(
      [firstPlayer, secondPlayer],
      null,
      {
        getInfo: () => cancelInfo,
        showLoader: () => {},
        hideLoader: () => {},
        notice: () => {},
        changeLoadingText: () => {},
        sendPinEvents: () => {},
        wait: async () => {},
        cardAddBuyErrorTips: () => {},
        fy: (key) => key,
        debug: { log: () => {} },
        isPhone: () => false,
        getCurrentController: () => null,
        ea: {
          isPurchaseCapacityReached: () => ({ success: true, reached: false }),
          getStaticItemData: () => ({ success: true, data: { name: "Unused" } }),
          purchaseItemToClub: async () => ({ success: true, price: 1000 })
        }
      }
    );
    assert.strictEqual(cancelAttempts, 1);
    assert.strictEqual(cancelled.cancelled, true);
    assert.strictEqual(cancelled.attempted, 1);
    assert.strictEqual(cancelInfo.run.bulkbuy, false);

    // Purchase helper throw is isolated and cleaned up.
    service.readAuctionPrices = async () => [{ _auction: { buyNowPrice: 900 } }];
    const throwInfo = { run: { bulkbuy: false } };
    let throwHide = 0;
    const thrown = await service.buyConceptPlayer([firstPlayer], null, {
      getInfo: () => throwInfo,
      showLoader: () => {},
      hideLoader: () => throwHide++,
      notice: () => {},
      changeLoadingText: () => {},
      sendPinEvents: () => {},
      wait: async () => {},
      cardAddBuyErrorTips: () => {},
      fy: (key) => key,
      debug: { log: () => {} },
      isPhone: () => false,
      getCurrentController: () => null,
      ea: {
        isPurchaseCapacityReached: () => ({ success: true, reached: false }),
        getStaticItemData: () => ({ success: true, data: { name: "Unused" } }),
        purchaseItemToClub: async () => {
          throw new Error("purchase blew up");
        }
      }
    });
    assert.strictEqual(thrown.failed, 1);
    assert.strictEqual(throwHide, 1);
    assert.strictEqual(throwInfo.run.bulkbuy, false);
  } finally {
    service.readAuctionPrices = originalBulkReadAuctionPrices;
  }

  const listingItem = {
    definitionId: 303,
    _staticData: { name: "Listed Player" },
    hasPriceLimits: () => false
  };
  const listingNotices = [];
  let resolveListing;
  const listingStarted = new Promise((resolve) => {
    resolveListing = resolve;
  });
  const listingEa = {
    findListingItem: () => ({
      success: true,
      item: listingItem,
      alreadyListed: false
    }),
    hasTransferListingCapacity: () => ({ success: true, hasCapacity: true }),
    incrementMarketPrice(price, direction) {
      assert.strictEqual(price, 1200);
      assert.strictEqual(direction, "below");
      return 1100;
    },
    listItemForSale(item, startingPrice, buyNowPrice, durationSeconds, controller) {
      assert.strictEqual(item, listingItem);
      assert.strictEqual(startingPrice, 1100);
      assert.strictEqual(buyNowPrice, 1200);
      assert.strictEqual(durationSeconds, 3600);
      assert.deepStrictEqual(controller, { name: "listing-controller" });
      resolveListing();
      return new Promise((resolve) => {
        resolveListing = () => resolve({ success: true });
      });
    }
  };
  const listingHelpers = {
    futbinId: { getPrice: async () => {} },
    getInfo: () => ({ futbinId: { 303: 1 } }),
    getCachePrice: () => ({ num: 1200 }),
    notice: (...args) => listingNotices.push(args),
    playerGetLimits: async () => {},
    getCurrentController: () => ({ name: "listing-controller" }),
    debug: { log: () => {} },
    ea: listingEa
  };
  const listingResult = service.playerToAuction(
    "listing-item",
    1200,
    1,
    listingHelpers
  );
  await listingStarted;
  let listingSettled = false;
  listingResult.then(() => (listingSettled = true));
  await Promise.resolve();
  assert.strictEqual(listingSettled, false);
  resolveListing();
  assert.strictEqual(await listingResult, true);
  assert.deepStrictEqual(listingNotices, [
    [["notice.auctionsuccess", "Listed Player", 1200], 0]
  ]);

  listingNotices.length = 0;
  listingEa.listItemForSale = async () => ({ success: false });
  assert.strictEqual(
    await service.playerToAuction("listing-item", 1200, 1, listingHelpers),
    false
  );
  assert.deepStrictEqual(listingNotices, [["notice.loaderror", 2]]);

  const auctionParent = {
    _fsuAkbArray: {},
    _fsuAkbCurrent: 0
  };
  const auctionView = {
    _parent: auctionParent,
    interactionStates: [],
    setInteractionState(value) {
      this.interactionStates.push(value);
    }
  };
  const unassignedActions = [];
  const unassignedController = {
    className: "UTUnassignedItemsViewController",
    async getUnassignedItems() {
      unassignedActions.push("reload");
    }
  };
  const emptyMassInfo = { run: { losauction: false } };
  await service.losAuctionSell(auctionView, 0, {
    getInfo: () => emptyMassInfo,
    showLoader: () => {},
    hideLoader: () => {},
    notice: () => {},
    changeLoadingText: () => {},
    getCachePrice: () => ({ num: 0 }),
    wait: async () => {},
    debug: { log: () => {} },
    isPhone: () => false,
    getCurrentController: () => null,
    getLeftController: () => unassignedController,
    ea: {
      async resetUnassignedItems() {
        unassignedActions.push("reset");
        return { success: true };
      }
    }
  });
  assert.deepStrictEqual(unassignedActions, ["reset", "reload"]);
  assert.deepStrictEqual(auctionView.interactionStates, [0, 0]);
  assert.strictEqual(emptyMassInfo.run.losauction, false);

  // Single item failure continues; UI still restored.
  const originalPlayerToAuction = service.playerToAuction;
  try {
    const failParent = {
      _fsuAkbArray: {
        a: { _pId: 1, _l: 0, _id: "a" },
        b: { _pId: 2, _l: 1, _id: "b" }
      },
      _fsuAkbCurrent: 2
    };
    const failView = {
      _parent: failParent,
      interactionStates: [],
      setInteractionState(value) {
        this.interactionStates.push(value);
      }
    };
    const massInfo = { run: { losauction: false } };
    let hideCount = 0;
    service.playerToAuction = async (id) => {
      if (id === "a") return false;
      return true;
    };
    const massResult = await service.losAuctionSell(failView, 0, {
      getInfo: () => massInfo,
      showLoader: () => {},
      hideLoader: () => hideCount++,
      notice: () => {},
      changeLoadingText: () => {},
      getCachePrice: () => ({ num: 1000 }),
      wait: async () => {},
      debug: { log: () => {} },
      isPhone: () => false,
      getCurrentController: () => null,
      getLeftController: () => ({
        className: "UTClubSearchResultsViewController",
        refreshList() {}
      }),
      ea: {
        resetUnassignedItems: async () => ({ success: true })
      }
    });
    assert.strictEqual(massResult.attempted, 2);
    assert.strictEqual(massResult.listed, 1);
    assert.strictEqual(massResult.failed, 1);
    assert.strictEqual(hideCount, 1);
    assert.strictEqual(massInfo.run.losauction, false);
    assert.deepStrictEqual(failView.interactionStates, [0, 2]);

    // Reset failure still restores UI.
    const resetView = {
      _parent: { _fsuAkbArray: {}, _fsuAkbCurrent: 0 },
      interactionStates: [],
      setInteractionState(value) {
        this.interactionStates.push(value);
      }
    };
    const resetInfo = { run: { losauction: false } };
    let resetHide = 0;
    const resetResult = await service.losAuctionSell(resetView, 0, {
      getInfo: () => resetInfo,
      showLoader: () => {},
      hideLoader: () => resetHide++,
      notice: () => {},
      changeLoadingText: () => {},
      getCachePrice: () => ({ num: 0 }),
      wait: async () => {},
      debug: { log: () => {} },
      isPhone: () => false,
      getCurrentController: () => null,
      getLeftController: () => ({
        className: "UTUnassignedItemsViewController",
        getUnassignedItems: async () => assert.fail("must not reload")
      }),
      ea: {
        resetUnassignedItems: async () => ({
          success: false,
          error: { code: "EA_CAPABILITY_UNAVAILABLE" }
        })
      }
    });
    assert.strictEqual(resetResult.reason, "reset-failed");
    assert.strictEqual(resetHide, 1);
    assert.strictEqual(resetInfo.run.losauction, false);
    assert.deepStrictEqual(resetView.interactionStates, [0, 0]);
  } finally {
    service.playerToAuction = originalPlayerToAuction;
  }
}
