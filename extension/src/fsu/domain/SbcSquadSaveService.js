export class SbcSquadSaveService {
  async save(challenge, squad, players, helpers) {
    const {
      setSaving,
      isSaving,
      saveChallenge,
      loadChallengeData,
      notice,
      hideLoader,
      loadPlayerInfo,
      isPhone,
      getCurrentController,
      navigateBackOnPhone,
      getActiveView,
      debug
    } = helpers;

    setSaving(true);
    squad.removeAllItems();
    squad.setPlayers(players, true);

    await saveChallenge(challenge).observe(
      this,
      async function (observer, response) {
        if (!response.success) {
          notice("notice.templateerror", 2);
          squad.removeAllItems();
          setSaving(false);
          hideLoader();
          return;
        }

        loadChallengeData(challenge).observe(
          this,
          async function (loadObserver, { response: { squad: loadedSquad } }) {
            hideLoader();
            const squadPlayers = loadedSquad._players.map((slot) => slot._item);
            challenge.squad.setPlayers(squadPlayers, true);
            challenge.onDataChange.notify({ squad: loadedSquad });
            setSaving(false);

            if (isPhone() && getCurrentController().className == "UTSBCSquadDetailPanelViewController") {
              setTimeout(() => {
                getCurrentController().parentViewController._eBackButtonTapped();
              }, 500);
            }

            notice("notice.templatesuccess", 0);
            const view = getActiveView();

            if (view) {
              debug.log(view.getView()._interactionState);
              if (!view.getView()._interactionState) {
                view.getView().setInteractionState(true);
              }
            }

            loadPlayerInfo(squadPlayers);
          }
        );
      }
    );

    if (squad?._fsu?.bulkBuyBtn?.getRootElement()) {
      if (squad.isDream()) {
        squad._fsu.bulkBuyBtn.show();
      } else {
        squad._fsu.bulkBuyBtn.hide();
      }
    }
  }
}