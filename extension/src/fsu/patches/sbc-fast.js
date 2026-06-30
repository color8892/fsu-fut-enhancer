import { DAILY_SOFT_LIMIT } from "../domain/FastSbcPlannerService.js";

function createFastSbcHelpers(deps) {
  const { events, info } = deps;
  return {
    info,
    getItemBy: (...args) => events.getItemBy(...args),
    ignorePlayerToCriteria: (...args) => events.ignorePlayerToCriteria(...args),
    isEligibleForOneFill: (...args) => events.isEligibleForOneFill(...args),
    isPrecious: (...args) => events.isPrecious(...args),
    getCachePrice: (...args) => events.getCachePrice(...args),
    build: info.build
  };
}

function runFastSbcSubmit(deps, controller, challenge, SBCSetEntity, fillPlayers, onDone) {
  const { events, services } = deps;

  events.playerListFillSquad(challenge, fillPlayers, 1);

  if (!challenge.canSubmit()) {
    utils.PopupManager.showAlert(utils.PopupManager.Alerts.SBC_INELIGIBLE_SQUAD);
    onDone?.({ success: false, errorCode: 3 });
    return;
  }

  if (
    !services.Configuration.getFeatureSetting(UTServerSettingsRepository.KEY.SBC_ALLOW_UNTRADEABLE) &&
    challenge.hasUntradeableItems()
  ) {
    utils.PopupManager.showAlert(utils.PopupManager.Alerts.SBC_UNTRADEABLE_NOT_ALLOWED);
    onDone?.({ success: false, errorCode: 3 });
    return;
  }

  if (!JSUtils.isValid(SBCSetEntity)) {
    onDone?.({ success: false, errorCode: 1 });
    return;
  }

  TelemetryManager.trackEvent(
    TelemetryManager.Sections.SBC,
    TelemetryManager.Categories.BUTTON_PRESS,
    "SBC - Submit Challenge"
  );

  const skipValidation = services.UserSettings.getSBCValidationSkip();
  services.SBC.submitChallenge(
    challenge,
    SBCSetEntity,
    skipValidation,
    services.Chemistry.isFeatureEnabled()
  ).observe(controller, (observer, response) => {
    observer.unobserve(controller);
    const newChallenge = SBCSetEntity.getChallenge(challenge.id);

    if (response.success && newChallenge) {
      if (newChallenge.awards.length > 0) {
        const challengeRewards = new UTGameRewardsViewController(newChallenge.awards);
        challengeRewards.init();
        challengeRewards.modalDisplayDimensions.width = "24em";
        challengeRewards.getView().setSbcChallenge(newChallenge);
        gPopupClickShield.setActivePopup(challengeRewards);
        challengeRewards.onExit.observe(controller, (exitObserver) => {
          exitObserver.unobserve(controller);
          events.showRewardsView(SBCSetEntity);
        });
      } else if (response.data?.setCompleted) {
        events.showRewardsView(SBCSetEntity);
      }

      services.PIN.sendData(PINEventType.PAGE_VIEW, {
        type: PIN_PAGEVIEW_EVT_TYPE,
        pgid: "SBC - Rewards Overlay"
      });

      if (_.includes(controller.className, "UTUnassignedItems") && controller._fsuRefreshBtn) {
        controller._fsuRefreshBtn._tapDetected();
      }
      if (_.includes(controller.className, "UTSBCSquad")) {
        controller.getNavigationController().popViewController();
      }
      if (_.includes(controller.className, "UTSBCHub")) {
        if (controller.getView()._interactionState === false) {
          controller.getView().setInteractionState(true);
        }
        controller._requestSBCData();
      }
      if (_.includes(controller.className, "UTSBCChallenges")) {
        controller.getView().setSBCSet(controller.sbcViewModel.sbcSet);
        events.sbcSubPrice(controller.sbcViewModel.sbcSet.id, controller.getView());
      }

      events.SBCListInsertToFront(SBCSetEntity.id, 1);
      events.notice("fastsbc.success", 0);
      onDone?.({ success: true });
      return;
    }

    if (response.status == 521) {
      events.notice("fastsbc.error_5", 2);
      onDone?.({ success: false, errorCode: 5, fatal: true });
      return;
    }

    services.Notification.queue([
      services.Localization.localize("notification.sbcChallenges.failedToSubmit"),
      UINotificationType.NEGATIVE
    ]);
    onDone?.({ success: false, errorCode: 1 });
  });
}

