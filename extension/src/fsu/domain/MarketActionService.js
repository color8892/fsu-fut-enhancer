import { responseText, safeParseJson } from "../infra/JsonParsing.js";
import { EA_CAPABILITIES } from "../ea/EaRuntimeAdapter.js";

export class MarketActionService {
  _getAuctionPrice(i, p, helpers) {
    const { debug = { log: () => {} }, ea, getInfo, notice, xmlHttpRequest } = helpers;
    const info = getInfo();
    return new Promise((resolve) => {
      xmlHttpRequest({
        method: "GET",
        url: `https://utas.mob.v5.prd.futc-ext.gcp.ea.com/ut/game/fc26/transfermarket?num=21&start=0&type=player&maskedDefId=${i}&maxb=${p}`,
        headers: {
          "Content-type": "application/json",
          "X-UT-SID": info.base.sId
        },
        onload: function (response) {
          if (response.status == 404 || response.status == 401) {
            const refreshedSessionId = ea?.getUtasSessionId() || null;
            if (refreshedSessionId) {
              info.base.sId = refreshedSessionId;
            } else {
              debug.log("EA capability unavailable", ea?.inspect?.(EA_CAPABILITIES.UTAS_SESSION));
            }
            notice("notice.loaderror", 2);
            resolve([]);
          } else {
            const transferMarketResponse = safeParseJson(responseText(response), { auctionInfo: [] }, {
              label: "transfer-market-auctions",
              onError: (error, context) => debug.log(`${context.label} parse failed`, error)
            });
            resolve(transferMarketResponse.auctionInfo || []);
          }
        },
        onerror: function () {
          notice("notice.loaderror", 2);
          resolve([]);
        }
      });
    });
  }

  async getAuction(e, player, helpers) {
    const {
      fy,
      debug,
      futbinId,
      getInfo,
      getCachePrice,
      createButton,
      pdb
    } = helpers;
    const info = getInfo();

    e.setInteractionState(0);
    e.setSubtext(fy("quicklist.getpriceload"));
    const defId = player.definitionId;
    if (_.has(info.futbinId, defId)) {
      await futbinId.getPrice(defId, info.futbinId[defId]);
    } else {
      await futbinId.getId(player);
    }
    let price = getCachePrice(defId, 1).num;
    let result = await this._getAuctionPrice(defId, price, helpers);
    let priceList = result.map((i) => i.buyNowPrice) || [];
    if (result.length == 0) {
      for (let i = 0; i < 5; i++) {
        const nextPrice = helpers.ea.incrementMarketPrice(price, "above");
        if (nextPrice === null) break;
        price = nextPrice;
        debug.log(`升价第${i}次循环，当前查询价格${price}`);
        let tempResult = await this._getAuctionPrice(defId, price, helpers);
        tempResult.map((i) => {
          priceList.push(i.buyNowPrice);
        });
        if (tempResult.length > 0) {
          break;
        }
      }
    } else if (result.length == 21) {
      for (let i = 0; i < 5; i++) {
        const nextPrice = helpers.ea.incrementMarketPrice(price, "below");
        if (nextPrice === null) break;
        price = nextPrice;
        debug.log(`降价第${i}次循环，当前查询价格${price}`);
        let tempResult = await this._getAuctionPrice(defId, price, helpers);
        tempResult.map((i) => {
          priceList.push(i.buyNowPrice);
        });
        if (tempResult.length < 21) {
          break;
        }
      }
    }
    if (priceList.length) {
      const priceListJson = _.countBy(priceList);
      const displayPrice = _.fromPairs(_.take(_.toPairs(priceListJson), 3));
      pdb[defId] = Number(_.first(_.keys(displayPrice))).toLocaleString();
      e.setSubtext(pdb[defId]);
      e.displayCurrencyIcon(!0);
      let displayPriceCount = 0;
      _.forEach(displayPrice, (value, key) => {
        displayPriceCount++;
        let displayElement = createButton(
          new UTGroupButtonControl(),
          `${fy("quicklist.getpricelt")} ${displayPriceCount}`,
          () => {},
          "accordian"
        );
        displayElement.setInteractionState(0);
        displayElement.getRootElement().style.fontSize = "87.5%";
        displayElement.setSubtext(`${Number(key).toLocaleString()} ×${value}`);
        displayElement.displayCurrencyIcon(!0);
        e.getRootElement().parentNode.appendChild(displayElement.getRootElement());
      });
    } else {
      e.setSubtext(fy("buyplayer.error.child3").slice(0, -1));
    }
  }

