import { safeParseJson } from "../infra/JsonParsing.js";
import { escapeHtml } from "../ui/HtmlSafety.js";
import { SbcResponseAdapter } from "./SbcResponseAdapter.js";
import { parseRemoteSbcSquad } from "./SbcSnapshotResults.js";
import { SbcUndoHistoryService } from "./SbcUndoHistoryService.js";
import { SbcVirtualChallengeAdapter } from "../ea/SbcVirtualChallengeAdapter.js";

export class SbcDataService {
  constructor({
    responseAdapter = new SbcResponseAdapter(),
    undoHistoryService = new SbcUndoHistoryService()
  } = {}) {
    this.responseAdapter = responseAdapter;
    this.undoHistoryService = undoHistoryService;
  }

  async getFutbinSbcSquad(id, type, helpers) {
    const { getInfo, externalRequest, notice, hideLoader, fy, futbinId } = helpers;
    const info = getInfo();
    const platform = info.base.platform == "pc" ? "PC" : "PS";
    const url =
      type == 1
        ? `https://www.futbin.org/futbin/api/${info.base.year}/getChallengeTopSquads?chal_id=${id}&platform=${platform}`
        : type == 2
          ? `https://www.futbin.org/futbin/api/${info.base.year}/getSquadByID?squadId=${id}&platform=${platform}`
          : `https://www.fut.gg/api/squads/${id}`;

    try {
      const futBinResponse = await externalRequest("GET", url);
      const parsedResponse = safeParseJson(futBinResponse, null, {
        label: "futbin-sbc-squad"
      });
      const result = parseRemoteSbcSquad(parsedResponse, Number(type));
      if (result.success) {
        if (result.mappings.length > 0) {
          futbinId.commitSquadPlayers(result.mappings);
        }
        return result.data;
      }

      notice("notice.squaderror", 2);
      hideLoader();
      return false;
    } catch (error) {
      notice(fy("notice.loaderror") + error, 2);
      if (document.querySelector(".ut-click-shield").classList.contains("showing")) {
        hideLoader();
      }
      throw error;
    }
  }

  adaptSbcSetsResponse(response) {
    return this.responseAdapter.adaptSetsResponse(response);
  }

  adaptSbcChallengesResponse(response) {
    return this.responseAdapter.adaptChallengesResponse(response);
  }

  adaptSbcChallengeSquadResponse(response) {
    return this.responseAdapter.adaptChallengeSquadResponse(response);
  }

  saveOldSquad(s, t, helpers) {
    const { getInfo, isPhone, getCurrentController } = helpers;
    const info = getInfo();

    if (s.isSBC() && (!info.base.savesquad || !t)) {
      const fsu = (s._fsu ??= {});
      const pl = s.getPlayers().map((i) => i.getItem());
      const history = this.undoHistoryService.capture(
        {
          snapshots: fsu.oldSquad,
          index: fsu.oldSquadCount
        },
        pl
      );
      fsu.oldSquad = history.snapshots;
      fsu.oldSquadCount = history.index;
      if (history.changed) {
        if (isPhone() && getCurrentController().className == "UTSquadItemDetailsNavigationController") {
          setTimeout(() => {
            getCurrentController().parentViewController._eBackButtonTapped();
          }, 500);
        }
      }

      if (!!fsu?.bulkBuyBtn?.getRootElement()) {
        if (s.isDream()) {
          fsu.bulkBuyBtn.show();
        } else {
          fsu.bulkBuyBtn.hide();
        }
      }
    }
  }

  replaceOldSquadItem(squad, slotIndex, item) {
    const fsu = squad?._fsu;
    if (!fsu) return false;
    const history = this.undoHistoryService.replaceCurrentItem(
      {
        snapshots: fsu.oldSquad,
        index: fsu.oldSquadCount
      },
      slotIndex,
      item
    );
    fsu.oldSquad = history.snapshots;
    fsu.oldSquadCount = history.index;
    return history.changed;
  }

