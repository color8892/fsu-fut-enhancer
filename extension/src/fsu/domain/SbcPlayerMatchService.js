/**
 * Service for finding eligible players that satisfy SBC challenge requirements.
 */
export class SbcPlayerMatchService {
  /**
   * @param {any} controller
   * @param {any} helpers
   * @returns {any[]}
   */
  findMeetsPlayers(controller, helpers) {
    const {
      calculateChemistry,
      getChemistryPlayers,
      getItemBy,
      createVirtualChallenge
    } = helpers;

    const targetChemistry = controller.squad._fsu?.hasChemistry;
    const index = controller.viewmodel.current().index;
    const playerRating = controller.viewmodel.current().item.rating;
    const excludeList = controller.squad
      .getPlayers()
      .map((/** @type {any} */ slot) => slot.getItem().definitionId)
      .filter(Boolean);
    const position = controller.viewmodel.current().position.typeId;
    const searchCriteriaList = [];
    /** @type {Record<string, any>} */
    const baseCriteria = {
      BTWrating: [playerRating - 10, playerRating + 10],
      NEdatabaseId: excludeList
    };

    if (targetChemistry) {
      const players = (controller.squad.getFieldPlayers() || []).map((/** @type {any} */ slot) =>
        slot.inPossiblePosition
          ? slot.item
          : { teamId: -1, leagueId: -1, nationId: -1 }
      );
      const chemistry = calculateChemistry(players, index);

      if (chemistry.totalChemistry < targetChemistry) {
        baseCriteria.possiblePositions = position;
        const chemistryCriteria = getChemistryPlayers(controller, targetChemistry);

        if (chemistryCriteria.length > 0) {
          searchCriteriaList.push(
            ...chemistryCriteria.map((/** @type {any} */ criteria) => ({ ...criteria, ...baseCriteria }))
          );
        } else {
          searchCriteriaList.push(baseCriteria);
        }
      } else {
        searchCriteriaList.push(baseCriteria);
      }
    } else if (controller.squad._fsuHasRating) {
      baseCriteria.BTWrating = [playerRating - 5, playerRating + 5];
      searchCriteriaList.push(baseCriteria);
    } else {
      searchCriteriaList.push(baseCriteria);
    }

    const flatResults = searchCriteriaList.flatMap((criteria) => getItemBy(2, criteria) || []);
    const seenIds = new Set();
    const result = flatResults.filter((player) => {
      if (!player || !player.id || seenIds.has(player.id)) return false;
      seenIds.add(player.id);
      return true;
    });

    const newChallenge = createVirtualChallenge(controller.challenge);
    if (!newChallenge) return [];
    const currentList = newChallenge.squad.getPlayers().map((/** @type {any} */ slot) => slot.getItem());
    const resultList = [];

    for (const player of result) {
      currentList[index] = player;
      newChallenge.squad.setPlayers(currentList);
      if (newChallenge.meetsRequirements()) {
        resultList.push(player);
      }
    }

    return resultList;
  }
}

