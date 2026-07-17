import {
  SBC_SAVE_ERROR_CODES,
  parseSbcLoadedSquad,
  parseSbcSaveResponse,
  sbcSaveFailure
} from "./SbcSaveResults.js";
import { EaObservableAdapter } from "../ea/EaObservableAdapter.js";

export class SbcSquadSaveService {
  constructor({ observableAdapter = new EaObservableAdapter() } = {}) {
    this.observableAdapter = observableAdapter;
    this.inFlight = new Map();
    this.activeTransactions = 0;
  }

  save(challenge, squad, players, helpers) {
    const challengeId = Number(challenge?.id);
    if (
      !Number.isInteger(challengeId) ||
      challengeId <= 0 ||
      !squad ||
      typeof squad.removeAllItems !== "function" ||
      typeof squad.setPlayers !== "function" ||
      typeof squad.getPlayers !== "function" ||
      !Array.isArray(players)
    ) {
      return Promise.resolve(
        this.preconditionFailure(helpers, [
          "challenge.id",
          "squad",
          "players"
        ])
      );
    }

    const key = String(challengeId);
    const existing = this.inFlight.get(key);
    if (existing) return existing;

    const transaction = this.runTransaction(
      challenge,
      squad,
      players,
      helpers
    ).finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, transaction);
    return transaction;
  }

  async runTransaction(challenge, squad, players, helpers) {
    const {
      setSaving,
      saveChallenge,
      loadChallengeData,
      notice,
      hideLoader,
      loadPlayerInfo,
      isPhone,
      getCurrentController,
      getActiveView,
      debug
    } = helpers;
    let originalPlayers;
    try {
      const originalSlots = squad.getPlayers();
      if (
        !Array.isArray(originalSlots) ||
        !originalSlots.every(
          (slot) => slot && typeof slot.getItem === "function"
        )
      ) {
        return this.preconditionFailure(helpers, ["squad.players"]);
      }
      originalPlayers = originalSlots.map((slot) => slot.getItem());
    } catch {
      return this.preconditionFailure(helpers, ["squad.players"]);
    }
    this.activeTransactions++;
    setSaving(true);

    try {
      squad.removeAllItems();
      squad.setPlayers(players, true);

      const saveObservable = saveChallenge(challenge);
      const observedSave = await this.observableAdapter.observeOnce(
        saveObservable,
        this,
        "sbc.save-challenge"
      );
      if (!observedSave.success) {
        return this.rollback(squad, originalPlayers, observedSave, notice);
      }
      const saveResult = parseSbcSaveResponse(observedSave.data);
      if (!saveResult.success) {
        return this.rollback(squad, originalPlayers, saveResult, notice);
      }

      const loadObservable = loadChallengeData(challenge);
      const observedLoad = await this.observableAdapter.observeOnce(
        loadObservable,
        this,
        "sbc.load-challenge"
      );
      if (!observedLoad.success) {
        return this.rollback(squad, originalPlayers, observedLoad, notice);
      }
      const loadResult = parseSbcLoadedSquad(observedLoad.data);
      if (!loadResult.success) {
        return this.rollback(squad, originalPlayers, loadResult, notice);
      }

      const { loadedSquad, players: loadedPlayers } = loadResult.data;
      challenge.squad.setPlayers(loadedPlayers, true);
      challenge.onDataChange.notify({ squad: loadedSquad });

      if (
        isPhone() &&
        getCurrentController().className ===
          "UTSBCSquadDetailPanelViewController"
      ) {
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
      loadPlayerInfo(loadedPlayers);
      return {
        success: true,
        data: { loadedSquad, players: loadedPlayers }
      };
    } catch {
      return this.rollback(
        squad,
        originalPlayers,
        sbcSaveFailure(
          SBC_SAVE_ERROR_CODES.INVALID_RESPONSE,
          "save",
          ["transaction.threw"]
        ),
        notice
      );
    } finally {
      this.activeTransactions = Math.max(0, this.activeTransactions - 1);
      setSaving(this.activeTransactions > 0);
      if (this.activeTransactions === 0) {
        hideLoader();
      }
      this.updateBulkBuyButton(squad);
    }
  }

  rollback(squad, originalPlayers, result, notice) {
    try {
      squad.removeAllItems();
      squad.setPlayers(originalPlayers, true);
    } catch {
      // Preserve the original failure result if EA rejects rollback.
    }
    notice("notice.templateerror", 2);
    return result;
  }

  preconditionFailure(helpers, issues) {
    const result = sbcSaveFailure(
      SBC_SAVE_ERROR_CODES.PRECONDITION,
      "precondition",
      issues
    );
    try {
      helpers.notice("notice.templateerror", 2);
      if (this.activeTransactions === 0) {
        helpers.setSaving(false);
        helpers.hideLoader();
      }
    } catch {
      // Precondition diagnostics must remain available if UI cleanup fails.
    }
    return result;
  }

  updateBulkBuyButton(squad) {
    if (!squad?._fsu?.bulkBuyBtn?.getRootElement()) return;
    if (squad.isDream()) {
      squad._fsu.bulkBuyBtn.show();
    } else {
      squad._fsu.bulkBuyBtn.hide();
    }
  }
}