  getRatingPlayers(squad, ratings, helpers) {
    const { getItemBy, ignorePlayerToCriteria, getInfo, debug } = helpers;
    const info = getInfo();

    const assignPlayer = (playerlist, shortlist, Exclusionlist, index, pos) => {
      const player =
        pos !== null
          ? _.find(shortlist, (item) => item.basePossiblePositions.includes(pos))
          : _.head(shortlist);
      if (player) {
        playerlist[index] = player;
        shortlist = _.without(shortlist, player);
        Exclusionlist.push(player.databaseId);
      }
      return shortlist;
    };

    const buildExclusionList = (players) => {
      return players
        .map((i) => (i.item.rating && !i.item.concept ? i.item.databaseId : null))
        .filter(Boolean);
    };

    const buildConceptConfig = (fieldPlayers) => {
      const conceptConfig = {};
      _.forEach(fieldPlayers, (i) => {
        if (i.item.concept) {
          const rating = i.item.rating;
          if (!conceptConfig[rating]) {
            conceptConfig[rating] = { pos: [], index: [] };
          }
          conceptConfig[rating].pos.push(i.generalPosition);
          conceptConfig[rating].index.push(i.index);
        }
      });
      return conceptConfig;
    };

    const processRatings = (ratingsList, squadVacancy) => {
      const fillConfig = {};

      const processRating = (rating) => {
        if (squadVacancy.length) {
          const headVacancy = _.head(squadVacancy);
          squadVacancy = _.tail(squadVacancy);

          if (!fillConfig[rating]) {
            fillConfig[rating] = {
              pos: [],
              index: [],
              rat: parseInt(rating, 10)
            };
          }

          fillConfig[rating].pos.push(headVacancy.generalPosition);
          fillConfig[rating].index.push(headVacancy.index);
        }
      };

      const completeRatingsList = ratingsList.length === 1
        ? _.fill(Array(squadVacancy.length), ratingsList[0])
        : ratingsList;

      _.forEach(completeRatingsList, processRating);
      return fillConfig;
    };

    const processFillConfig = (fillConfig, criteria, Exclusionlist, playerlist) => {
      _.forEach(fillConfig, (v, k) => {
        const need = _.cloneDeep(criteria);
        need.NEdatabaseId = Exclusionlist;
        const ratingKey = k.includes("+") ? "GTrating" : k.includes("-") ? "LTrating" : "rating";
        need[ratingKey] = v.rat;

        let shortlist = getItemBy(2, need, repositories.Item.getUnassignedItems());

        _.forEach(v.index, (i, s) => {
          if (shortlist.length) {
            const pos = info.build.ignorepos ? null : v.pos[s];
            shortlist = assignPlayer(playerlist, shortlist, Exclusionlist, i, pos);
          }
        });
      });
    };

    const playerlist = _.map(squad.getPlayers(), "item");
    const ratingsList = ratings ? Array.from(ratings) : [];
    const Exclusionlist = buildExclusionList(squad.getPlayers());
    const criteria = ignorePlayerToCriteria({ NEdatabaseId: Exclusionlist, lock: false });
    const conceptConfig = buildConceptConfig(squad.getFieldPlayers());

    _.forEach(conceptConfig, (v, k) => {
      const need = _.cloneDeep(criteria);
      need.rating = Number(k);
      need.NEdatabaseId = Exclusionlist;

      let shortlist = getItemBy(2, need, repositories.Item.getUnassignedItems());

      _.forEach(v.index, (i, s) => {
        if (shortlist.length) {
          const pos = info.build.ignorepos ? null : v.pos[s];
          shortlist = assignPlayer(playerlist, shortlist, Exclusionlist, i, pos);
        }
      });
    });

    if (ratingsList.length) {
      const squadVacancy = _.filter(squad.getPlayers(), (i) => !i.isValid());
      const fillConfig = processRatings(ratingsList, squadVacancy);

      criteria.os = [info.build.comprare && 1, info.build.comprange && 2].filter(Boolean);

      if (_.size(fillConfig)) {
        processFillConfig(fillConfig, criteria, Exclusionlist, playerlist);
      }
    }

    debug.log(playerlist);
    return playerlist;
  }

