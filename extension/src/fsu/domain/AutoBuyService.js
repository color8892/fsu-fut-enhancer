export class AutoBuyService {
  goToAutoBuy(e, helpers) {
    const { getInfo, getNavigationController, isPhone } = helpers;
    const info = getInfo();
    let nav = getNavigationController();
    if (nav) {
      if (info.autobuy.controller) {
        nav.pushViewController(info.autobuy.controller);
      } else {
        let criteria = new UTSearchCriteriaDTO;
        criteria.type = SearchType.PLAYER;
        let controller = isPhone() ? new UTClubSearchResultsViewController : new controllers.club.ClubSearchResultsLandscape;
        controller.initWithSearchCriteria(criteria);


        controller.dealloc = function () {
          info.autobuy.controller = this;
        }

        let searchController = isPhone() ? controller : controller._listController;

        searchController._fsuAutoBuy = true;
        searchController._fsuAutoBuyPlayers = [];

        let rightContainer = new UTPlayerBioViewController;
        rightContainer.initWithItem(new UTItemEntity);
        rightContainer.isFsuAutoBuy = true;
        rightContainer.getView().getRootElement().style.width = "40%";
        rightContainer.getView().addClass("fsu-autobuy-right");
        rightContainer.getView().isFsuAutoBuy = true;
        searchController._fsuAutoBuyRight = rightContainer;

        nav.pushViewController(controller);
      }
    }
  }

  autoBuySearchPlayer(inputSelected, controller, helpers) {
    const { getInfo, getFutbinUrl, hideLoader, debug } = helpers;
    const info = getInfo();
    let criteria = new UTSearchCriteriaDTO;
    criteria.count = 200;
    criteria.defId.push(inputSelected.id)
    criteria.sortBy = "ovr"
    services.Item.searchConceptItems(criteria).observe(controller,
      async (e, t) => {
        if (e.unobserve(controller), JSUtils.isObject(t.response) && t.response.items) {
          try {
            const PlayerName = inputSelected.name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/ø/g, "o");
            const playerData = await getFutbinUrl(`https://www.futbin.org/futbin/api/${info.base.year}/searchPlayersByName?playername=${PlayerName}&year=${info.base.year}`);

            let players = _.cloneDeep(t.response.items);
            _.forEach(players, (p) => {
              p._fsuPrice = 0;
              p._fsuClosing = 0;
              p._fsuMin = 0;
              p._fsuMax = 0;
              p._fsuFutbinId = "0";
              let futbinPlayerData = _.find(playerData.data, { resource_id: _.toString(p.definitionId) });
              if (futbinPlayerData && futbinPlayerData.pc_MaxPrice && futbinPlayerData.ps_MinPrice) {
                p.untradeableCount = 0;
                p._fsuFutbinId = futbinPlayerData.ID;

                5
                p._fsuMin = futbinPlayerData[`${info.base.platform}_MinPrice`];
                p._fsuMax = futbinPlayerData[`${info.base.platform}_MaxPrice`];
                let pClosing = futbinPlayerData[`${info.base.platform}_LCPClosing`]
                if (pClosing !== null) {
                  p._fsuClosing = pClosing;
                }
                let pPrice = futbinPlayerData[`${info.base.platform}_LCPrice`]
                if (pPrice !== null) {
                  p._fsuPrice = pPrice;
                  info.roster.data[p.definitionId] = {
                    "n": pPrice,
                    "t": pPrice.toLocaleString(),
                  }
                }
              }
              p.concept = false;
            })
            controller._fsuAutoBuyPlayers = players;
            controller.getView().getRootElement().style.width = "60%";
            controller._requestItems()
          } catch (error) {
            debug.log(error)
            return;
          }
        } else {
          NetworkErrorManager.handleStatus(t.status)
        }
        hideLoader()
      }
    )
  }

  autoBuyRightRefresh(controller, item) {
    controller.pinnedItemController.setItem(item)
    controller.pinnedItem = item;
    controller.render()
  }

  autoBuyCreateInfoView(item, helpers) {
    const { getInfo, createElementWithConfig, fy, createButton } = helpers;
    const info = getInfo();
    let view = new EAView;
    let display = view.getRootElement();

    view._item = item;

    let titleBox = createElementWithConfig("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        overflow: "hidden",
        alignItems: "center",
        boxSizing: "border-box",
        width: "100%",
        padding: "1rem",
      }
    })
    let titleText = createElementWithConfig("div", {
      textContent: fy("autobuy.info.title"),
      style: {
        fontSize: "1.2rem",
      }
    })
    titleBox.appendChild(titleText);

    let titleClear = new UTFlatButtonControl;
    titleClear.init();
    titleClear.setText(services.Localization.localize("search.button.clear"));
    titleClear.setInteractionState(!1);
    titleClear.getRootElement().classList.add("camel-case");
    titleBox.appendChild(titleClear.getRootElement());
    view._clearButton = titleClear

    display.appendChild(titleBox);

    let priceBox = createElementWithConfig("div", {
      style: {
        padding: "0 1rem",
      }
    })

    let minBox = createElementWithConfig("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }
    })

    let minText = createElementWithConfig("div", {
      textContent: fy("autobuy.info.mintext"),
      style: {
        paddingRight: "1rem",
      }
    })
    minBox.appendChild(minText)

    const minBidPrice = item._fsuMin || AUCTION_MIN_BID;
    const maxBidPrice = item._fsuMax || AUCTION_MAX_BID;

    let minBuy = new UTNumericInputSpinnerControl;
    minBuy.init()
    minBuy.setMinValue(minBidPrice);
    minBuy.setMaxValue(UTCurrencyInputControl.getIncrementBelowVal(maxBidPrice));
    minBox.appendChild(minBuy.getRootElement())
    view._min = minBuy
    priceBox.appendChild(minBox)

    let maxBox = createElementWithConfig("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: "1rem",
      }
    })

    let maxText = createElementWithConfig("div", {
      textContent: fy("autobuy.info.maxtext"),
      style: {
        paddingRight: "1rem",
      }
    })
    maxBox.appendChild(maxText)

    let maxBuy = new UTNumericInputSpinnerControl;
    maxBuy.init()
    maxBuy.setMinValue(UTCurrencyInputControl.getIncrementAboveVal(minBidPrice));
    maxBuy.setMaxValue(maxBidPrice);
    maxBox.appendChild(maxBuy.getRootElement())
    view._max = maxBuy
    priceBox.appendChild(maxBox)

    titleClear.addTarget(view, () => {
      maxBuy.setValue(0);
      minBuy.setValue(0);
    }, EventType.TAP)

    minBuy.getInput().addTarget(view, () => {
      this.autoBuyRightMinBuyChanged(minBuy, maxBuy, titleClear)
    }, EventType.CHANGE);

    maxBuy.getInput().addTarget(view, () => {
      this.autoBuyRightMaxBuyChanged(minBuy, maxBuy, titleClear)
    }, EventType.CHANGE);

    view.setPriceBtn = createButton(
      new UTStandardButtonControl(),
      fy("autobuy.info.setprice"),
      () => {
        maxBuy.setValue(item._fsuPrice);
        minBuy.setValue(UTCurrencyInputControl.getIncrementBelowVal(item._fsuPrice));
      },
      "call-to-action mini"
    );
    view.setPriceBtn.setInteractionState(item._fsuPrice);
    view.goToSalesBtn = createButton(
      new UTStandardButtonControl(),
      fy("autobuy.info.gotosales"),
      () => {
        GM_openInTab(`https://www.futbin.com/${info.base.year}/sales/${item._fsuFutbinId}/${item.getStaticData().name.toLowerCase()}?platform=${info.base.platform}`, { active: true, insert: true, setParent: true });
      },
      "call-to-action mini"
    )

    let btnBox = createElementWithConfig("div", {
      style: {
        display: "flex",
        justifyContent: "space-evenly",
        alignItems: "end",
        position: "absolute",
        top: "0",
        right: "-1.6rem",
        flexDirection: "column",
        height: "100%",
      },
      classList: ["fsu-autobuy-btn"],
    })
    btnBox.appendChild(view.setPriceBtn.getRootElement())
    btnBox.appendChild(view.goToSalesBtn.getRootElement())
    view._cardBtnBox = btnBox;

    display.appendChild(priceBox)

    return view;
  }

  autoBuyCreateLogView(item, helpers) {
    const { getInfo } = helpers;
    const info = getInfo();
    let view = new EAView;
    let display = view.getRootElement();
    info.autobuy.logView = view;
  }

  autoBuyRightRenderInfo(view, item, helpers) {
    const { createElementWithConfig, fy, debug } = helpers;
    let display = view.__dataDisplay;
    // view.createHeader(display, services.Localization.localize("extendedPlayerInfo.tab.stats"));
    // view.createHeader(display, fy("autobuy.info.title"));
    // view.layoutSubviews()

    let titleBox = createElementWithConfig("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        overflow: "hidden",
        alignItems: "center",
        boxSizing: "border-box",
        width: "100%",
        padding: "1rem",
      }
    })
    let titleText = createElementWithConfig("div", {
      textContent: fy("autobuy.info.title"),
      style: {
        fontSize: "1.2rem",
      }
    })
    titleBox.appendChild(titleText)

    let titleClear = new UTFlatButtonControl
    titleClear.init()
    titleClear.setText(services.Localization.localize("search.button.clear"))
    titleClear.setInteractionState(!1)
    titleClear.getRootElement().classList.add("camel-case")
    titleBox.appendChild(titleClear.getRootElement())

    display.appendChild(titleBox)


    let priceBox = createElementWithConfig("div", {
      style: {
        padding: "0 1rem",
      }
    })

    let minBox = createElementWithConfig("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }
    })

    let minText = createElementWithConfig("div", {
      textContent: fy("autobuy.info.mintext"),
      style: {
        paddingRight: "1rem",
      }
    })
    minBox.appendChild(minText)

    const minBidPrice = item._fsuMin || AUCTION_MIN_BID;
    const maxBidPrice = item._fsuMax || AUCTION_MAX_BID;

    let minBuy = new UTNumericInputSpinnerControl;
    minBuy.init()
    minBuy.setMinValue(minBidPrice);
    minBuy.setMaxValue(UTCurrencyInputControl.getIncrementBelowVal(maxBidPrice));
    minBox.appendChild(minBuy.getRootElement())
    priceBox.appendChild(minBox)

    let maxBox = createElementWithConfig("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: "1rem",
      }
    })

    let maxText = createElementWithConfig("div", {
      textContent: fy("autobuy.info.maxtext"),
      style: {
        paddingRight: "1rem",
      }
    })
    maxBox.appendChild(maxText)

    let maxBuy = new UTNumericInputSpinnerControl;
    maxBuy.init()
    maxBuy.setMinValue(UTCurrencyInputControl.getIncrementAboveVal(minBidPrice));
    maxBuy.setMaxValue(maxBidPrice);
    maxBox.appendChild(maxBuy.getRootElement())
    priceBox.appendChild(maxBox)

    titleClear.addTarget(view, () => {
      maxBuy.setValue(0);
      minBuy.setValue(0);
    }, EventType.TAP)

    debug.log(minBuy, maxBuy)

    minBuy.getInput().addTarget(view, () => {
      this.autoBuyRightMinBuyChanged(minBuy, maxBuy, titleClear)
    }, EventType.CHANGE);

    maxBuy.getInput().addTarget(view, () => {
      this.autoBuyRightMaxBuyChanged(minBuy, maxBuy, titleClear)
    }, EventType.CHANGE);

    display.appendChild(priceBox)
  }

  autoBuyRightMinBuyChanged(eMin, eMax, eClear) {
    let min = eMin.getValue(), max = eMax.getValue();
    eClear.setInteractionState(eMin.getMinValue() < min || eMax.getMinValue() < max);
    if (0 !== min && min >= max && min !== eMin.getMinValue()) {
      eMax.setValue(UTCurrencyInputControl.getIncrementAboveVal(min));
    }
  }

  autoBuyRightMaxBuyChanged(eMin, eMax, eClear) {
    let min = eMin.getValue(), max = eMax.getValue();
    eClear.setInteractionState(eMin.getMinValue() < min || eMax.getMinValue() < max);
    if (0 !== max && min >= max && min !== eMin.getMinValue()) {
      eMin.setValue(UTCurrencyInputControl.getIncrementBelowVal(max));
    }
  }

  autoBuyRightRenderLog(view, item) {

  }

  autoBuyCreateItemController(controller, item) {

  }

  createFacade(helpers) {
    return {
      goToAutoBuy: (e) => this.goToAutoBuy(e, helpers),
      autoBuySearchPlayer: (inputSelected, controller) => this.autoBuySearchPlayer(inputSelected, controller, helpers),
      autoBuyRightRefresh: (controller, item) => this.autoBuyRightRefresh(controller, item),
      autoBuyCreateInfoView: (item) => this.autoBuyCreateInfoView(item, helpers),
      autoBuyCreateLogView: (item) => this.autoBuyCreateLogView(item, helpers),
      autoBuyRightRenderInfo: (view, item) => this.autoBuyRightRenderInfo(view, item, helpers),
      autoBuyRightMinBuyChanged: (eMin, eMax, eClear) => this.autoBuyRightMinBuyChanged(eMin, eMax, eClear),
      autoBuyRightMaxBuyChanged: (eMin, eMax, eClear) => this.autoBuyRightMaxBuyChanged(eMin, eMax, eClear),
      autoBuyRightRenderLog: (view, item) => this.autoBuyRightRenderLog(view, item),
      autoBuyCreateItemController: (controller, item) => this.autoBuyCreateItemController(controller, item),
    };
  }
}