  async buyConceptPlayer(players, view, helpers) {
    const {
      getInfo,
      showLoader,
      hideLoader,
      notice,
      changeLoadingText,
      sendPinEvents,
      wait,
      cardAddBuyErrorTips,
      fy,
      debug,
      isPhone,
      getCurrentController,
      ea
    } = helpers;
    const info = getInfo();

    info.run.bulkbuy = true;
    const purchaseCapacity = ea.isPurchaseCapacityReached(MAX_NEW_ITEMS);
    if (!purchaseCapacity.success) {
      debug.log("EA purchase-capacity capability unavailable", purchaseCapacity.error);
      notice("notice.loaderror", 2);
      return;
    }
    if (purchaseCapacity.reached) {
      notice(["buyplayer.error", "", fy("buyplayer.error.child5")], 2);
      return;
    }
    showLoader();
    let playersNumber = players.length,
      quantity = 0,
      cost = 0;
    for (let index = 0; index < playersNumber; index++) {
      if (!info.run.bulkbuy) {
        continue;
      }
      const player = players[index];
      let defId,
        playerName,
        buyStatus = false;
      if (Number.isInteger(player)) {
        defId = player;
        const staticData = ea.getStaticItemData(defId);
        if (!staticData.success || !staticData.data) {
          debug.log("EA static-item capability unavailable", staticData.error);
          notice("buyplayer.getinfo.error", 2);
          continue;
        }
        playerName = staticData.data.name;
      } else if (typeof player == "object" && player.isPlayer()) {
        defId = player.definitionId;
        playerName = player.getStaticData().name;
      }
      if (!defId) {
        notice("buyplayer.getinfo.error", 2);
        continue;
      }
      let loadingInfo =
        playersNumber == 1 ? "" : ["readauction.progress", index + 1, playersNumber];
      let priceList = await this.readAuctionPrices(player, false, loadingInfo, helpers);
      priceList.sort((a, b) => b._auction.buyNowPrice - a._auction.buyNowPrice);
      debug.log(priceList);
      changeLoadingText("buyplayer.loadingclose", loadingInfo);
      if (priceList.length == 0) {
        notice(["buyplayer.error", playerName, fy("buyplayer.error.child3")], 2);
      } else {
        let currentPlayer = priceList[priceList.length - 1];
        const purchasePrice = currentPlayer._auction.buyNowPrice;
        const purchaseResult = await ea.purchaseItemToClub(
          currentPlayer,
          purchasePrice,
          this,
          () => sendPinEvents("Item - Detail View")
        );
        if (purchaseResult.success || purchaseResult.purchased) {
          notice(["buyplayer.success", playerName, purchasePrice], 0);
          quantity += 1;
          cost += purchasePrice;
        }
        if (purchaseResult.success) {
          notice(["buyplayer.sendclub.success", playerName], 0);
          buyStatus = true;
          if (isPhone() && playersNumber == 1) {
            let controller = getCurrentController();
            if (controller.className == "UTSquadItemDetailsNavigationController") {
              controller.getParentViewController()._eBackButtonTapped();
            }
          }
        } else if (purchaseResult.reason === "insufficient-funds") {
          notice(["buyplayer.error", playerName, fy("buyplayer.error.child2")], 2);
        } else if (purchaseResult.reason === "expired") {
          notice(["buyplayer.error", playerName, fy("buyplayer.error.child4")], 2);
        } else if (purchaseResult.reason === "bid-failed") {
          notice(
            [
              "buyplayer.error",
              playerName,
              `${purchaseResult.permissionDenied ? fy("buyplayer.error.child1") : ""}`
            ],
            2
          );
        } else if (purchaseResult.reason === "move-failed") {
          notice(["buyplayer.sendclub.error", playerName], 2);
        } else {
          debug.log("Bulk purchase unavailable", purchaseResult.error);
          notice("notice.loaderror", 2);
        }
      }
      if (!buyStatus) {
        cardAddBuyErrorTips(defId);
      }
      // if (view && playersNumber == 1) {
      //     view.getSuperview().items._collection[view.getSuperview().items._index].render(player)
      // }
      if (playerName !== index) {
        await wait(0.5, 1);
      }
    }

    hideLoader();
    notice(
      ["buyplayer.bibresults", quantity, playersNumber - quantity, cost],
      quantity !== playersNumber ? 2 : 0
    );
  }

