export class PackService {
  async raelProbability(pack, helpers) {
    const { fy, hideLoader, createElementWithConfig } = helpers;

    let prod = await this.getRealProbability(pack, helpers);
    if (prod.rarity.length) {
      hideLoader();
      let mp = new EADialogViewController({
        dialogOptions: [{ labelEnum: enums.UIDialogOptions.OK }],
        message: fy(`realprob.popupm`),
        title: fy(["realprob.popupt", services.Localization.localize(pack.packName)]),
        type: EADialogView.Type.MESSAGE
      });
      mp.init();
      mp.onExit.observe(mp, (e, z) => {
        e.unobserve(mp);
      });
      gPopupClickShield.setActivePopup(mp);
      _.flatMap(mp.getView().dialogOptions, (v, i) => {
        if (v.__text.innerHTML == "*") {
          v.setText(fy(`popupButtonsText.${mp.options[i].labelEnum}`));
        }
      });
      mp.getView().__msg.style.padding = "1rem";
      mp.getView().__msg.style.fontSize = "100%";

      let pBox = createElementWithConfig("div", {
        style: {
          marginTop: "1rem"
        }
      });
      let pBoxTiltle = createElementWithConfig("div", {
        classList: "fsu-realProdTitle"
      });
      _.times(4, (index) => {
        if (!prod.eaOddo && index === 1) return;
        pBoxTiltle.appendChild(
          createElementWithConfig("div", {
            textContent: fy(`realprob.title_${index + 1}`)
          })
        );
      });
      pBox.appendChild(pBoxTiltle);

      let pBoxBody = createElementWithConfig("div", {
        classList: "fsu-realProdBody",
        style: {
          height: "auto",
          maxHeight: "30vh"
        }
      });
      _.forEach(prod.rarity, (item, index) => {
        let pBoxBodyItem = createElementWithConfig("div", {
          classList: "fsu-realProdBodyItem"
        });
        let prodKeys = ["name", "odds", "count"];
        if (prod.eaOddo) {
          prodKeys.splice(1, 0, "ea");
        }
        _.forEach(prodKeys, (key) => {
          pBoxBodyItem.appendChild(
            createElementWithConfig("div", {
              textContent: item[key]
            })
          );
        });
        pBoxBody.appendChild(pBoxBodyItem);
      });
      pBox.appendChild(pBoxBody);
      mp.getView().__msg.appendChild(pBox);
    } else {
      hideLoader();
    }
  }

  async tryPack(pack, helpers) {
    const { getInfo, jsonToItemEntity, debug, notice, hideLoader, fy } = helpers;
    const info = getInfo();

    let packJson = await this.getTryPackData(pack, helpers);

    //修改本地缓存包的oddo
    info.base.oddo[pack.id] = packJson.packItem.pack.returns.avgReturns;

    const items = jsonToItemEntity(packJson, !pack.tradable);
    if (items) {
      debug.log(items);
      this.tryPackPopup(pack, _.orderBy(items, ["rareflag", "rating"], ["desc", "desc"]), helpers);
    } else {
      notice(fy("notice.loaderror") + "player data error", 2);
      hideLoader();
    }
  }