export function registerFastSbcEvents(deps) {
  const {
    events,
    cntlr,
    info,
    debug,
    repositories,
    services,
    fy,
    fastSbcPlannerService
  } = deps;

  const plannerHelpers = () => createFastSbcHelpers(deps);

  events.isSBCCache = (id, cId, onDone, fillPlayers) => {
    const SBCSetEntity = services.SBC.repository.getSetById(id);
    if (SBCSetEntity) {
      events.fastSBC(id, cId, { onDone, fillPlayers });
      return;
    }

    debug.log("执行任务的是否发现没有SBC数据！");
    services.SBC.requestSets().observe(cntlr.current(), function (observer, response) {
      observer.unobserve(cntlr.current());
      if (response.success && JSUtils.isObject(response.data)) {
        events.fastSBC(id, cId, { onDone, fillPlayers });
      } else {
        const errorCode = response.error ? response.error.code : response.status;
        if (NetworkErrorManager.checkCriticalStatus(errorCode)) {
          NetworkErrorManager.handleStatus(errorCode);
        } else if (errorCode === UtasErrorCode.SERVICE_IS_DISABLED) {
          services.Configuration.setFeatureEnabled(UTServerSettingsRepository.KEY.SBC_ENABLED, false);
        }
        onDone?.({ success: false, errorCode: 1 });
      }
    });
  };

  events.fastSBC = async (id, cId, options = {}) => {
    const controller = events.getCurrent();
    const view = controller.getView();
    const SBCSetEntity = services.SBC.repository.getSetById(id);
    const helpers = plannerHelpers();

    events.showLoader();
    view.setInteractionState(false);

    services.SBC.requestChallengesForSet(SBCSetEntity).observe(controller, (observer, response) => {
      observer.unobserve(controller);

      if (!(response.success && response.data.challenges.length > 0)) {
        if (NetworkErrorManager.checkCriticalStatus(response.status)) {
          NetworkErrorManager.handleStatus(response.status);
        } else {
          const messageKey =
            response.error?.code === UtasErrorCode.SERVICE_IS_DISABLED
              ? "sbc.notification.disabled"
              : "notification.sbcChallenges.failedToLoad";
          services.Notification.queue([
            services.Localization.localize(messageKey),
            UINotificationType.NEGATIVE
          ]);
        }
        events.hideLoader();
        view.setInteractionState(true);
        options.onDone?.({ success: false, errorCode: 1 });
        return;
      }

      const challenge = response.data.challenges.find((entry) => entry.id === cId);
      services.SBC.loadChallenge(challenge).observe(controller, (loadObserver, loadResponse) => {
        loadObserver.unobserve(controller);

        if (!loadResponse.success) {
          let errorCode = 1;
          if (
            !SBCSetEntity.isComplete() &&
            SBCSetEntity.challengesCount > 1 &&
            challenge.isCompleted()
          ) {
            errorCode = 2;
          }
          events.notice(`fastsbc.error_${errorCode}`, 2);
          events.hideLoader();
          view.setInteractionState(true);
          options.onDone?.({ success: false, errorCode });
          return;
        }

        if (!SBCSetEntity.getChallenge(cId).squad) {
          SBCSetEntity.getChallenge(cId).update(challenge);
        }

        const oneFillNeed = info.base.fastsbc[`${cId}#${id}`];
        if (!oneFillNeed || !Object.keys(oneFillNeed).length) {
          events.notice("fastsbc.error_1", 2);
          events.hideLoader();
          view.setInteractionState(true);
          options.onDone?.({ success: false, errorCode: 1 });
          return;
        }

        const playerPool =
          options.playerPool ?? fastSbcPlannerService.getSafeUnassignedPool(repositories, info);
        const fillPlayers =
          options.fillPlayers ??
          fastSbcPlannerService.resolveFillPlayers(oneFillNeed, playerPool, helpers);

        if (!fillPlayers || fillPlayers.length !== challenge.squad.getNumOfRequiredPlayers()) {
          events.notice("fastsbc.error_3", 2);
          events.hideLoader();
          view.setInteractionState(true);
          options.onDone?.({ success: false, errorCode: 3 });
          return;
        }

        runFastSbcSubmit(deps, controller, challenge, SBCSetEntity, fillPlayers, (result) => {
          events.hideLoader();
          view.setInteractionState(true);
          options.onDone?.(result);
        });
      });
    });
  };

  events.getSafeUnassignedPool = () =>
    fastSbcPlannerService.getSafeUnassignedPool(repositories, info);

  events.planAllFastSbcs = () =>
    fastSbcPlannerService.planBatch({
      info,
      services,
      repositories,
      helpers: plannerHelpers()
    });

  events.solveAllFastSbcs = () => {
    const plan = events.planAllFastSbcs();
    if (!plan.entries.length) {
      events.notice("fastsbc.batch.none", 2);
      return;
    }

    const names = plan.entries.map((entry) => entry.name).join("<br/>");
    const skippedCount = plan.skipped.length;
    events.popup(
      fy("fastsbc.batch.popupt"),
      `${fy(["fastsbc.batch.popupm", plan.entries.length, skippedCount])}<br/><br/>${names}`,
      (choice) => {
        if (choice !== 2) {
          return;
        }

        if (!info.base.fastsbctips) {
          events.popup(fy("fastsbc.popupt"), fy("fastsbc.popupm"), (tipChoice) => {
            if (tipChoice === 2) {
              info.base.fastsbctips = true;
              events.runFastSbcBatch(plan.entries);
            }
          });
          return;
        }

        events.runFastSbcBatch(plan.entries);
      }
    );
  };

  events.runFastSbcBatch = (entries, index = 0, successCount = 0) => {
    if (index >= entries.length) {
      events.hideLoader();
      events.notice(["fastsbc.batch.done", successCount, entries.length - successCount], 0);
      return;
    }

    if (index === 0) {
      events.showLoader();
    }

    if ((info.SBCCount?.count ?? 0) >= DAILY_SOFT_LIMIT) {
      events.hideLoader();
      events.notice("fastsbc.batch.stopped.daily_limit", 2);
      events.notice(["fastsbc.batch.done", successCount, entries.length - index], 0);
      return;
    }

    const entry = entries[index];
    events.changeLoadingText("fastsbc.batch.running", entry.name);

    events.isSBCCache(entry.sId, entry.cId, (result) => {
      if (result?.fatal) {
        events.hideLoader();
        events.notice("fastsbc.batch.stopped.ban", 2);
        events.notice(["fastsbc.batch.done", successCount, entries.length - index], 0);
        return;
      }

      const nextSuccess = successCount + (result?.success ? 1 : 0);
      setTimeout(() => {
        events.runFastSbcBatch(entries, index + 1, nextSuccess);
      }, 800);
    }, entry.fillPlayers);
  };
}