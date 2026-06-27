import { PlayerSearchService } from "../domain/PlayerSearchService.js";
import { PlayerValueService } from "../domain/PlayerValueService.js";
import { SbcRequirementsService } from "../domain/SbcRequirementsService.js";
import { MarketActionService } from "../domain/MarketActionService.js";
import { PackService } from "../domain/PackService.js";
import { AutoBuyService } from "../domain/AutoBuyService.js";
import { AcademyCalcService } from "../domain/AcademyCalcService.js";
import { FgRatingService } from "../domain/FgRatingService.js";
import { registerSbcRatingEvents } from "../domain/SbcRatingService.js";
import { registerSbcDataEvents } from "../domain/SbcDataService.js";
import { registerUiEvents } from "../ui/UiFactory.js";

import { renderPlayerDetailsButtons } from "../patches/player-details.js";
import { renderSbcSubstitutionPanel } from "../patches/sbc-substitution.js";

export function registerEarlyModules(deps) {
  const { events, info, repositories, services, debug, fy, SBCEligibilityKey } = deps;

  registerUiEvents({ events, info, fy });

  const playerSearchService = new PlayerSearchService();
  const playerValueService = new PlayerValueService(() => info);
  events.getItemBy = (type, queryOptions, insertData, replaceData) =>
    playerSearchService.search(type, queryOptions, insertData, replaceData, {
      getClubPlayers: () => repositories.Item.club.items.values(),
      getStorageItems: () => repositories.Item.getStorageItems(),
      getInfo: () => info,
      getBuild: () => info.build,
      getSet: () => info.set,
      getLock: () => info.lock,
      debug,
      repositories: { Item: repositories.Item, Squad: repositories.Squad },
      services: { User: services.User, Squad: services.Squad }
    });

  events.isPrecious = (rating, flag, price, type) =>
    playerValueService.isPrecious(rating, flag, price, type);
  events.invalidatePlayerSearchCache = () => playerSearchService.invalidateCache();

  const sbcRequirementsService = new SbcRequirementsService();
  events.requirementsToText = (requirement) =>
    sbcRequirementsService.requirementsToText(requirement, SBCEligibilityKey, fy);
}