  async tryPackPopup(pack, items, helpers) {
    const {
      createElementWithConfig,
      createButton,
      fy,
      getOddo,
      loadPlayerInfo,
      hideLoader,
      showLoader,
      getCurrentController,
      debug
    } = helpers;

    const storeVM = new UTStoreViewModel(repositories.Store.values(), []);
    let tryPackController = new UTStorePackRevealModalListViewController(
      true,
      storeVM.getPackById(10301),
      storeVM
    );
    tryPackController.init();
    tryPackController.viewmodel.addArray(items);
    tryPackController.onExit.observe(getCurrentController(), function (e, d, i) {
      e.unobserve(getCurrentController());
      if (getCurrentController().className == `UTStorePackViewController`) {
        getCurrentController().isPreviewingPack = !1;
        getCurrentController().updateViewCategories();
        getCurrentController().getView().setInteractionState(!0);
      }
      tryPackController.dealloc();
    });
    tryPackController.getView().__list.classList.add("fsu-popupItemList");
    tryPackController.getView().__footerElement.style.display = "none";

    const sumRare = _.map(items, "rareflag");
    const specialRare = _.filter(sumRare, (num) => num >= 2);

    let tryPackFooter = createElementWithConfig("footer", {
      style: {
        marginTop: "1rem"
      }
    });

    let footInfo_1 = document.createElement("div");
    let footInfo_paddingLeft = "0";
    if (_.has(pack, "categoryId") && pack.getPrice(GameCurrency.COINS)) {
      footInfo_1.innerHTML = `<span>${fy("trypack.foot.info1_1")}</span><span class="currency-coins">${pack.getPrice(GameCurrency.COINS).toLocaleString()}</span>`;
      if (pack.getPrice(GameCurrency.POINTS)) {
        footInfo_1.insertAdjacentHTML(
          "beforeend",
          `<span class="currency-points" style="padding-left: 0.5rem;">${pack.getPrice(GameCurrency.POINTS).toLocaleString()}</span>`
        );
      }
      footInfo_paddingLeft = "1rem";
    }
    footInfo_1.insertAdjacentHTML(
      "beforeend",
      `<span style="padding-left: ${footInfo_paddingLeft};">${fy(["trypack.foot.info1_2", sumRare.length, specialRare.length])}</span>`
    );
    tryPackFooter.appendChild(footInfo_1);

    let footInfo_2 = createElementWithConfig("div", {
      style: {
        paddingTop: ".2rem"
      }
    });
    footInfo_2.innerHTML = `<span>${fy("trypack.foot.info2_1")}</span>`;
    let packOddo = getOddo(pack.id);
    footInfo_2.insertAdjacentHTML(
      "beforeend",
      `<span class="currency-coins">${packOddo.toLocaleString()}</span><span style="padding-left: 1rem;">${fy("trypack.foot.info2_2")}</span><span class="currency-coins trypack-count">0</span><span style="padding-left: 1rem;">${fy("trypack.foot.info2_3")}</span><span class="trypack-diff">0%</span>`
    );
    tryPackFooter.appendChild(footInfo_2);

    let footInfo_3 = createElementWithConfig("div", {
      textContent: fy("trypack.foot.info3"),
      style: {
        paddingTop: ".2rem",
        opacity: ".5"
      }
    });
    tryPackFooter.appendChild(footInfo_3);

    let againButton = createButton(
      new UTButtonControl(),
      fy("trypack.button.again"),
      async (e) => {
        tryPackController.getView()._exitBtn._tapDetected();
        showLoader();
        // 延迟函数
        const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        // 随机生成 1000 到 2000 毫秒的延迟时间
        const randomDelay = _.random(500, 1000);
        await delay(randomDelay);
        this.tryPack(pack, helpers);
      },
      "btn-standard primary mini"
    );
    againButton.getRootElement().style.marginTop = "1rem";
    againButton.getRootElement().style.cursor = "pointer";
    againButton.setInteractionState(0);
    tryPackFooter.appendChild(againButton.getRootElement());

    tryPackController._packoddo = packOddo;
    loadPlayerInfo(items, tryPackController);

    tryPackController.getView().getRootElement().appendChild(tryPackFooter);
    gPopupClickShield.setActivePopup(tryPackController);
    debug.log(tryPackController, items);
    tryPackController
      .getView()
      .setHeader(services.Localization.localize(`FUT_STORE_PACK_${pack.id}_NAME_MOBILE`));
    let titleSuffix = createElementWithConfig("span", {
      textContent: fy("trypack.popup.suffix"),
      style: {
        color: "#36b84b",
        fontWeight: "600"
      }
    });
    tryPackController.getView().__title.appendChild(titleSuffix);
    hideLoader();
    setTimeout(() => {
      againButton.setInteractionState(1);
    }, 2000);
  }

