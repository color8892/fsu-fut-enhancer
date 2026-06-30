const MAX_BATCH_SBC = 15;
const DAILY_SOFT_LIMIT = 90;

export class FastSbcPlannerService {
  getSafeUnassignedPool(repositories, info) {
    return repositories.Item.getUnassignedItems().filter((item) => {
      if (!item.isPlayer() || item.loans !== -1 || item.endTime !== -1) {
        return false;
      }
      if (!item.duplicateId || !item.untradeableCount) {
        return false;
      }
      if (item.isEnrolledInAcademy()) {
        return false;
      }
      if (info.lock.includes(item.id)) {
        return false;
      }
      if (item.isGoldRating() && item.rating > info.set.goldenrange) {
        return false;
      }
      return true;
    });
  }

  isPlayerSafe(player, helpers) {
    const { info, isPrecious, getCachePrice } = helpers;

    if (!player?.isPlayer?.()) {
      return false;
    }
    if (info.lock.includes(player.id)) {
      return false;
    }
    if (info.squad.includes(player.id)) {
      return false;
    }
    if (player.isGoldRating() && player.rating > info.set.goldenrange) {
      return false;
    }

    const price = getCachePrice(player.definitionId, 1).num;
    if (isPrecious(player.rating, player.rareflag, price, 0)) {
      return false;
    }

    return true;
  }

  getRequiredPlayerCount(oneFillNeed, helpers) {
    const { build, isEligibleForOneFill } = helpers;

    if (!build.strictlypcik && isEligibleForOneFill(oneFillNeed)) {
      return oneFillNeed[0].c + oneFillNeed[1].c;
    }

    return oneFillNeed.reduce((sum, entry) => sum + entry.c, 0);
  }

  resolveFillPlayers(oneFillNeed, playerPool, helpers) {
    const { getItemBy, ignorePlayerToCriteria, build, isEligibleForOneFill } = helpers;
    const required = this.getRequiredPlayerCount(oneFillNeed, helpers);
    let fillPlayers = [];

    if (!build.strictlypcik && isEligibleForOneFill(oneFillNeed)) {
      const criteriaNumber = oneFillNeed[0].c + oneFillNeed[1].c;
      let tempFillNeed = { rs: JSON.parse(JSON.stringify(oneFillNeed[0].t.rs)) };
      tempFillNeed = ignorePlayerToCriteria(tempFillNeed);
      tempFillNeed.lock = false;
      fillPlayers = getItemBy(2, tempFillNeed, false, playerPool).slice(0, criteriaNumber);
    } else {
      const excludeId = [];
      for (const entry of oneFillNeed) {
        let searchCriteria = JSON.parse(JSON.stringify(entry.t));
        searchCriteria = ignorePlayerToCriteria(searchCriteria);
        if (excludeId.length) {
          searchCriteria.NEdatabaseId = excludeId;
        }
        searchCriteria.lock = false;
        const searchResults = getItemBy(2, searchCriteria, false, playerPool).slice(0, entry.c);
        excludeId.push(...searchResults.map((player) => player.databaseId));
        fillPlayers = fillPlayers.concat(searchResults);
      }
    }

    fillPlayers = fillPlayers.filter((player) => this.isPlayerSafe(player, helpers));

    if (fillPlayers.length !== required) {
      return null;
    }

    return fillPlayers;
  }

  consumePlayersFromPool(playerPool, usedPlayers) {
    const usedIds = new Set(usedPlayers.map((player) => player.id));
    return playerPool.filter((player) => !usedIds.has(player.id));
  }

  planBatch(deps) {
    const { info, services, repositories, helpers } = deps;
    const entries = [];
    const skipped = [];
    let playerPool = this.getSafeUnassignedPool(repositories, info);
    const remainingBudget = Math.max(0, DAILY_SOFT_LIMIT - (info.SBCCount?.count ?? 0));

    for (const key of Object.keys(info.base.fastsbc)) {
      if (entries.length >= MAX_BATCH_SBC) {
        skipped.push({ key, reason: "batch_limit" });
        continue;
      }

      if (entries.length >= remainingBudget) {
        skipped.push({ key, reason: "daily_limit" });
        continue;
      }

      const oneFillNeed = info.base.fastsbc[key];
      if (!oneFillNeed || !Object.keys(oneFillNeed).length) {
        skipped.push({ key, reason: "no_config" });
        continue;
      }

      const [cId, sId] = key.split("#").map((part) => parseInt(part, 10));
      const set = services.SBC.repository.getSetById(sId);
      if (!set || set.isComplete() || set.challengesCount !== 1) {
        skipped.push({ key, reason: "set_unavailable" });
        continue;
      }

      const challenge = set.getChallenge(cId);
      if (challenge?.isCompleted?.()) {
        skipped.push({ key, reason: "already_done" });
        continue;
      }

      const fillPlayers = this.resolveFillPlayers(oneFillNeed, playerPool, helpers);
      if (!fillPlayers) {
        skipped.push({ key, reason: "unsafe_or_insufficient", name: set.name });
        continue;
      }

      entries.push({
        key,
        sId,
        cId,
        name: set.name,
        fillPlayers
      });
      playerPool = this.consumePlayersFromPool(playerPool, fillPlayers);
    }

    return {
      entries,
      skipped,
      maxBatch: MAX_BATCH_SBC,
      dailyBudget: remainingBudget
    };
  }
}

export { MAX_BATCH_SBC, DAILY_SOFT_LIMIT };