  async buyPlayer(player, view, helpers) {
    const {
      showLoader,
      hideLoader,
      notice,
      changeLoadingText,
      sendPinEvents,
      cardAddBuyErrorTips,
      fy,
      debug,
      isPhone,
      getCurrentController,
      ea
    } = helpers;

    showLoader();
    let shouldMarkBuyError = false;
    let defId = 0,
      playerName = "";
    if (Number.isInteger(player)) {
      defId = player;
      const staticData = ea.getStaticItemData(defId);
      if (!staticData.success || !staticData.data) {
        debug.log("EA static-item capability unavailable", staticData.error);
        hideLoader();
        notice("notice.loaderror", 2);
        return;
      }
      playerName = staticData.data.name;
    } else if (typeof player == "object" && player.isPlayer()) {
      defId = player.definitionId;
      playerName = player.getStaticData().name;
    }
    if (!defId) {
      hideLoader();
      return;
    }
    const purchaseCapacity = ea.isPurchaseCapacityReached(MAX_NEW_ITEMS);
    if (!purchaseCapacity.success) {
      debug.log("EA purchase-capacity capability unavailable", purchaseCapacity.error);
      notice("notice.loaderror", 2);
      hideLoader();
      return;
    }
    if (purchaseCapacity.reached) {
      notice(["buyplayer.error", playerName, fy("buyplayer.error.child5")], 2);
      shouldMarkBuyError = true;
    } else {
      let priceList = await this.readAuctionPrices(player, undefined, undefined, helpers);
      priceList.sort((a, b) => b._auction.buyNowPrice - a._auction.buyNowPrice);
      debug.log(priceList);
      changeLoadingText("buyplayer.loadingclose");
      if (priceList.length == 0) {
        notice(["buyplayer.error", playerName, fy("buyplayer.error.child3")], 2);
        shouldMarkBuyError = true;
      } else {
        let currentPlayer = priceList[priceList.length - 1];
        const purchasePrice = currentPlayer._auction.buyNowPrice;
        const purchaseResult = await ea.purchaseItemToClub(
          currentPlayer,
          purchasePrice,
          this,
          () => sendPinEvents("Item - Detail View")
        );
        if (purchaseResult.success || purchaseResult.purchased) {
          notice(["buyplayer.success", playerName, purchasePrice], 0);
        }
        if (purchaseResult.success) {
          notice(["buyplayer.sendclub.success", playerName], 0);
          if (isPhone()) {
            let controller = getCurrentController();
            if (controller.className == "UTSquadItemDetailsNavigationController") {
              controller.getParentViewController()._eBackButtonTapped();
            }
          }
        } else if (purchaseResult.reason === "insufficient-funds") {
          notice(["buyplayer.error", playerName, fy("buyplayer.error.child2")], 2);
          shouldMarkBuyError = true;
        } else if (purchaseResult.reason === "expired") {
          notice(["buyplayer.error", playerName, fy("buyplayer.error.child4")], 2);
          shouldMarkBuyError = true;
        } else if (purchaseResult.reason === "bid-failed") {
          notice(
            [
              "buyplayer.error",
              playerName,
              `${purchaseResult.permissionDenied ? fy("buyplayer.error.child1") : ""}`
            ],
            2
          );
          shouldMarkBuyError = true;
        } else if (purchaseResult.reason === "move-failed") {
          notice(["buyplayer.sendclub.error", playerName], 2);
        } else {
          debug.log("EA purchase unavailable", purchaseResult.error || purchaseResult);
          notice("notice.loaderror", 2);
          shouldMarkBuyError = true;
        }
      }
    }
    if (shouldMarkBuyError) {
      cardAddBuyErrorTips(defId);
      if (view) {
        view.getSuperview().items._collection[view.getSuperview().items._index].render(player);
      }
    }
    hideLoader();
  }

