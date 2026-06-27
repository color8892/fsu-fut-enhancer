export class PlayerSearchService {
  search(type, queryOptions, insertData, replaceData, helpers) {
    const {
      getClubPlayers,
      getStorageItems,
      getInfo,
      debug,
      repositories,
      services
    } = helpers;
    const info = getInfo();

    let players = replaceData ? replaceData : _.concat(getClubPlayers(), getStorageItems()),
      ratingOrder = queryOptions.hasOwnProperty("LTrating") ? "desc" : "asc",
      specialOrder = [],
      firstStorage = 0,
      currentSquad;
    if (queryOptions.hasOwnProperty("os") && _.isArray(queryOptions.os)) {
      specialOrder = queryOptions.os;
      delete queryOptions.os;
      //24.18 阵容挑选优先：1、优先非特殊球员，2、黄金范围优先非稀有
    }
    if (!("unlimited" in queryOptions) || ("unlimited" in queryOptions && !queryOptions.unlimited)) {
      players = players.filter(i => { return i.isPlayer() && i.loans === -1 && !i.isEnrolledInAcademy() && i.endTime == -1 });
    } else {
      players = players.filter(i => { return i.isPlayer(); });
    }
    delete queryOptions.unlimited;


    if (_.has(queryOptions, "firststorage")) {
      firstStorage = queryOptions.firststorage ? 1 : 2;
      delete queryOptions.firststorage;
    }

    //移除阵容生成阵容
    //25.22 修复取当前阵容的方式，避免填充球员无法计算出。
    if (_.has(queryOptions, "removeSquad")) {
      let tempSquad = repositories.Squad.squads.get(services.User.getUser().selectedPersona);
      if (tempSquad) {
        info.squad = _.map(tempSquad.get(services.Squad.activeSquad).getPlayers(), "item.id");
      }
    }

    for (let [k, v] of Object.entries(queryOptions)) {
      players = players.filter(i => {
        switch (k) {
          case "rs":
            switch (v) {
              case 0:
                return i.rating >= 0 && i.rating <= 64 && (!i.isSpecial() || i.leagueId == 1003 || i.leagueId == 1014);
              case 1:
                return i.rating >= 65 && i.rating <= 74 && (!i.isSpecial() || i.leagueId == 1003 || i.leagueId == 1014);
              case 2:
                return i.rating >= 75 && i.rating <= info.set.goldenrange && (!i.isSpecial() || i.leagueId == 1003 || i.leagueId == 1014);
              case 9:
                return !i.isSpecial() || i.leagueId == 1003 || i.leagueId == 1014;
              default:
                return i.rating >= 0 && i.rating <= 99;
            }
          case "gs":
            return i.groups.includes(4) === v;
          case "levelId":
            switch (v) {
              case 3:
                return i.isSpecial();
              case 0:
                return i.isBronzeRating() && !i.isSpecial();
              case 1:
                return i.isSilverRating() && !i.isSpecial();
              case 2:
                return i.isGoldRating() && !i.isSpecial();
            }
          case "BTWrating":
            if (v[0] > v[1]) {
              ratingOrder = "desc";
              return i.rating >= v[1] && i.rating <= v[0];
            } else {
              return i.rating >= v[0] && i.rating <= v[1];
            }
          case "bepos":
            return i.basePossiblePositions.includes(v);
          case "includePos":
            return Array.isArray(v) ? v.some(x => i.possiblePositions.includes(x)) : i.possiblePositions.includes(v);
          case "excludePos":
            return Array.isArray(v) ? !v.some(x => i.possiblePositions.includes(x)) : !i.possiblePositions.includes(v);
          case "maxNumPos":
            return i.possiblePositions.length <= Array.isArray(v) ? v[0] : v;
          case "maxNumBasicPlayStyles":
            return i.getNumBasicPlayStyles() <= Array.isArray(v) ? v[0] : v;
          case "maxNumPlusPlayStyles":
            return i.getNumPlusPlayStyles() <= Array.isArray(v) ? v[0] : v;
          case "lock":
            if (v) {
              return info.lock.includes(i.id);
            } else {
              return !info.lock.includes(i.id);
            }
          case "quality":
            switch (v) {
              case "=1" && "<=1":
                return i.isBronzeRating();
              case "=2":
                return i.isSilverRating();
              case "=3" && ">=3":
                return i.isGoldRating();
              case ">=1" && "<=3":
                return true;
              case ">=2":
                return i.isSilverRating() || i.isGoldRating();
              case "<=2":
                return i.isSilverRating() || i.isBronzeRating();
              default:
                return true;
            }
          case "removeSquad":
            return !_.includes(info.squad, i.id);
          default:
            if (/NE/.test(k)) {
              let rk = k.replace(/NE/, '');
              return _.isArray(v) ? !v.includes(i[rk]) : i[rk] !== v;
            } else if (/GT/.test(k)) {
              let rk = k.replace(/GT/, '');
              return _.isArray(v) ? i[rk] >= Math.max(...v) : i[rk] >= v;
            } else if (/LT/.test(k)) {
              let rk = k.replace(/LT/, '');
              return _.isArray(v) ? i[rk] <= Math.min(...v) : i[rk] <= v;
            } else {
              if (_.isArray(i[k])) {
                return _.isArray(v) ? _.intersection(i[k], v).length === v.length : _.includes(i[k], v);
              } else {
                return _.isArray(v) ? v.includes(i[k]) : i[k] === v;
              }
            }
        }
      });
    }

    const isMixBronzeAndSilver = info.build.sbfirstcommon && _.isEqual(queryOptions.rareflag, [0, 1]) &&
      (queryOptions.rs == 0 || queryOptions.rs == 1);

    const sortField = isMixBronzeAndSilver
      ? ["rareflag", "rating", "pile", "untradeableCount", "_itemPriceLimits.minimum", "_itemPriceLimits.maximum"]
      : ["rating", "pile", "untradeableCount", "rareflag", "_itemPriceLimits.minimum", "_itemPriceLimits.maximum"];

    const sortOrder = isMixBronzeAndSilver
      ? ["asc", ratingOrder, "desc", "desc", "asc", "asc"]
      : [ratingOrder, "desc", "desc", "asc", "asc", "asc"];

    players = _.orderBy(players, sortField, sortOrder);

    if (specialOrder.length && players.length) {
      if (_.includes(specialOrder, 1)) {
        let tempPlayers = _.values(_.groupBy(players, "rating")), resultPlayers = [];
        if (ratingOrder == "desc") {
          tempPlayers = _.reverse(tempPlayers);
        }
        _.forEach(tempPlayers, i => {
          let tempResult = [], special = [], normal = [];
          _.forEach(i, si => {
            if (!si.isSpecial() || si.leagueId == 1003 || si.leagueId == 1014) {
              normal.push(si);
            } else {
              special.push(si);
            }
          });
          tempResult = _.concat(normal, special);
          resultPlayers = _.concat(resultPlayers, tempResult);
        });
        players = resultPlayers;
      }
      if (_.includes(specialOrder, 2)) {
        function customSort(a, b) {
          const rareFlagsOrder = { 1: 0, 53: 1, 52: 2 };
          const rareFlagA = rareFlagsOrder[a?.rareflag] !== undefined ? rareFlagsOrder[a.rareflag] : Number.MAX_SAFE_INTEGER;
          const rareFlagB = rareFlagsOrder[b?.rareflag] !== undefined ? rareFlagsOrder[b.rareflag] : Number.MAX_SAFE_INTEGER;
          if (rareFlagA === rareFlagB) {
            return 0;
          }
          return rareFlagA - rareFlagB;
        }
        let tempPlayers = _.values(_.groupBy(players, "rating")), resultPlayers = [];
        if (ratingOrder == "desc") {
          tempPlayers = _.reverse(tempPlayers);
        }
        _.forEach(tempPlayers, i => {
          let tempResult = [];
          if (i[0].rating >= 75 && i[0].rating <= info.set.goldenrange) {
            tempResult = _.sortBy(i, customSort);
            if (!_.includes(specialOrder, 1)) {
              tempResult = _.orderBy(tempResult, "untradeableCount", "desc");
            }
          } else {
            tempResult = i;
          }
          resultPlayers = _.concat(resultPlayers, tempResult);
        });
        players = resultPlayers;
      }
    }


    if (firstStorage == 1) {
      players = _.orderBy(players, [
        (player) => {
          //25.23 增加一个保护措施，超过5评分以内的仓库球员也不会被强制移动到前方。
          //如果你要修改就修改下面的5
          const inStorage = repositories.Item.storage.get(player.id);
          if (!inStorage) return 1;

          //26.08 修复一键填充仓库不优先的问题
          if (queryOptions && queryOptions.GTrating != null && queryOptions.GTrating !== 0) {
            return player.rating <= queryOptions.GTrating + 5 ? 0 : 1;
          }
          return 0;
        }
      ], ["asc"]);
    }

    if (insertData && !replaceData) {
      debug.log("查询球员时有插入数据");
      let insertPlayerIds = _.map(_.filter(insertData, i => {
        return !i.isLimitedUse() && i.isPlayer() && i.isDuplicate();
      }), "duplicateId");
      players = _.orderBy(players, [
        (player) => {
          return _.includes(insertPlayerIds, player.id) ? 0 : 1;
        }
      ], ["asc"]);
    }

    if (firstStorage !== 0) {
      //25.09 调换顺序 移除重复的球员
      //25.23 调整为基础ID而不是球员ID
      players = _.uniqBy(players, 'databaseId');
    }


    if (type == 1) {
      return players.map(member => member.definitionId);
    } else if (type == 2) {
      return players;
    }
  }
}