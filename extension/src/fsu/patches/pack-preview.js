import { PackPreviewService } from "../domain/PackPreviewService.js";
import { EaObservableAdapter } from "../ea/EaObservableAdapter.js";

function createPreviewItems(payload) {
  const base = {
    assetId: 0,
    assists: 0,
    attributeArray: [0, 0, 0, 0, 0, 0],
    baseTraits: [],
    cardsubtypeid: 2,
    contract: 7,
    discardValue: 0,
    formation: "f3412",
    gender: 0,
    id: 0,
    injuryGames: 0,
    injuryType: "none",
    itemState: "free",
    itemType: "player",
    lastSalePrice: 0,
    leagueId: 0,
    lifetimeAssists: 0,
    lifetimeStatsArray: [0, 0, 0, 0, 0],
    loyaltyBonus: 1,
    marketDataMaxPrice: 0,
    marketDataMinPrice: 0,
    nation: 0,
    owners: 1,
    pile: 7,
    playStyle: 250,
    plusRoles: [],
    possiblePositions: [],
    preferredPosition: "",
    preferredfoot: 1,
    rareflag: 0,
    rating: 0,
    resourceGameYear: 2026,
    resourceId: 0,
    skillmoves: 0,
    statsArray: [0, 0, 0, 0, 0],
    teamid: 0,
    timestamp: 0,
    untradeable: true,
    weakfootabilitytypecode: 0
  };
  const factory = new UTItemEntityFactory();
  return payload.packItem.items.map((item) => {
    const positions = Array.isArray(item.positions) ? item.positions : [];
    const traits = Array.isArray(item.traits) ? item.traits : [];
    return factory.createItem({
      ...base,
      assetId: Number(item.id) || 0,
      resourceId: Number(item.id) || 0,
      rating: Number(item.rating) || 0,
      preferredPosition:
        positions.find((position) => position.isPreferred)?.name || "",
      teamid: Number(item.club?.id) || 0,
      leagueId: Number(item.league?.id) || 0,
      nation: Number(item.nation?.id) || 0,
      attributeArray: Object.values(item.attributes || {}),
      skillmoves: Math.max(0, (Number(item.skills) || 1) - 1),
      weakfootabilitytypecode: Number(item.weekFoot) || 0,
      preferredfoot: Number(item.foot) || 1,
      possiblePositions: positions.map((position) => position.name),
      baseTraits: traits
        .filter((trait) => trait.isIcon === false)
        .map((trait) => trait.id),
      iconTraits: traits
        .filter((trait) => trait.isIcon === true)
        .map((trait) => trait.id),
      rareflag: Number(item.rarity?.id) || 0
    });
  });
}

function showProbabilityPopup({ pack, probability, events, fy, services }) {
  const controller = new EADialogViewController({
    dialogOptions: [{ labelEnum: enums.UIDialogOptions.OK }],
    message: "",
    title: fy([
      "realprob.popupt",
      services.Localization.localize(pack.packName)
    ]),
    type: EADialogView.Type.MESSAGE
  });
  controller.init();
  const body = controller.getView().__msg;
  body.replaceChildren();
  body.appendChild(
    events.createElementWithConfig("p", {
      textContent: fy("realprob.popupm").replace(/<br\s*\/?>/gi, "\n"),
      style: { whiteSpace: "pre-line" }
    })
  );
  const table = document.createElement("div");
  table.className = "fsu-realProdBody";
  const header = events.createElementWithConfig("div", {
    classList: "fsu-realProdTitle"
  });
  [
    fy("realprob.title_1"),
    fy("realprob.title_2"),
    fy("realprob.title_3"),
    fy("realprob.title_4")
  ].forEach((value) => {
    header.appendChild(
      events.createElementWithConfig("div", {
        textContent: value
      })
    );
  });
  table.appendChild(header);
  probability.rarity.forEach((entry) => {
    const row = events.createElementWithConfig("div", {
      classList: "fsu-realProdBodyItem"
    });
    const odds = entry.odds * 100;
    const name = services.Localization.localize(`item.raretype${entry.id}`);
    const ea = Array.isArray(pack.odds)
      ? pack.odds.find((item) =>
          String(item.description || "").includes(`${name} `)
        )?.odds || "-"
      : "-";
    [name, ea, `${odds.toFixed(odds >= 0.1 ? 1 : 2)}%`, Math.round(1 / entry.odds)]
      .forEach((value) => {
        row.appendChild(
          events.createElementWithConfig("div", {
            textContent: String(value)
          })
        );
      });
    table.appendChild(row);
  });
  body.appendChild(table);
  gPopupClickShield.setActivePopup(controller);
}

