export class SbcSquadFillService {
  fillFromPlayerList(challenge, list, type, helpers) {
    const { showLoader, getFormation, ignorePosition, loadPlayerInfo, saveSquad, saveOldSquad } = helpers;

    showLoader();

    const substitute = Array.from(list);
    const squadFormation = getFormation(challenge.formation);
    const squadBuild = new UTSquadBuilderViewModel();
    const squadBestPos = squadFormation.generalPositions.concat(Array(12).fill(-1));

    const playerlist = squadBestPos.map((position, slotIndex) => {
      const slot = challenge.squad ? challenge.squad.getSlot(slotIndex) : null;

      if (!slot || slot.isBrick()) {
        if (substitute.length && substitute[0].rating == 0) {
          substitute.shift();
        }
        return null;
      }

      if (ignorePosition || position == -1 || type == 2) {
        return substitute.shift();
      }

      if (!substitute.length) {
        return null;
      }

      if (substitute[0].basePossiblePositions.includes(position)) {
        return substitute.shift();
      }

      const baseFitIndex = squadBuild.findBestFitByPosition(position, substitute);
      return baseFitIndex == -1 ? null : substitute.splice(baseFitIndex, 1)[0];
    });

    loadPlayerInfo(playerlist);
    saveSquad(challenge, challenge.squad, playerlist, []);
    saveOldSquad(challenge.squad, false);
  }
}