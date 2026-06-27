export class SbcDataService {
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
      const data = JSON.parse(futBinResponse)[type == 2 ? "squad_data" : "data"];
      if (data) {
        if (type == 2) {
          _.map(data, (i, k) => {
            if (_.includes(k, "cardlid")) {
              futbinId.set(i.Player_Resource, i.id);
              futbinId.setPrice(i, i.Player_Resource);
            }
          });
        }
        return data;
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

  createVirtualChallenge(c) {
    const challengeInfo = {
      assetId: "virtual",
      description: "virtual",
      eligibilityOperation: c.eligibilityOperation,
      endTime: c.endTime,
      formation: c.squad.getFormation().name,
      id: 888888,
      name: "virtual",
      priority: c.priority,
      repeatable: c.repeatable,
      requirements: c.eligibilityRequirements,
      rewards: [],
      setId: 888888,
      status: c.status,
      timesCompleted: c.timesCompleted,
      type: c.type
    };
    const newChallenge = new UTSBCChallengeEntity(challengeInfo);
    const squadInfo = {
      chemistry: 0,
      id: 888888,
      formation: c.squad.getFormation().name,
      manager: [new UTNullItemEntity()],
      players: [],
      rating: 0
    };

    for (let i = 0; i < 23; i++) {
      squadInfo.players.push({
        index: i,
        itemData: new UTItemEntity()
      });
    }

    let brickIndices = undefined;
    if (c.squad.simpleBrickIndices.length) {
      brickIndices = [];
      for (let i = 0; i < 11; i++) {
        brickIndices.push({
          index: i,
          playerType: c.squad.simpleBrickIndices.includes(i) ? "BRICK" : "DEFAULT"
        });
      }
    }

    const newSquad = new UTSquadEntity(
      factories.Squad.generateSBCSquadConstructorOptions(
        squadInfo,
        services.SBC.sbcDAO.factory,
        brickIndices
      ),
      services.Squad.squadDao,
      new UTSquadChemCalculatorUtils(services.Chemistry, repositories.TeamConfig)
    );
    newSquad.setPlayers(
      c.squad.getPlayers().map((i) => i.getItem()),
      true
    );
    newChallenge.squad = newSquad;
    return newChallenge;
  }

  saveOldSquad(s, t, helpers) {
    const { getInfo, isPhone, getCurrentController } = helpers;
    const info = getInfo();

    if (s.isSBC() && (!info.base.savesquad || !t)) {
      const fsu = (s._fsu ??= {});
      fsu.oldSquad ??= [];
      fsu.oldSquadCount ??= -1;
      const pl = s.getPlayers().map((i) => i.getItem());
      if (
        fsu.oldSquadCount == -1 ||
        fsu.oldSquad[fsu.oldSquadCount].map((i) => i.id).join() !==
          pl.map((i) => i.id).join()
      ) {
        fsu.oldSquadCount++;
        fsu.oldSquad.push(pl);
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
      let completeRatingsList = [];

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

      if (ratingsList.length === 1) {
        completeRatingsList = _.fill(Array(squadVacancy.length), ratingsList[0]);
      } else {
        completeRatingsList = ratingsList;
      }

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
      let lt = `${sj.c}<span>×</span>`;
      if (_.has(sj.t, "rating")) {
        lt += `${localize("squads.rating")}${i}:${i}${sj.t.rating}`;
      } else {
        if (_.has(sj.t, "gs")) {
          lt += localize(`item.raretype${sj.t.gs ? 1 : 0}`);
        }
        if (_.has(sj.t, "rs")) {
          lt += i + localize(`search.cardLevels.cardLevel${sj.t.rs + 1}`);
        }
      }
      t.push(lt);
    });

    return t.join("、");
  }
}

export function registerSbcDataEvents(deps) {
  const { events, info, fy, futbinId, isPhone, cntlr, services } = deps;
  const service = new SbcDataService();

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
  events.createVirtualChallenge = (c) => service.createVirtualChallenge(c);
  events.saveOldSquad = (s, t) => service.saveOldSquad(s, t, helpers);
  events.getRatingPlayers = (squad, ratings) => service.getRatingPlayers(squad, ratings, helpers);
  events.getFastSbcSubText = (j) => service.getFastSbcSubText(j, helpers);
}