  async getTryPackData(pack, helpers) {
    const { externalRequest, notice, hideLoader, fy, debug } = helpers;

    try {
      let packId, packName, dir, isPick;
      if (_.has(pack, "odds")) {
        packId = pack.id;
        packName = services.Localization.localize(pack.packName);
        dir = "pack";
        isPick = false;
      } else if (pack.isPlayerPickItem()) {
        packId = pack.id;
        packName = pack.getStaticData().name;
        dir = "playerpick";
        isPick = true;
      } else {
        throw new Error("pack is not valid");
      }
      packName = packName.replace(/\s+/g, "-").replace(/\//g, "&");
      const packOpenResponse = await externalRequest(
        "GET",
        `https://www.futnext.com/${dir}/${packName}/${pack.id}/open`,
        false,
        `text/x-component`
      );
      let textResponse = packOpenResponse;
      if (isPick) {
        const matches = [...textResponse.matchAll(/https:\/\/cdn\.futnext\.com\/player\/(\d+)\.png/g)];
        return matches.map((m) => Number(m[1]));
      } else {
        let textStart = textResponse.indexOf("packItem");
        let textEnd = textResponse.indexOf(`"renderItemByDefault`);
        debug.log(textStart, textEnd);
        let textResult = _.slice(textResponse, textStart, textEnd).join("");
        textResult = textResult.replace(/\\/g, "");
        textResult = '{"' + textResult + "}";
        textResult = textResult.replace(/,\}/g, "}");
        debug.log(JSON.parse(textResult));
        return JSON.parse(textResult);
      }
    } catch (error) {
      notice(fy("notice.loaderror") + error, 2);
      hideLoader();
      throw error;
    }
  }

