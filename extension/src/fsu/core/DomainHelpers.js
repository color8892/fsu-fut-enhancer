/**
 * Shared helper factories for domain services wired in ModuleRegistry.
 * @param {import("./FsuContext.js").FsuContext} ctx
 */
export function createDomainHelpers(ctx) {
  const { events, info, repositories, services, cntlr, debug, fy, eafy, futbinId, pdb, isPhone, priceService } =
    ctx;

  const eventProxy = (name) => (...args) => events[name](...args);

  return {
    market() {
      return {
        getInfo: () => info,
        fy,
        debug,
        futbinId,
        getCachePrice: eventProxy("getCachePrice"),
        createButton: eventProxy("createButton"),
        pdb,
        notice: eventProxy("notice"),
        xmlHttpRequest: ctx.GM_xmlhttpRequest,
        showLoader: () => events.showLoader(),
        hideLoader: () => events.hideLoader(),
        changeLoadingText: eventProxy("changeLoadingText"),
        sendPinEvents: eventProxy("sendPinEvents"),
        wait: eventProxy("wait"),
        cardAddBuyErrorTips: eventProxy("cardAddBuyErrorTips"),
        isPhone,
        getCurrentController: () => cntlr.current(),
        getLeftController: () => cntlr.left(),
        playerGetLimits: eventProxy("playerGetLimits")
      };
    },

    pack() {
      return {
        fy,
        hideLoader: () => events.hideLoader(),
        showLoader: () => events.showLoader(),
        changeLoadingText: eventProxy("changeLoadingText"),
        wait: eventProxy("wait"),
        createElementWithConfig: eventProxy("createElementWithConfig"),
        createButton: eventProxy("createButton"),
        getInfo: () => info,
        jsonToItemEntity: eventProxy("jsonToItemEntity"),
        debug,
        notice: eventProxy("notice"),
        getOddo: eventProxy("getOddo"),
        loadPlayerInfo: eventProxy("loadPlayerInfo"),
        getCurrentController: () => cntlr.current(),
        externalRequest: eventProxy("externalRequest"),
        getItemBy: eventProxy("getItemBy"),
        openFutbinPlayerUrl: eventProxy("openFutbinPlayerUrl"),
        createDF: eventProxy("createDF")
      };
    },

    autoBuy: {
      getInfo: () => info,
      getNavigationController: () => cntlr.current()?.getNavigationController?.(),
      isPhone,
      getFutbinUrl: (url) => priceService.getFutbinUrl(url),
      hideLoader: () => events.hideLoader(),
      debug,
      createElementWithConfig: eventProxy("createElementWithConfig"),
      fy,
      createButton: eventProxy("createButton")
    },

    academy: {
      getInfo: () => info,
      createElementWithConfig: eventProxy("createElementWithConfig"),
      fy,
      notice: eventProxy("notice")
    },

    fg: {
      getInfo: () => info,
      getAcceleRate: eventProxy("getAcceleRate"),
      getBoostedAttribute: eventProxy("getBoostedAttribute"),
      debug,
      getCurrentController: () => cntlr.current(),
      showLoader: () => events.showLoader(),
      hideLoader: () => events.hideLoader(),
      createElementWithConfig: eventProxy("createElementWithConfig"),
      createDF: eventProxy("createDF"),
      fy,
      eafy,
      notice: eventProxy("notice")
    },

    playerSearch() {
      return {
        getClubPlayers: () => repositories.Item.club.items.values(),
        getStorageItems: () => repositories.Item.getStorageItems(),
        getInfo: () => info,
        getBuild: () => info.build,
        getSet: () => info.set,
        getLock: () => info.lock,
        debug,
        repositories: { Item: repositories.Item, Squad: repositories.Squad },
        services: { User: services.User, Squad: services.Squad }
      };
    }
  };
}