  async readAuctionPrices(player, price, loadingInfo, helpers) {
    const {
      getInfo,
      changeLoadingText,
      getCachePrice,
      wait,
      notice,
      sendPinEvents,
      futbinId,
      debug,
      ea
    } = helpers;
    const info = getInfo();

    changeLoadingText("readauction.loadingclose", loadingInfo);
    let attempts = "queries_number" in info.set ? info.set.queries_number : 5;
    let defId = Number.isInteger(player)
      ? player
      : typeof player == "object" && "definitionId" in player
        ? player.definitionId
        : Number(player);
    if (!Number.isFinite(defId)) return [];
    const marketSearch = ea.createPlayerMarketSearch(defId);
    if (!marketSearch) {
      debug.log("EA capability unavailable", ea.inspect(EA_CAPABILITIES.MARKET_QUERY_MODEL));
      notice("readauction.error", 2);
      return [];
    }
    let result = [];
    let queried = [];
    if (price) {
      marketSearch.setMaxBuy(Number(price));
    } else {
      try {
        if (_.has(info.futbinId, defId)) {
          await futbinId.getPrice(defId, info.futbinId[defId]);
        } else {
          await futbinId.getId(player);
        }
      } catch {
        return [];
      }
      marketSearch.setMaxBuy(getCachePrice(defId, 1).num);
    }
    changeLoadingText("readauction.loadingclose2", loadingInfo);
    while (attempts-- > 0) {
      const currentMaxBuy = marketSearch.getMaxBuy();
      changeLoadingText(
        ["readauction.loadingclose3", `${currentMaxBuy.toLocaleString()}`],
        loadingInfo
      );
      if (queried.includes(currentMaxBuy)) {
        break;
      }
      ea.clearTransferMarketCache();
      let response = await this.searchTransferMarket(marketSearch.getCriteria(), 1, helpers);
      const items = response?.success && Array.isArray(response?.data?.items)
        ? response.data.items
        : null;
      if (items) {
        sendPinEvents("Transfer Market Results - List View");
        result = result.concat(items);
        queried.push(currentMaxBuy);
        if (items.length == 0 || items.length == 21) {
          const direction = items.length == 0 ? "above" : "below";
          const nextPrice = ea.incrementMarketPrice(currentMaxBuy, direction);
          if (nextPrice === null) {
            debug.log("EA capability unavailable", ea.inspect(EA_CAPABILITIES.CURRENCY_STEPS));
            break;
          }
          marketSearch.setMaxBuy(nextPrice);
        } else {
          break;
        }
      } else {
        notice("readauction.error", 2);
        break;
      }
      if (attempts > 0) {
        await wait(0.2, 0.5);
      }
    }
    return result;
  }

  searchTransferMarket(criteria, type, helpers) {
    return helpers.ea.searchTransferMarket(criteria, type, this);
  }

  async transferToClub(controller, list, helpers) {
    const { notice, isPhone, ea, debug } = helpers;
    const result = await ea.moveItemsToClub(list, controller);
    if (result.success) {
      if (result.movedCount < list.length) {
        notice(["transfertoclub.unable", list.length - result.movedCount], 2);
      }
      if (isPhone()) {
        controller.refreshList();
      }
    } else if (result.error?.code === "EA_CAPABILITY_UNAVAILABLE") {
      debug.log("EA capability unavailable", result.error);
      notice("notice.loaderror", 2);
    }
  }

  async playerToAuction(d, p, time, helpers) {
    const {
      futbinId,
      getInfo,
      getCachePrice,
      notice,
      playerGetLimits,
      getCurrentController,
      debug,
      ea
    } = helpers;
    const info = getInfo();

    const listingItem = ea.findListingItem(d);
    if (!listingItem.success) {
      debug.log("EA listing-inventory capability unavailable", listingItem.error);
      notice("notice.loaderror", 2);
      return false;
    }
    const i = listingItem.item;
    const t = listingItem.alreadyListed;
    if (i) {
      //25.13 读取futbin最新的价格
      try {
        if (_.has(info.futbinId, i.definitionId)) {
          await futbinId.getPrice(i.definitionId, info.futbinId[i.definitionId]);
        } else {
          await futbinId.getId(i);
        }
      } catch {
        return;
      }
      const price = getCachePrice(i.definitionId, 1).num;

      const listingCapacity = ea.hasTransferListingCapacity();
      if (!listingCapacity.success) {
        debug.log("EA listing-inventory capability unavailable", listingCapacity.error);
        notice("notice.loaderror", 2);
        return false;
      }
      if ((listingCapacity.hasCapacity || t) && price) {
        await playerGetLimits(i);
        if (i.hasPriceLimits()) {
          if (p < i._itemPriceLimits.minimum || p > i._itemPriceLimits.maximum) {
            notice(["notice.auctionlimits", i._staticData.name], 2);
            return;
          }
        }
        const startingPrice = ea.incrementMarketPrice(price, "below");
        if (startingPrice === null) {
          debug.log("EA currency-step capability unavailable");
          notice("notice.loaderror", 2);
          return false;
        }
        const result = await ea.listItemForSale(
          i,
          startingPrice,
          price,
          time * 3600,
          getCurrentController()
        );
        if (result.success) {
          notice(["notice.auctionsuccess", i._staticData.name, price], 0);
        } else if (result.error?.code === "EA_CAPABILITY_UNAVAILABLE") {
          debug.log("EA listing capability unavailable", result.error);
          notice("notice.loaderror", 2);
          return false;
        }
        return result.success;
      } else {
        notice("notice.auctionmax", 2);
        return false;
      }
    } else {
      notice(["notice.auctionnoplayer", d], 2);
    }
  }

