import { PlayerSearchService } from "../domain/PlayerSearchService.js";
import { PlayerValueService } from "../domain/PlayerValueService.js";
import { SbcRequirementsService } from "../domain/SbcRequirementsService.js";
import { MarketActionService } from "../domain/MarketActionService.js";
import { AcademyCalcService } from "../domain/AcademyCalcService.js";
import { FgRatingService } from "../domain/FgRatingService.js";
import { registerSbcRatingEvents } from "../domain/SbcRatingService.js";
import { registerSbcDataEvents } from "../domain/SbcDataService.js";
import { registerUiEvents } from "../ui/UiFactory.js";
import { createDomainHelpers } from "./DomainHelpers.js";

import { renderPlayerDetailsButtons } from "../patches/player-details.js";
import { renderSbcSubstitutionPanel } from "../patches/sbc-substitution.js";

export function registerEarlyModules(ctx) {
  const { events, info, fy, SBCEligibilityKey } = ctx;
  const helpers = createDomainHelpers(ctx);

  registerUiEvents({ events, info, fy });

  const playerSearchService = new PlayerSearchService();
  const playerValueService = new PlayerValueService(() => info);
  events.getItemBy = (type, queryOptions, insertData, replaceData) =>
    playerSearchService.search(type, queryOptions, insertData, replaceData, helpers.playerSearch());

  events.isPrecious = (rating, flag, price, type) =>
    playerValueService.isPrecious(rating, flag, price, type);
  events.invalidatePlayerSearchCache = () => playerSearchService.invalidateCache();

  const sbcRequirementsService = new SbcRequirementsService();
  events.requirementsToText = (requirement) =>
    sbcRequirementsService.requirementsToText(requirement, SBCEligibilityKey, fy);
}

export function registerLateModules(ctx) {
  const { events, info, repositories, services, cntlr, debug, fy, isPhone, pdb } = ctx;
  const helpers = createDomainHelpers(ctx);

  registerSbcDataEvents({
    events,
    info,
    fy,
    futbinId: ctx.futbinId,
    isPhone,
    cntlr,
    services,
    debug
  });
  registerSbcRatingEvents({ events, info, debug, fy });

  const marketActionService = new MarketActionService();
  const marketHelpers = helpers.market;

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

  Object.assign(events, new AcademyCalcService().createFacade(helpers.academy));
  Object.assign(events, new FgRatingService().createFacade(helpers.fg));

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