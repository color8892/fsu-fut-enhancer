export class SbcTemplateService {
  async loadTemplate(controller, type, sId, helpers) {
    const {
      showLoader,
      changeLoadingText,
      notice,
      getFutbinSbcSquad,
      getItemBy,
      ignorePlayerToCriteria,
      createVirtualChallenge,
      saveSquad,
      saveOldSquad,
      isTemplateRunning,
      setTemplateRunning,
      getGoldenRange,
      getFormationMap,
      debug,
      isPhone,
      navigateBack
    } = helpers;

    controller.setInteractionState(0);
    const squadPos = controller.challenge.squad
      .getFieldPlayers()
      .map((slot) => (slot.isBrick() ? null : slot.getGeneralPosition()));

    showLoader();
    changeLoadingText("loadingclose.template1");
    setTemplateRunning(true);
    notice("notice.templateload", 1);

    const fsu =
      _.get(controller, "challenge.squad._fsu") ||
      _.set(controller, "challenge.squad._fsu", {});

    let planCount = 0;
    let resultSquad = [];
    let resultCount = 0;
    let resultValue = 0;
    let resultId = 0;
    const refePlan = [];

    if (type == 1) {
      let list = await getFutbinSbcSquad(controller.challenge.id, type);
      list = _.filter(list, (item) => item.likes >= 0);

      if (list && list.length == 0) {
        return;
      }

      if (fsu && fsu.templatePlan) {
        list = _.reject(list, (item) => _.includes(fsu.templatePlan, item.id));
      }

      refePlan.push(...list.slice(0, 5).map((item) => item.id));
    } else {
      refePlan.push(sId);
    }

    for (const planId of refePlan) {
      planCount++;
      changeLoadingText([
        "loadingclose.template2",
        `${planCount}`,
        `${refePlan.length - planCount}`
      ]);

      if (!isTemplateRunning()) return;

      const planSquad = await getFutbinSbcSquad(planId, type == 1 ? 2 : type);
      if (!planSquad) continue;

      let ownedPlayer = 0;
      let surplusValue = 0;
      const createSquad = new Array(11);
      const copySquadPos = JSON.parse(
        JSON.stringify(controller.challenge.squad.getFormation().generalPositions)
      );
      const formationMap = getFormationMap();

      for (let i = 0; i < createSquad.length; i++) {
        let posIndex = i;

        if (type !== 3) {
          if (_.has(formationMap, planSquad.Formation)) {
            posIndex = copySquadPos.lastIndexOf(formationMap[planSquad.Formation][i]);
            copySquadPos[posIndex] = null;
          }
        }

        if (type == 3) {
          if (
            "data" in planSquad &&
            "activeGroupPositions" in planSquad.data &&
            i in planSquad.data.activeGroupPositions
          ) {
            let player = new UTItemEntity();
            player.definitionId = planSquad.data.activeGroupPositions[i].playerEaId;
            player.stackCount = 1;
            const cachePlayer = getItemBy(2, { definitionId: player.definitionId })[0];

            if (cachePlayer) {
              player.id = cachePlayer.id;
              player.concept = false;
            } else {
              player.id = player.definitionId;
              player.concept = true;
            }

            createSquad[posIndex] = player;
          } else {
            createSquad[posIndex] = null;
          }
        } else {
          const planIndex = `cardlid${11 - i}`;
          const basicCriteria = ignorePlayerToCriteria({});

          if (squadPos[posIndex] !== null) {
            if (planIndex in planSquad) {
              let player = new UTItemEntity();
              const planPlayer = planSquad[planIndex];
              player.definitionId = planPlayer.Player_Resource;
              player.stackCount = 1;
              const cachePlayer = _.find(
                getItemBy(2, { ...basicCriteria, definitionId: player.definitionId })
              );

              if (cachePlayer) {
                player = cachePlayer;
                ownedPlayer++;
              } else {
                const basePos = _.map(planPlayer.alternativePositions, (pos) => PlayerPosition[pos]);
                const preferredPos = PlayerPosition[planPlayer.org_pos];
                basePos.push(preferredPos);
                player.id = planPlayer.Player_Resource;
                player.concept = true;
                surplusValue += planPlayer.price;
                player._rating = planPlayer.rating;
                player.teamId = planPlayer.club;
                player.leagueId = planPlayer.league;
                player.nationId = planPlayer.nation;
                player.preferredPosition = preferredPos;
                player.basePossiblePositions = basePos;
                player._rareflag = planPlayer.raretype;

                if (planPlayer.raretype !== 0) {
                  player.groups.push(4);
                }
              }

              createSquad[posIndex] = player;
            } else {
              createSquad[posIndex] = null;
            }
          } else {
            createSquad[posIndex] = null;
          }
        }
      }

      if (
        resultSquad.length == 0 ||
        surplusValue < resultValue ||
        (surplusValue == resultValue && ownedPlayer > resultCount)
      ) {
        resultSquad = createSquad;
        resultCount = ownedPlayer;
        resultValue = surplusValue;
        resultId = planId;
      }
    }

    debug.log(
      `最终结果：阵容：`,
      resultSquad,
      `拥有球员：`,
      resultCount,
      `剩余需花费：`,
      resultValue,
      `阵容id:`,
      resultId
    );

    if (!isTemplateRunning()) return;

    const conceptIndexes = _.flatMap(resultSquad, (player, index) => (player?.concept ? [index] : []));
    const excludeDefIds = _.map(resultSquad, "databaseId");

    if (conceptIndexes.length) {
      debug.log("开始尝试替换假想球员！");
      let tempSquad = _.map(resultSquad, (player) => (player ? player : new UTItemEntity()));
      const newChallenge = createVirtualChallenge(controller.challenge);
      newChallenge.squad.setPlayers(tempSquad);

      const sortedConceptIndexes = _.sortBy(
        conceptIndexes,
        (index) => newChallenge.squad.getPlayer(index)._chemistry
      );

      for (const index of sortedConceptIndexes) {
        if (!isTemplateRunning()) break;

        await new Promise((resolve) => setTimeout(resolve, 0));

        const copySquad = _.map(tempSquad, (player) => player);
        const conceptPlayer = copySquad[index];
        const searchMaxRating = Math.min(conceptPlayer.rating + 10, getGoldenRange());
        let searchCriteria = { NEdatabaseId: excludeDefIds, LTrating: searchMaxRating, lock: false };
        searchCriteria = ignorePlayerToCriteria(searchCriteria);
        const indexPos = newChallenge.squad.getPlayer(index).generalPosition;

        changeLoadingText([
          "loadingclose.template3",
          _.indexOf(sortedConceptIndexes, index) + 1,
          sortedConceptIndexes.length,
          PlayerPosition[indexPos]
        ]);

        const searchResultsList = _.orderBy(
          getItemBy(2, searchCriteria),
          [
            (item) => item.basePossiblePositions.includes(indexPos),
            (item) => item.rating,
            (item) => item.teamId === conceptPlayer.teamId,
            (item) => item.nationId === conceptPlayer.nationId,
            (item) => item.leagueId === conceptPlayer.leagueId
          ],
          ["desc", "asc", "desc", "desc", "desc"]
        );

        const satisfyPlayers = [];

        for (const fillPlayer of searchResultsList) {
          copySquad[index] = fillPlayer;
          newChallenge.squad.setPlayers(copySquad);

          if (newChallenge.meetsRequirements()) {
            satisfyPlayers.push({
              player: fillPlayer,
              playerChemistry: newChallenge.squad.getPlayer(index)._chemistry,
              squadChemistry: newChallenge.squad._chemistry,
              rating: fillPlayer.rating
            });
          }
        }

        if (satisfyPlayers.length) {
          const firstCandidate = _.first(
            _.orderBy(
              satisfyPlayers,
              [
                (item) => item.squadChemistry,
                (item) => item.playerChemistry,
                (item) => item.player.rating
              ],
              ["desc", "desc", "asc"]
            )
          );
          debug.log(`${PlayerPosition[indexPos]}第一候选者`, firstCandidate);
          tempSquad[index] = firstCandidate.player;
        }
      }

      debug.log(`最终阵容`, tempSquad);
      resultSquad = tempSquad;
    }

    if (!isTemplateRunning()) return;

    await saveSquad(controller.challenge, controller.challenge.squad, resultSquad);
    saveOldSquad(controller.challenge.squad, false);
    fsu.templatePlan ??= [];
    fsu.templatePlan.push(resultId);

    if (isPhone()) {
      navigateBack();
    }
  }
}