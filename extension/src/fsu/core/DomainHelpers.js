import { EaRuntimeAdapter } from "../ea/EaRuntimeAdapter.js";
import { renderAuctionPriceBreakdown } from "../ui/MarketAuctionRenderer.js";

/**
 * Shared helper factories for domain services wired in ModuleRegistry.
 * @param {import("./FsuContext.js").FsuContext} ctx
 */
export function createDomainHelpers(ctx) {
  const { events, info, repositories, services, cntlr, debug, fy, eafy, futbinId, pdb, isPhone } = ctx;
  const ea = new EaRuntimeAdapter({
    getServices: () => services,
    getRepositories: () => repositories,
    getItemRuntime: () => ({
      ItemPile: typeof ItemPile === "undefined" ? undefined : ItemPile,
      GameCurrency: typeof GameCurrency === "undefined" ? undefined : GameCurrency,
      UtasErrorCode: typeof UtasErrorCode === "undefined" ? undefined : UtasErrorCode,
      HttpStatusCode: typeof HttpStatusCode === "undefined" ? undefined : HttpStatusCode,
      UINotificationType:
        typeof UINotificationType === "undefined" ? undefined : UINotificationType,
      NetworkErrorManager:
        typeof NetworkErrorManager === "undefined" ? undefined : NetworkErrorManager
    }),
    getMarketRuntime: () => ({
      UTSearchCriteriaDTO:
        typeof UTSearchCriteriaDTO === "undefined" ? undefined : UTSearchCriteriaDTO,
      UTBucketedItemSearchViewModel:
        typeof UTBucketedItemSearchViewModel === "undefined"
          ? undefined
          : UTBucketedItemSearchViewModel,
      UTCurrencyInputControl:
        typeof UTCurrencyInputControl === "undefined" ? undefined : UTCurrencyInputControl,
      SearchType: typeof SearchType === "undefined" ? undefined : SearchType,
      SearchCategory: typeof SearchCategory === "undefined" ? undefined : SearchCategory,
      ItemSearchFeature:
        typeof ItemSearchFeature === "undefined" ? undefined : ItemSearchFeature
    })
  });

  const eventProxy = (name) => (...args) => events[name](...args);

  return {
    market() {
      return {
        getInfo: () => info,
        fy,
        debug,
        futbinId,
        getCachePrice: eventProxy("getCachePrice"),
        pdb,
        notice: eventProxy("notice"),
        ea,
        maxNewItems:
          typeof MAX_NEW_ITEMS === "number" && Number.isFinite(MAX_NEW_ITEMS)
            ? MAX_NEW_ITEMS
            : 100,
        renderAuctionPrices: (anchor, rows) =>
          renderAuctionPriceBreakdown(anchor, rows, {
            createControl: () =>
              typeof UTGroupButtonControl === "undefined"
                ? null
                : new UTGroupButtonControl(),
            createButton: eventProxy("createButton"),
            localize: fy
          }),
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