export function registerLateModules(deps) {
  const {
    events,
    info,
    repositories,
    services,
    cntlr,
    debug,
    fy,
    eafy,
    futbinId,
    pdb,
    isPhone,
    httpClient,
    priceService
  } = deps;

  registerSbcDataEvents({ events, info, fy, futbinId, isPhone, cntlr, services, debug });
  registerSbcRatingEvents({ events, info, debug, fy });

  const marketActionService = new MarketActionService();
  const marketHelpers = () => ({
    getInfo: () => info,
    fy,
    debug,
    futbinId,
    getCachePrice: (...args) => events.getCachePrice(...args),
    createButton: (...args) => events.createButton(...args),
    pdb,
    notice: (...args) => events.notice(...args),
    xmlHttpRequest: GM_xmlhttpRequest,
    showLoader: () => events.showLoader(),
    hideLoader: () => events.hideLoader(),
    changeLoadingText: (...args) => events.changeLoadingText(...args),
    sendPinEvents: (...args) => events.sendPinEvents(...args),
    wait: (...args) => events.wait(...args),
    cardAddBuyErrorTips: (...args) => events.cardAddBuyErrorTips(...args),
    isPhone,
    getCurrentController: () => cntlr.current(),
    getLeftController: () => cntlr.left(),
    playerGetLimits: (...args) => events.playerGetLimits(...args)
  });

  events.getAuction = (e, player) => marketActionService.getAuction(e, player, marketHelpers());
  events.buyConceptPlayer = (players, view) =>
    marketActionService.buyConceptPlayer(players, view, marketHelpers());
  events.buyPlayer = (player, view) => marketActionService.buyPlayer(player, view, marketHelpers());
  events.readAuctionPrices = (player, price, loadingInfo) =>
    marketActionService.readAuctionPrices(player, price, loadingInfo, marketHelpers());
  events.searchTransferMarket = (criteria, type) =>
    marketActionService.searchTransferMarket(criteria, type, marketHelpers());
  events.transferToClub = (controller, list) =>
    marketActionService.transferToClub(controller, list, marketHelpers());
  events.playerToAuction = (d, p, time) =>
    marketActionService.playerToAuction(d, p, time, marketHelpers());
  events.losAuctionSell = (e, t) => marketActionService.losAuctionSell(e, t, marketHelpers());
  events.losAuctionCount = (e, t) => marketActionService.losAuctionCount(e, t, marketHelpers());

  const packService = new PackService();
  const packHelpers = () => ({
    fy,
    hideLoader: () => events.hideLoader(),
    showLoader: () => events.showLoader(),
    createElementWithConfig: (...args) => events.createElementWithConfig(...args),
    createButton: (...args) => events.createButton(...args),
    getInfo: () => info,
    jsonToItemEntity: (...args) => events.jsonToItemEntity(...args),
    debug,
    notice: (...args) => events.notice(...args),
    getOddo: (...args) => events.getOddo(...args),
    loadPlayerInfo: (...args) => events.loadPlayerInfo(...args),
    getCurrentController: () => cntlr.current(),
    externalRequest: (...args) => events.externalRequest(...args),
    getItemBy: (...args) => events.getItemBy(...args),
    openFutbinPlayerUrl: (...args) => events.openFutbinPlayerUrl(...args),
    createDF: (...args) => events.createDF(...args)
  });

  events.raelProbability = (pack) => packService.raelProbability(pack, packHelpers());
  events.tryPack = (pack) => packService.tryPack(pack, packHelpers());
  events.tryPackPopup = (pack, items) => packService.tryPackPopup(pack, items, packHelpers());
  events.getTryPackData = (pack) => packService.getTryPackData(pack, packHelpers());
  events.getRealProbability = (pack) => packService.getRealProbability(pack, packHelpers());
  events.writePackReturns = (packs) => packService.writePackReturns(packs, packHelpers());
  events.openPacks = (packId, packName, packNum) =>
    packService.openPacks(packId, packName, packNum, packHelpers());
  events.openPacksConfirmPopup = (packId, packName, packCount) =>
    packService.openPacksConfirmPopup(packId, packName, packCount, packHelpers());
  events.openPacksResultPopup = (title, text, players, desc) =>
    packService.openPacksResultPopup(title, text, players, desc, packHelpers());

  const autoBuyHelpers = {
    getInfo: () => info,
    getNavigationController: () => cntlr.current()?.getNavigationController?.(),
    isPhone,
    getFutbinUrl: (url) => priceService.getFutbinUrl(url),
    hideLoader: () => events.hideLoader(),
    debug,
    createElementWithConfig: (...args) => events.createElementWithConfig(...args),
    fy,
    createButton: (...args) => events.createButton(...args)
  };
  Object.assign(events, new AutoBuyService().createFacade(autoBuyHelpers));

  const academyHelpers = {
    getInfo: () => info,
    createElementWithConfig: (...args) => events.createElementWithConfig(...args),
    fy,
    notice: (...args) => events.notice(...args)
  };
  Object.assign(events, new AcademyCalcService().createFacade(academyHelpers));

  const fgHelpers = {
    getInfo: () => info,
    getAcceleRate: (...args) => events.getAcceleRate(...args),
    getBoostedAttribute: (...args) => events.getBoostedAttribute(...args),
    debug,
    getCurrentController: () => cntlr.current(),
    showLoader: () => events.showLoader(),
    hideLoader: () => events.hideLoader(),
    createElementWithConfig: (...args) => events.createElementWithConfig(...args),
    createDF: (...args) => events.createDF(...args),
    fy,
    eafy,
    notice: (...args) => events.notice(...args)
  };
  Object.assign(events, new FgRatingService().createFacade(fgHelpers));

  events.detailsButtonSet = (e) => {
    if (!isPhone() && !cntlr.current().rightController) return;
    let controller = isPhone() ? cntlr.current() : cntlr.right();
    if (!controller) return;
    if (controller.hasOwnProperty("rootController")) controller = controller.rootController;
    const panelView = controller.panelView || controller.panel;
    if (!panelView) return;

    const item = e.item;
    if (!item?.isPlayer()) return;

    const defId = item.definitionId;
    renderPlayerDetailsButtons(
      { events, fy, info, repositories, services, pdb },
      { controller, panelView, item, defId, e }
    );

    if (controller instanceof UTSlotDetailsViewController && controller.squad.isSBC()) {
      renderSbcSubstitutionPanel({ events, fy, info, repositories }, { controller, panelView, item, defId });
    }
  };
}