  async getRealProbability(pack, helpers) {
    const { externalRequest, notice, hideLoader, fy, debug } = helpers;

    try {
      let packName = services.Localization.localize(pack.packName);
      packName = packName.replace(/\s+/g, "-").replace(/\//g, "&");
      const packResponse = await externalRequest(
        "GET",
        `https://www.futnext.com/pack/${packName}/${pack.id}/`,
        false,
        `text/x-component`
      );
      let textResponse = packResponse;
      let textStart = textResponse.indexOf(`"rarityOdds`);
      let textEnd = textResponse.indexOf(`},\\"returns`);

      let textResult = _.slice(textResponse, textStart, textEnd).join("");

      let step1 = textResult.replace(/\\/g, "");

      const jsonData = JSON.parse(`{${step1}}`);

      let resultJson = { rarity: [], rating: [], eaOddo: false };
      _.forEach(jsonData.rarityOdds, (j) => {
        let odds = j.odds * 100;
        resultJson.rarity.push({
          id: j.rarity.id,
          odds: `${odds.toFixed(odds >= 0.1 ? 1 : 2)}%`,
          count: (1 / j.odds).toFixed(0),
          name: services.Localization.localize("item.raretype" + j.rarity.id)
        });
      });
      if (pack.odds.length) {
        resultJson.eaOddo = true;
        _.forEach(resultJson.rarity, (r) => {
          let eaOdds = _.find(pack.odds, (item) => item.description.includes(`${r.name} `));
          if (eaOdds) {
            r.ea = eaOdds.odds;
          } else {
            r.ea = "-";
          }
        });
      }
      _.forEach(jsonData.ratingOdds, (j) => {
        let odds = j.odds * 100;
        resultJson.rating.push({
          rating: j.rating,
          odds: `${odds.toFixed(odds >= 0.1 ? 1 : 2)}%`
        });
      });
      debug.log(resultJson);
      return resultJson;
    } catch (error) {
      notice(fy("notice.loaderror") + error, 2);
      hideLoader();
      throw error;
    }
  }

  async openPacks(packId, packName, packNum, helpers) {
    const {
      getInfo,
      getCurrentController,
      hideLoader,
      notice,
      fy,
      changeLoadingText,
      showLoader,
      debug,
      getItemBy
    } = helpers;
    const info = getInfo();
    const controller = getCurrentController();

    repositories.Item.unassigned.reset();
    const unassignedItems = await new Promise((resolve) => {
      services.Item.requestUnassignedItems().observe(controller, (e, t) => {
        e.unobserve(controller);
        resolve(t);
      });
    });
    if (unassignedItems.success && JSUtils.isObject(unassignedItems.response)) {
      if (0 < unassignedItems.response.items.length) {
        hideLoader();
        getCurrentController().gotoUnassigned();
        notice(fy("openpack.unassigned.notice"), 2);
        return;
      }
    } else {
      hideLoader();
      errorNotice(unassignedItems);
      return;
    }

    function errorNotice(e) {
      const code = e.error?.code || e.status;
      notice(fy(["openpack.openerror.notice", code]), 2);
    }

    // 获取包数据
    const storeResult = await new Promise((resolve) => {
      services.Store.getPacks(PurchasePackType.ALL, true, true).observe(controller, (e, t) => {
        e.unobserve(controller);
        resolve(t);
      });
    });

    if (!storeResult.success || !JSUtils.isObject(storeResult.response)) {
      hideLoader();
      errorNotice(storeResult);
      return;
    }

    const loadingTitle = ["openpack.progress.loadertext1", packName];
    changeLoadingText(loadingTitle);

    const allPacks = _.filter(repositories.Store.myPacks.values(), { id: packId });
    if (allPacks.length < packNum) {
      notice(fy(["openpack.packnotenough.notice", packName, allPacks.length, packNum]), 2);
      return;
    }

    showLoader();
    info.run.openPacks = true;
    const packs = _.take(allPacks, packNum);
    const assignPlayer = [];
    let packOpened = 0;
    let errorOccurred = false;

    const toUnassigned = (showError = false) => {
      if (showError) {
        services.Notification.queue([
          services.Localization.localize("notification.item.moveFailed"),
          UINotificationType.NEGATIVE
        ]);
      }
      repositories.Store.setDirty();
      getCurrentController().gotoUnassigned();
      popupEnd();
    };

    const popupEnd = () => {
      hideLoader();
      if (assignPlayer.length) {
        repositories.Store.setDirty();
        debug.log(assignPlayer);

        const result = _.reduce(
          assignPlayer,
          (acc, e) => {
            if (e.storeLoc === 1) acc.clubCount++;
            else if (e.storeLoc === 2) acc.storageCount++;

            if (e.isSpecial()) acc.specialCount++;

            const rating = e.rating;
            if (rating > acc.playerMaxRating) {
              acc.playerMaxRating = rating;
            }
            if (e.packCount > acc.packCount) {
              acc.packCount = e.packCount;
            }
            return acc;
          },
          {
            clubCount: 0,
            storageCount: 0,
            specialCount: 0,
            packCount: 0,
            playerMaxRating: 0
          }
        );

        const { clubCount, storageCount, specialCount, packCount, playerMaxRating } = result;
        const showPlayers = _.orderBy(assignPlayer, ["rareflag", "rating"], ["desc", "desc"]).slice(
          0,
          20
        );
        const popupText = fy([
          "openpack.result.popupm1",
          packCount,
          packNum - packCount,
          clubCount,
          storageCount,
          specialCount,
          playerMaxRating
        ]);
        const popupTitle = fy(["openpack.result.popupt", packName]);
        this.openPacksResultPopup(
          popupTitle,
          popupText,
          showPlayers,
          fy("openpack.result.popupm2"),
          helpers
        );
      }
    };

    try {
      for (const [index, pack] of packs.entries()) {
        if (!info.run.openPacks) {
          break;
        }
        changeLoadingText(loadingTitle, [
          "openpack.progress.loadertext2",
          index + 1,
          packNum
        ]);

        const openResult = await new Promise((resolve) => {
          pack.open().observe(controller, (e, t) => {
            e.unobserve(controller);
            resolve(t);
          });
        });

        if (!openResult.success || !JSUtils.isObject(openResult.response)) {
          errorNotice(openResult);
          errorOccurred = true;
          break;
        }

        if (pack instanceof UTStoreItemPackEntity && pack?.isMyPack) {
          services.User.getUser().decrementNumUnopenedPacks();
        }

        const logData = {
          [RevenueAnalytics.Key.CURRENCY]: GameCurrency.COINS,
          [RevenueAnalytics.Key.TYPE]: pack?.dealType ?? "unknown",
          [RevenueAnalytics.Key.ID]: pack?.id?.toString() ?? "unknown"
        };
        const sdk = unsafeWindow?.services?.revenueSDK;
        if (sdk?.initialized && typeof sdk.logEvent === "function") {
          sdk.logEvent(RevenueAnalytics.Event.STORE_PACK_PURCHASED, logData);
        } else {
          console.warn("⚠️ revenueSDK 尚未初始化，跳过上报");
        }

        packOpened++;

        const toClubPlayers = [];
        const toStoragePlayers = [];
        //26.02 修改存储仓库的评分为当前仓库最低值
        const minStorageRating = _.min(_.map(repositories.Item.storage.values(), "rating"));

        for (const item of openResult.response.items) {
          const inClub = getItemBy(
            2,
            { definitionId: item.definitionId, upgrades: null },
            false,
            repositories.Item.club.items.values()
          );

          if (inClub.length) {
            if (
              item.rating >= minStorageRating &&
              repositories.Item.numItemsInCache(ItemPile.STORAGE) + toStoragePlayers.length < 100
            ) {
              item.duplicateId = _.find(inClub).id;
              item.pile = ItemPile.PURCHASED;
              item.injuryType = PlayerInjury.NONE;
              toStoragePlayers.push(item);
            }
          } else {
            toClubPlayers.push(item);
          }
        }

        if (toClubPlayers.length > 0) {
          const moveClubResult = await new Promise((resolve) => {
            services.Item.move(toClubPlayers, ItemPile.CLUB).observe(controller, (e, t) => {
              e.unobserve(controller);
              resolve(t);
            });
          });
          if (moveClubResult.success) {
            assignPlayer.push(
              ...toClubPlayers.map((item) => {
                const copy = _.cloneDeep(item);
                copy.storeLoc = 1;
                copy.packCount = index + 1;
                return copy;
              })
            );
          } else {
            toUnassigned(true);
            errorOccurred = true;
            break;
          }
        }

        if (toStoragePlayers.length > 0) {
          const moveStorageResult = await new Promise((resolve) => {
            services.Item.move(toStoragePlayers, ItemPile.STORAGE, !0).observe(controller, (e, t) => {
              e.unobserve(controller);
              resolve(t);
            });
          });
          if (moveStorageResult.success) {
            assignPlayer.push(
              ...toStoragePlayers.map((item) => {
                const copy = _.cloneDeep(item);
                copy.storeLoc = 2;
                copy.packCount = index + 1;
                return copy;
              })
            );
          } else {
            toUnassigned(true);
            errorOccurred = true;
            break;
          }
        }

        if (toClubPlayers.length + toStoragePlayers.length !== openResult.response.items.length) {
          toUnassigned(true);
          errorOccurred = true;
          break;
        }

        debug.log(`✅ 已开包：${pack.id}`, openResult.response.items);
        await new Promise((resolve) => {
          const randomDelay = 500 + Math.floor(Math.random() * 1000); // 2000-4000毫秒之间的随机值
          setTimeout(resolve, randomDelay);
        });
      }
    } finally {
      hideLoader();
      info.run.openPacks = false;
      if (!errorOccurred && packOpened > 0) {
        popupEnd();
      }
    }
  }

  openPacksConfirmPopup(packId, packName, packCount, helpers) {
    const { fy, getInfo, showLoader, debug } = helpers;
    const info = getInfo();

    let popupController = new EADialogViewController({
      dialogOptions: [
        { labelEnum: enums.UIDialogOptions.OK },
        { labelEnum: enums.UIDialogOptions.CANCEL }
      ],
      message: fy(["openpack.storebtn.popupm", info.set.goldenrange]),
      title: fy(["openpack.storebtn.popupt", packName]),
      type: EADialogView.Type.MESSAGE
    });
    popupController.init();
    let popupView = popupController.getView();
    let numberInput = new UTNumericInputSpinnerControl();
    numberInput.init();
    numberInput._currencyInput.roundToNearestStep = (t) => {
      return t;
    };
    numberInput._currencyInput.increase = function (e) {
      this.value = (JSUtils.isNumber(e) ? e : this.value) + 1;
    };

    numberInput._currencyInput.decrease = function (e) {
      this.value = (JSUtils.isNumber(e) ? e : this.value) - 1;
    };
    Object.assign(numberInput.getRootElement().style, {
      height: "3rem",
      width: "80%",
      margin: "2rem auto 1rem"
    });
    Object.assign(numberInput._decrementBtn.getRootElement().style, {
      height: "3rem",
      width: "4rem"
    });
    Object.assign(numberInput._incrementBtn.getRootElement().style, {
      height: "3rem",
      width: "4rem"
    });
    Object.assign(numberInput._currencyInput.getRootElement().style, {
      height: "3rem",
      backgroundImage: "none",
      backgroundColor: "#222",
      paddingRight: "0",
      textAlign: "center",
      fontSize: "1.4rem"
    });
    numberInput.setMaxValue(packCount);
    numberInput.setMinValue(1);
    numberInput.setValue(packCount);
    popupView.__msg.appendChild(numberInput.getRootElement());
    popupController.onExit.observe(popupController, (e, z) => {
      e.unobserve(popupController);
      if (z == 2) {
        //debug.log(packId, packName, packCount, numberInput.getValue())
        showLoader();
        this.openPacks(packId, packName, numberInput.getValue(), helpers);
      }
    });
    debug.log(popupView, numberInput);
    gPopupClickShield.setActivePopup(popupController);
  }

  openPacksResultPopup(title, text, players, desc, helpers) {
    const {
      createElementWithConfig,
      createButton,
      fy,
      loadPlayerInfo,
      openFutbinPlayerUrl,
      getCurrentController
    } = helpers;

    let popupController = new EADialogViewController({
      dialogOptions: [{ labelEnum: enums.UIDialogOptions.OK }],
      message: "",
      title: title,
      type: EADialogView.Type.MESSAGE
    });
    popupController.init();
    popupController.onExit.observe(popupController, (e, z) => {
      e.unobserve(popupController);
      popupController.dealloc();
      if (getCurrentController() instanceof UTStorePackViewController) {
        getCurrentController().getStorePacks(true);
      }
    });
    popupController._fsu = {};
    let popupView = popupController.getView();
    popupView.__msg.remove();
    popupView.__btnContainer.querySelector("button").classList.remove("text");
    popupView.__btnContainer.querySelector("button").classList.add("primary", "mini");
    let popupBox = document.createElement("div");
    if (players.length) {
      popupController._fsu.listBox = createElementWithConfig("div", {
        classList: "ut-store-reveal-modal-list-view",
        style: {
          borderRadius: "0",
          padding: "0"
        }
      });
      popupController._fsu.list = createElementWithConfig("ul", {
        classList: ["itemList", "fsu-popupItemList"]
      });
      popupController._fsu.listBox.appendChild(popupController._fsu.list);

      players.forEach((i) => {
        var o = new UTItemTableCellView();
        o.setData(i, void 0, ListItemPriority.DEFAULT);
        o.render();
        if (!desc && i._playStyles.length) {
          let popupItemOther = createElementWithConfig("div", {
            classList: "fsu-popupItemOther"
          });
          let traitBox = createElementWithConfig("div", {
            classList: "fsu-popupItemTrait"
          });
          popupItemOther.appendChild(traitBox);
          _.map(
            _.orderBy(i._playStyles, [(item) => (item.isIcon ? 0 : 1), "category"], ["asc", "asc"]),
            (t) => {
              let classList = ["fut_icon", "fsu-traitIcon"];
              if (t.isIcon) {
                classList.push(`icon_icontrait${t.traitId}`);
                classList.push("icon");
              } else {
                classList.push(`icon_basetrait${t.traitId}`);
              }
              traitBox.appendChild(
                createElementWithConfig("i", {
                  classList: classList
                })
              );
            }
          );
          let popupItemOtherBtn = createButton(
            new UTButtonControl(),
            fy("sbc.watchplayer"),
            (e) => {
              openFutbinPlayerUrl(e, i);
            },
            "btn-standard mini"
          );
          popupController._fsu[`popupItemOtherBtn_${i.id}`] = popupItemOtherBtn;
          popupItemOther.appendChild(popupItemOtherBtn.getRootElement());
          o.__rowContent.appendChild(popupItemOther);
          popupController._fsu[`popupItemOther_${i.id}`] = popupItemOther;
        }
        popupController._fsu.list.appendChild(o.getRootElement());
        popupController._fsu[`popupItemView_${i.id}`] = o;
      });
      popupBox.appendChild(popupController._fsu.listBox);
    }
    popupController.__text = createElementWithConfig("div", {
      textContent: text,
      style: {
        paddingTop: ".5rem",
        fontSize: "1rem"
      }
    });
    popupBox.appendChild(popupController.__text);
    if (desc) {
      popupController.__desc = createElementWithConfig("div", {
        textContent: desc,
        style: {
          paddingTop: ".5rem",
          fontSize: "1rem",
          opacity: ".5"
        }
      });
      popupBox.appendChild(popupController.__desc);
    }
    loadPlayerInfo(players, popupView);
    popupView.getRootElement().querySelector(".ea-dialog-view--body").prepend(popupBox);
    popupController._fsu.popupBox = popupBox;
    gPopupClickShield.setActivePopup(popupController);
  }
}