export function registerPackPreviewEvents(deps) {
  const {
    events,
    info,
    cntlr,
    fy,
    services,
    httpClient,
    debug
  } = deps;
  const previewService = new PackPreviewService({
    request: (...args) => httpClient.request(...args)
  });
  const observableAdapter = new EaObservableAdapter();

  events.tryPack = async (pack) => {
    events.showLoader();
    try {
      const result = await previewService.getPackPreview({
        id: pack.id,
        name: services.Localization.localize(pack.packName)
      });
      if (!result.success) {
        debug.log("Pack preview rejected", result);
        events.notice("notice.loaderror", 2);
        return false;
      }
      const items = createPreviewItems(result.data);
      const returns = Number(
        result.data.packItem.pack?.returns?.avgReturns
      );
      if (Number.isFinite(returns) && returns >= 0) {
        info.base.oddo[pack.id] = returns;
      }
      const specialCount = items.filter(
        (item) => Number(item.rareflag) >= 2
      ).length;
      events.showPlayerListPopup(
        `${services.Localization.localize(pack.packName)} ${fy("trypack.popup.suffix")}`,
        fy(["trypack.foot.info1_2", items.length, specialCount]),
        _.orderBy(items, ["rareflag", "rating"], ["desc", "desc"]),
        fy("trypack.foot.info3")
      );
      return true;
    } catch (error) {
      debug.log("Pack preview failed", error);
      events.notice("notice.loaderror", 2);
      return false;
    } finally {
      events.hideLoader();
    }
  };

  events.raelProbability = async (pack) => {
    events.showLoader();
    try {
      const result = await previewService.getProbability({
        id: pack.id,
        name: services.Localization.localize(pack.packName)
      });
      if (!result.success) {
        debug.log("Pack probability rejected", result);
        events.notice("notice.loaderror", 2);
        return false;
      }
      showProbabilityPopup({
        pack,
        probability: result.data,
        events,
        fy,
        services
      });
      return true;
    } catch (error) {
      debug.log("Pack probability failed", error);
      events.notice("notice.loaderror", 2);
      return false;
    } finally {
      events.hideLoader();
    }
  };

  events.fixedPickPopup = async (pickItem) => {
    events.showLoader();
    try {
      const staticData = pickItem.getStaticData();
      const result = await previewService.getPlayerPickPreview({
        id: pickItem.id,
        name: staticData.name
      });
      if (!result.success) {
        debug.log("Player pick preview rejected", result);
        events.notice("notice.loaderror", 2);
        return false;
      }
      const criteria = new UTSearchCriteriaDTO();
      criteria.count = 200;
      criteria.defId = result.data;
      const observed = await observableAdapter.observeOnce(
        services.Item.searchConceptItems(criteria),
        cntlr.current(),
        "store.player-pick-preview"
      );
      const response = observed?.data;
      if (
        !observed?.success ||
        !response?.success ||
        !Array.isArray(response.response?.items)
      ) {
        debug.log("Player pick concept search rejected", observed);
        events.notice("notice.loaderror", 2);
        return false;
      }
      const allowed = new Set(result.data);
      const players = response.response.items.filter((item) => {
        if (!allowed.has(item.definitionId)) return false;
        item.concept = false;
        return true;
      });
      events.showPlayerListPopup(
        staticData.description || staticData.name,
        fy("pickpreview.popupm"),
        players
      );
      return true;
    } catch (error) {
      debug.log("Player pick preview failed", error);
      events.notice("notice.loaderror", 2);
      return false;
    } finally {
      events.hideLoader();
    }
  };
}