  getFastSbcSubText(j, helpers) {
    const { getInfo, localize } = helpers;
    const info = getInfo();
    const t = [];
    const i = info.league == 2 ? " " : "";

    _.map(j, (sj) => {
      let lt = `${escapeHtml(sj.c)}<span>×</span>`;
      if (_.has(sj.t, "rating")) {
        lt += `${escapeHtml(localize("squads.rating"))}${i}:${i}${escapeHtml(sj.t.rating)}`;
      } else {
        if (_.has(sj.t, "gs")) {
          lt += escapeHtml(localize(`item.raretype${sj.t.gs ? 1 : 0}`));
        }
        if (_.has(sj.t, "rs")) {
          lt += i + escapeHtml(localize(`search.cardLevels.cardLevel${sj.t.rs + 1}`));
        }
      }
      t.push(lt);
    });

    return t.join("、");
  }
}

export function registerSbcDataEvents(deps) {
  const {
    events,
    info,
    fy,
    futbinId,
    isPhone,
    cntlr,
    services,
    repositories
  } = deps;
  const service = new SbcDataService();
  const virtualChallengeAdapter = new SbcVirtualChallengeAdapter({
    getRuntime: () => ({
      UTSBCChallengeEntity:
        typeof UTSBCChallengeEntity === "undefined"
          ? undefined
          : UTSBCChallengeEntity,
      UTNullItemEntity:
        typeof UTNullItemEntity === "undefined" ? undefined : UTNullItemEntity,
      UTItemEntity:
        typeof UTItemEntity === "undefined" ? undefined : UTItemEntity,
      UTSquadEntity:
        typeof UTSquadEntity === "undefined" ? undefined : UTSquadEntity,
      UTSquadChemCalculatorUtils:
        typeof UTSquadChemCalculatorUtils === "undefined"
          ? undefined
          : UTSquadChemCalculatorUtils,
      generateSbcSquadOptions:
        typeof factories === "undefined"
          ? undefined
          : (...args) =>
              factories.Squad.generateSBCSquadConstructorOptions(...args),
      sbcFactory: services.SBC?.sbcDAO?.factory,
      squadDao: services.Squad?.squadDao,
      chemistryService: services.Chemistry,
      teamConfig: repositories.TeamConfig
    })
  });

  const helpers = {
    getInfo: () => info,
    externalRequest: (...args) => events.externalRequest(...args),
    notice: (...args) => events.notice(...args),
    hideLoader: (...args) => events.hideLoader(...args),
    fy,
    futbinId,
    getItemBy: (...args) => events.getItemBy(...args),
    ignorePlayerToCriteria: (...args) => events.ignorePlayerToCriteria(...args),
    debug: deps.debug,
    isPhone,
    getCurrentController: () => cntlr.current(),
    localize: (key) => services.Localization.localize(key)
  };

  events.getFutbinSbcSquad = (id, type) => service.getFutbinSbcSquad(id, type, helpers);
  events.createVirtualChallenge = (c) => {
    const result = virtualChallengeAdapter.create(c);
    if (!result.success) {
      deps.debug.log("Virtual SBC challenge unavailable", result.error);
      return null;
    }
    return result.data;
  };
  events.saveOldSquad = (s, t) => service.saveOldSquad(s, t, helpers);
  events.replaceOldSquadItem = (s, index, item) =>
    service.replaceOldSquadItem(s, index, item);
  events.getRatingPlayers = (squad, ratings) => service.getRatingPlayers(squad, ratings, helpers);
  events.getFastSbcSubText = (j) => service.getFastSbcSubText(j, helpers);
  events.adaptSbcSetsResponse = (response) => service.adaptSbcSetsResponse(response);
  events.adaptSbcChallengesResponse = (response) => service.adaptSbcChallengesResponse(response);
  events.adaptSbcChallengeSquadResponse = (response) => service.adaptSbcChallengeSquadResponse(response);
}
