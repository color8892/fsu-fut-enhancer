export class SbcPlayerMatchService {
  findMeetsPlayers(controller, helpers) {
    const {
      calculateChemistry,
      getChemistryPlayers,
      getItemBy,
      createVirtualChallenge
    } = helpers;

    const targetChemistry = controller.squad._fsu.hasChemistry;
    const index = controller.viewmodel.current().index;
    const playerRating = controller.viewmodel.current().item.rating;
    const excludeList = controller.squad
      .getPlayers()
      .map((slot) => slot.getItem().definitionId)
      .filter(Boolean);
    const position = controller.viewmodel.current().position.typeId;
    const searchCriteriaList = [];
    const baseCriteria = {
      BTWrating: [playerRating - 10, playerRating + 10],
      NEdatabaseId: excludeList
    };

    if (targetChemistry) {
      const players = _.map(controller.squad.getFieldPlayers(), (slot) =>
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
            ...chemistryCriteria.map((criteria) => ({ ...criteria, ...baseCriteria }))
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

    let result = _.flatMap(searchCriteriaList, (criteria) => getItemBy(2, criteria));
    result = _.uniqBy(result, "id");

    const newChallenge = createVirtualChallenge(controller.challenge);
    const currentList = newChallenge.squad.getPlayers().map((slot) => slot.getItem());
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