export class MarketActionService {
  _getAuctionPrice(i, p, helpers) {
    const { getInfo, notice, xmlHttpRequest } = helpers;
    const info = getInfo();
    return new Promise((res) => {
      xmlHttpRequest({
        method: "GET",
        url: `https://utas.mob.v5.prd.futc-ext.gcp.ea.com/ut/game/fc26/transfermarket?num=21&start=0&type=player&maskedDefId=${i}&maxb=${p}`,
        headers: {
          "Content-type": "application/json",
          "X-UT-SID": info.base.sId
        },
        onload: function (response) {
          if (response.status == 404 || response.status == 401) {
            info.base.sId = services.Authentication.utasSession.id;
            notice("notice.loaderror", 2);
          } else {
            res(JSON.parse(response.response).auctionInfo);
          }
        },
        onerror: function () {
          notice("notice.loaderror", 2);
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
        price = UTCurrencyInputControl.getIncrementAboveVal(price);
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
        price = UTCurrencyInputControl.getIncrementBelowVal(price);
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
      getCurrentController
    } = helpers;
    const info = getInfo();

    info.run.bulkbuy = true;
    if (repositories.Item.numItemsInCache(ItemPile.PURCHASED) >= MAX_NEW_ITEMS) {
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
        playerName = repositories.Item.getStaticDataByDefId(defId).name;
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
      if (!priceList || priceList.length == 0) {
        notice(["buyplayer.error", playerName, fy("buyplayer.error.child3")], 2);
      } else {
        let currentPlayer = priceList[priceList.length - 1];
        let currentData = currentPlayer.getAuctionData();
        if (!currentData.canBuy(services.User.getUser().getCurrency(GameCurrency.COINS).amount)) {
          notice(["buyplayer.error", playerName, fy("buyplayer.error.child2")], 2);
        } else {
          if (0 < currentData.getSecondsRemaining()) {
            await new Promise((resolve) => {
              sendPinEvents("Item - Detail View");
              services.Item.bid(currentPlayer, currentPlayer._auction.buyNowPrice).observe(
                this,
                async function (sender, data) {
                  if (data.success) {
                    notice(
                      ["buyplayer.success", playerName, currentPlayer._auction.buyNowPrice],
                      0
                    );
                    quantity += 1;
                    cost += currentPlayer._auction.buyNowPrice;
                    services.Item.move(currentPlayer, ItemPile.CLUB).observe(this, (e, t) => {
                      if ((e.unobserve(this), t.success)) {
                        notice(["buyplayer.sendclub.success", playerName], 0);
                        buyStatus = true;
                        if (isPhone() && playersNumber == 1) {
                          let controller = getCurrentController();
                          if (controller.className == "UTSquadItemDetailsNavigationController") {
                            controller.getParentViewController()._eBackButtonTapped();
                          }
                        }
                        resolve();
                      } else {
                        notice(["buyplayer.sendclub.error", playerName], 2);
                        resolve();
                      }
                    });
                  } else {
                    let denied = data.error && data.error.code === UtasErrorCode.PERMISSION_DENIED;
                    notice(
                      [
                        "buyplayer.error",
                        playerName,
                        `${denied ? fy("buyplayer.error.child1") : ""}`
                      ],
                      2
                    );
                    resolve();
                  }
                }
              );
            });
          } else {
            notice(["buyplayer.error", playerName, fy("buyplayer.error.child4")], 2);
          }
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
      getCurrentController
    } = helpers;

    showLoader();
    let defId = 0,
      playerName = "";
    if (Number.isInteger(player)) {
      defId = player;
      playerName = repositories.Item.getStaticDataByDefId(defId).name;
    } else if (typeof player == "object" && player.isPlayer()) {
      defId = player.definitionId;
      playerName = player.getStaticData().name;
    }
    if (!defId) {
      return;
    }
    if (repositories.Item.numItemsInCache(ItemPile.PURCHASED) >= MAX_NEW_ITEMS) {
      notice(["buyplayer.error", playerName, fy("buyplayer.error.child5")], 2);
      state = false;
    } else {
      let priceList = await this.readAuctionPrices(player, undefined, undefined, helpers);
      priceList.sort((a, b) => b._auction.buyNowPrice - a._auction.buyNowPrice);
      debug.log(priceList);
      changeLoadingText("buyplayer.loadingclose");
      if (!priceList || priceList.length == 0) {
        notice(["buyplayer.error", playerName, fy("buyplayer.error.child3")], 2);
        state = false;
      } else {
        let currentPlayer = priceList[priceList.length - 1];
        let currentData = currentPlayer.getAuctionData();
        if (!currentData.canBuy(services.User.getUser().getCurrency(GameCurrency.COINS).amount)) {
          notice(["buyplayer.error", playerName, fy("buyplayer.error.child2")], 2);
          state = false;
        } else {
          if (0 < currentData.getSecondsRemaining()) {
            return new Promise(async (resolve) => {
              sendPinEvents("Item - Detail View");
              services.Item.bid(currentPlayer, currentPlayer._auction.buyNowPrice).observe(
                this,
                async function (sender, data) {
                  if (data.success) {
                    notice(
                      ["buyplayer.success", playerName, currentPlayer._auction.buyNowPrice],
                      0
                    );
                    services.Item.move(currentPlayer, ItemPile.CLUB).observe(this, (e, t) => {
                      if ((e.unobserve(this), t.success)) {
                        notice(["buyplayer.sendclub.success", playerName], 0);
                        if (isPhone()) {
                          let controller = getCurrentController();
                          if (controller.className == "UTSquadItemDetailsNavigationController") {
                            controller.getParentViewController()._eBackButtonTapped();
                          }
                        }
                      } else {
                        notice(["buyplayer.sendclub.error", playerName], 2);
                        state = false;
                      }
                      hideLoader();
                    });
                  } else {
                    let denied = data.error && data.error.code === UtasErrorCode.PERMISSION_DENIED;
                    notice(
                      [
                        "buyplayer.error",
                        playerName,
                        `${denied ? fy("buyplayer.error.child1") : ""}`
                      ],
                      2
                    );
                    state = false;
                    cardAddBuyErrorTips(defId);
                    if (view) {
                      view
                        .getSuperview()
                        .items._collection[view.getSuperview().items._index].render(player);
                    }
                    hideLoader();
                  }
                }
              );
              resolve();
            });
          } else {
            notice(["buyplayer.error", playerName, fy("buyplayer.error.child4")], 2);
            state = false;
          }
        }
      }
    }
    if (!state) {
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
      futbinId
    } = helpers;
    const info = getInfo();

    changeLoadingText("readauction.loadingclose", loadingInfo);
    let attempts = "queries_number" in info.set ? info.set.queries_number : 5;
    let defId = Number.isInteger(player)
      ? player
      : typeof player == "object" && "definitionId" in player
        ? player.definitionId
        : Number(player);
    let searchCriteria = new UTSearchCriteriaDTO();
    searchCriteria.defId = [defId];
    searchCriteria.type = SearchType.PLAYER;
    searchCriteria.category = SearchCategory.ANY;
    let searchModel = new UTBucketedItemSearchViewModel();
    searchModel.searchFeature = ItemSearchFeature.MARKET;
    searchModel.defaultSearchCriteria.type = searchCriteria.type;
    searchModel.defaultSearchCriteria.category = searchCriteria.category;
    searchModel.updateSearchCriteria(searchCriteria);
    let result = [];
    if (searchCriteria.defId.length) {
      let queried = [];
      if (price) {
        searchCriteria.maxBuy = Number(price);
      } else {
        try {
          if (_.has(info.futbinId, defId)) {
            await futbinId.getPrice(defId, info.futbinId[defId]);
          } else {
            await futbinId.getId(player);
          }
        } catch {
          return;
        }
        searchCriteria.maxBuy = getCachePrice(defId, 1).num;
      }
      searchModel.updateSearchCriteria(searchCriteria);
      changeLoadingText("readauction.loadingclose2", loadingInfo);
      while (attempts-- > 0) {
        changeLoadingText(
          ["readauction.loadingclose3", `${searchModel.searchCriteria.maxBuy.toLocaleString()}`],
          loadingInfo
        );
        if (queried.includes(searchModel.searchCriteria.maxBuy)) {
          break;
        }
        services.Item.clearTransferMarketCache();
        let response = await this.searchTransferMarket(searchModel.searchCriteria, 1, helpers);
        if (response.success) {
          sendPinEvents("Transfer Market Results - List View");
          result = result.concat(response.data.items);
          let currentQuery = searchCriteria.maxBuy;
          queried.push(currentQuery);
          if (response.data.items.length == 0) {
            currentQuery = UTCurrencyInputControl.getIncrementAboveVal(currentQuery);
          } else if (response.data.items.length == 21) {
            currentQuery = UTCurrencyInputControl.getIncrementBelowVal(currentQuery);
          } else {
            break;
          }
          searchCriteria.maxBuy = currentQuery;
          searchModel.updateSearchCriteria(searchCriteria);
        } else {
          notice("readauction.error", 2);
          break;
        }
        if (attempts > 0) {
          await wait(0.2, 0.5);
        }
      }
    }
    return result;
  }

  searchTransferMarket(criteria, type, _helpers) {
    return new Promise(async (resolve) => {
      services.Item.searchTransferMarket(criteria, type).observe(this, async function (sender, response) {
        resolve(response);
      });
    });
  }

  transferToClub(controller, list, helpers) {
    const { notice, isPhone } = helpers;

    services.Item.move(list, ItemPile.CLUB).observe(controller, (e, t) => {
      if ((e.unobserve(controller), t.success)) {
        let i = t.data.itemIds.length,
          o =
            1 < i
              ? services.Localization.localize("notification.item.allToClub", [i])
              : services.Localization.localize("notification.item.oneToClub");
        services.Notification.queue([o, UINotificationType.NEUTRAL]);
        if (i < list.length) {
          notice(["transfertoclub.unable", list.length - i], 2);
        }
        if (isPhone()) {
          controller.refreshList();
        }
      } else {
        t.data.untradeableSwap
          ? services.Notification.queue([
              services.Localization.localize("notification.item.moveFailed"),
              UINotificationType.NEGATIVE
            ])
          : (services.Notification.queue([
              services.Localization.localize("notification.item.moveFailed"),
              UINotificationType.NEGATIVE
            ]),
            NetworkErrorManager.handleStatus(t.status));
      }
    });
  }

  async playerToAuction(d, p, time, helpers) {
    const { futbinId, getInfo, getCachePrice, notice, playerGetLimits, getCurrentController } =
      helpers;
    const info = getInfo();

    let i =
      repositories.Item.transfer.get(d) ||
      repositories.Item.unassigned.get(d) ||
      repositories.Item.club.items.get(d);
    let t = repositories.Item.transfer._collection.hasOwnProperty(d);
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

      if (
        (repositories.Item.getPileSize(ItemPile.TRANSFER) -
          repositories.Item.numItemsInCache(ItemPile.TRANSFER) >
          0 ||
          t) &&
        price
      ) {
        await playerGetLimits(i);
        if (i.hasPriceLimits()) {
          if (p < i._itemPriceLimits.minimum || p > i._itemPriceLimits.maximum) {
            notice(["notice.auctionlimits", i._staticData.name], 2);
            return;
          }
        }
        let lp = UTCurrencyInputControl.getIncrementBelowVal(price);
        await services.Item.list(i, lp, price, time * 3600).observe(
          getCurrentController(),
          async (e, t) => {
            if ((e.unobserve(getCurrentController()), t.success)) {
              notice(["notice.auctionsuccess", i._staticData.name, price], 0);
            } else {
              let ix = t.error ? t.error.code : t.status;
              if (NetworkErrorManager.checkCriticalStatus(ix)) NetworkErrorManager.handleStatus(ix);
              else {
                let o;
                switch (ix) {
                  case HttpStatusCode.FORBIDDEN:
                    o = "popup.error.list.forbidden.message";
                    break;
                  case UtasErrorCode.PERMISSION_DENIED:
                    o = "popup.error.list.PermissionDenied";
                    break;
                  case UtasErrorCode.STATE_INVALID:
                    o = "popup.error.list.InvalidState";
                    break;
                  case UtasErrorCode.DESTINATION_FULL:
                    o = "popup.error.tradetoken.SellItemTradePileFull";
                    break;
                  case UtasErrorCode.CARD_IN_TRADE:
                    o = "popup.error.tradetoken.ItemInTradeOffer";
                    break;
                  default:
                    o = "popup.error.list.InvalidState";
                }
                services.Notification.queue([
                  services.Localization.localize(o),
                  UINotificationType.NEGATIVE
                ]);
              }
            }
          }
        );
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
      getLeftController
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
      await services.Item.itemDao.itemRepo.unassigned.reset();
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