  async losAuctionSell(e, t, helpers) {
    const {
      getInfo,
      showLoader,
      hideLoader,
      notice,
      changeLoadingText,
      getCachePrice,
      wait,
      debug,
      isPhone,
      getCurrentController,
      getLeftController,
      ea
    } = helpers;
    const info = getInfo();

    e.setInteractionState(0);
    info.run.losauction = true;
    showLoader();
    let a = e._parent._fsuAkbArray,
      b = e._parent._fsuAkbCurrent,
      pn = 0,
      time = t == 0 ? 1 : t;
    notice(["loas.start", `${b}`, `${b * 5}`], 1);
    for (let n in a) {
      if (!info.run.losauction) {
        break;
      }
      pn++;
      changeLoadingText(["loadingclose.loas", `${pn}`, `${b - pn}`]);
      await this.playerToAuction(n, getCachePrice(a[n]._pId, 1).num, time, helpers);
      debug.log(a[n]._l);
      if (isPhone()) {
        a[n].toggle(false);
        e._parent.listRows[a[n]._l].hide();
        e._parent._fsuAkbCurrent--;
        e._parent._fsuAkbNumber--;
        delete e._parent._fsuAkbArray[a[n]._id];
        this.losAuctionCount(e._parent, undefined, helpers);
      }
      await wait(2, 4);
    }
    hideLoader();
    info.run.losauction = false;
    e.setInteractionState(e._parent._fsuAkbCurrent);
    let currentController = isPhone() ? getCurrentController() : getLeftController();
    if (currentController.className == "UTUnassignedItemsViewController") {
      const resetResult = await ea.resetUnassignedItems();
      if (!resetResult.success) {
        debug.log("EA unassigned reset capability unavailable", resetResult.error);
        notice("notice.loaderror", 2);
        return;
      }
      await currentController.getUnassignedItems();
    } else {
      currentController.refreshList();
    }
  }

  losAuctionCount(e, t, helpers) {
    const { getCachePrice } = helpers;

    if (
      e.hasOwnProperty("_fsuAkbCurrent") &&
      e.hasOwnProperty("_fsuAkbNumber") &&
      e.hasOwnProperty("_fsuAkbArray")
    ) {
      let pn = 0;
      for (let n in e._fsuAkbArray) {
        const ppValue = getCachePrice(e._fsuAkbArray[n]._pId, 1);
        pn += ppValue.num;
        if (!ppValue.num) {
          e._fsuAkbArray[n].setInteractionState(0);
        } else if (ppValue.text && ppValue.num == 0) {
          e._fsuAkbArray[n].setInteractionState(0);
          e._fsuAkbCurrent--;
          e._fsuAkbNumber--;
          delete e._fsuAkbArray[n];
        } else {
          e._fsuAkbArray[n].setInteractionState(1);
        }
      }
      e._fsuAkb.querySelector(".fsu-akb-num").innerText = e._fsuAkbCurrent;
      e._fsuAkb.querySelector(".fsu-akb-max").innerText = e._fsuAkbNumber;
      e._fsuAkb.querySelector(".fsu-akb-price").innerText = pn.toLocaleString();
      if (pn) {
        e._fsuAkbButton.setInteractionState(1);
        e._fsuAkbToggle.setInteractionState(1);
      } else if (pn == 0) {
        e._fsuAkbButton.setInteractionState(0);
      }
    }
  }
}
