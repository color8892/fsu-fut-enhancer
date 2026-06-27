export function registerFastSbcEvents(deps) {
  const { events, cntlr, info, debug, repositories, services } = deps;

  events.isSBCCache = (id,cId) => {
      let SBCSetEntity = services.SBC.repository.getSetById(id);
      if(SBCSetEntity){
          events.fastSBC(id,cId)
      }else{
          debug.log("执行任务的是否发现没有SBC数据！")
          services.SBC.requestSets().observe(cntlr.current(), function(e, t) {
              if (e.unobserve(cntlr.current()),
              t.success && JSUtils.isObject(t.data)) {
                  events.fastSBC(id,cId);
              } else {
                  var r = t.error ? t.error.code : t.status;
                  NetworkErrorManager.checkCriticalStatus(r) ? NetworkErrorManager.handleStatus(r) : r === UtasErrorCode.SERVICE_IS_DISABLED && services.Configuration.setFeatureEnabled(UTServerSettingsRepository.KEY.SBC_ENABLED, !1)
              }
          })
      }
  }
  //快速SBC
  //24.20 新插入程序快速完成指定 SBC
  events.fastSBC = async (id,cId) => {
      let controller = events.getCurrent(),
          view = controller.getView(),
          SBCSetEntity = services.SBC.repository.getSetById(id),
          challenge;
      events.showLoader();
      view.setInteractionState(!1);
      services.SBC.requestChallengesForSet(SBCSetEntity).observe(controller, (e, t) => {
          if (e.unobserve(controller),t.success && 0 < t.data.challenges.length){
              challenge = t.data.challenges.find(challenge => challenge.id === cId),
              services.SBC.loadChallenge(challenge).observe(controller, async (ee,tt) => {
                  if (ee.unobserve(controller),tt.success){
                      if(!SBCSetEntity.getChallenge(cId).squad){
                          SBCSetEntity.getChallenge(cId).update(challenge);
                      }
                      debug.log(SBCSetEntity)
                      let oneFillNeed = info.base.fastsbc[`${cId}#${id}`];
                      if(oneFillNeed && Object.keys(oneFillNeed).length){
                          let fillPlayers = [];
                          if(!info.build.strictlypcik && events.isEligibleForOneFill(oneFillNeed)){
                              let criteriaNumber = oneFillNeed[0].c + oneFillNeed[1].c;
                              let tempFillNeed = {rs:JSON.parse(JSON.stringify(oneFillNeed[0].t.rs))};
                              tempFillNeed = events.ignorePlayerToCriteria(tempFillNeed);
                              tempFillNeed["lock"] = false;
                              fillPlayers = events.getItemBy(2,tempFillNeed,repositories.Item.getUnassignedItems()).slice(0,criteriaNumber);
                          }else{
                              let excludeId = [];
                              for (let i of oneFillNeed) {
                                  let searchCriteria = JSON.parse(JSON.stringify(i.t));
                                  searchCriteria = events.ignorePlayerToCriteria(searchCriteria);
                                  if(excludeId.length){
                                      searchCriteria["NEdatabaseId"] = excludeId;
                                  }
                                  searchCriteria["lock"] = false;
                                  let searchResults = events.getItemBy(2,searchCriteria,repositories.Item.getUnassignedItems()).slice(0,i.c);
                                  debug.log(_.map(searchResults,i => {return i._staticData.name + `_` + i.rating}))

                                  excludeId = excludeId.concat(searchResults.map( i => {return i.databaseId}))
                                  fillPlayers = fillPlayers.concat(searchResults)
                              }
                          }
                          if(fillPlayers.length == challenge.squad.getNumOfRequiredPlayers()){
                              events.playerListFillSquad(challenge,fillPlayers,1);
                              if (challenge.canSubmit()){
                                  if (!services.Configuration.getFeatureSetting(UTServerSettingsRepository.KEY.SBC_ALLOW_UNTRADEABLE) && challenge.hasUntradeableItems()){
                                      utils.PopupManager.showAlert(utils.PopupManager.Alerts.SBC_UNTRADEABLE_NOT_ALLOWED);
                                  }else if(JSUtils.isValid(SBCSetEntity)){
                                      TelemetryManager.trackEvent(TelemetryManager.Sections.SBC, TelemetryManager.Categories.BUTTON_PRESS, "SBC - Submit Challenge");
                                      let t = services.UserSettings.getSBCValidationSkip();
                                      services.SBC.submitChallenge(challenge,SBCSetEntity,t,services.Chemistry.isFeatureEnabled()).observe(controller,(eee,ttt) => {
                                          eee.unobserve(controller);
                                          let newChallenge = SBCSetEntity.getChallenge(challenge.id);
                                          if (ttt.success && newChallenge) {
                                              if(0 < newChallenge.awards.length){
                                                  var challengeRewards = new UTGameRewardsViewController(newChallenge.awards);
                                                  challengeRewards.init(),
                                                  challengeRewards.modalDisplayDimensions.width = "24em",
                                                  challengeRewards.getView().setSbcChallenge(newChallenge),
                                                  gPopupClickShield.setActivePopup(challengeRewards),
                                                  challengeRewards.onExit.observe(controller, function(e) {
                                                      e.unobserve(controller),
                                                      events.showRewardsView(SBCSetEntity)
                                                  })
                                              }else{
                                                  ttt.data.setCompleted && events.showRewardsView(SBCSetEntity);
                                              }
                                              services.PIN.sendData(PINEventType.PAGE_VIEW, {
                                                  type: PIN_PAGEVIEW_EVT_TYPE,
                                                  pgid: "SBC - Rewards Overlay"
                                              })
                                              if(_.includes(controller.className, 'UTUnassignedItems')){
                                                  controller._fsuRefreshBtn._tapDetected();
                                              }
                                              if(_.includes(controller.className, 'UTSBCSquad')){
                                                  controller.getNavigationController().popViewController()
                                              }
                                              //24.23 在SBC页面完成刷新页面状态避免卡死
                                              if(_.includes(controller.className, 'UTSBCHub')){
                                                  if(controller.getView()._interactionState == false){
                                                      debug.log(`SBC页面状态卡死，给予纠正。`)
                                                      controller.getView().setInteractionState(true);
                                                  }
                                                  controller._requestSBCData()
                                              }
                                              //24.23 在SBC小组列表完成率先呢数据

                                              if(_.includes(controller.className, 'UTSBCChallenges')){
                                                  controller.getView().setSBCSet(controller.sbcViewModel.sbcSet)
                                                  events.sbcSubPrice(controller.sbcViewModel.sbcSet.id,controller.getView())
                                              }

                                              events.SBCListInsertToFront(SBCSetEntity.id,1)
                                              events.notice("fastsbc.success",0)
                                          }else{
                                              if(ttt.status == 521){
                                                  events.notice("fastsbc.error_5",2)
                                              }else{
                                                  services.Notification.queue([services.Localization.localize("notification.sbcChallenges.failedToSubmit"), UINotificationType.NEGATIVE])
                                              }
                                          }
                                      })
                                  }
                              }else{
                                  utils.PopupManager.showAlert(utils.PopupManager.Alerts.SBC_INELIGIBLE_SQUAD);
                              }
                          }else{
                              events.notice("fastsbc.error_3",2)
                          }
                      }else{
                          events.notice("fastsbc.error_1",2)
                      }
                  }else{
                      let errorCode = 1;
                      if(!SBCSetEntity.isComplete() && SBCSetEntity.challengesCount > 1 && challenge.isCompleted()){
                          errorCode == 2;
                      }

                      events.notice(`fastsbc.error_${errorCode}`,2)
                  }
              });
              events.hideLoader();
          }else if(NetworkErrorManager.checkCriticalStatus(t.status)){
              NetworkErrorManager.handleStatus(t.status);
              events.hideLoader();
          }else {
              var a = (null === (i = t.error) || void 0 === i ? void 0 : i.code) === UtasErrorCode.SERVICE_IS_DISABLED ? "sbc.notification.disabled" : "notification.sbcChallenges.failedToLoad";
              l.setInteractionState(!0),
              services.Notification.queue([services.Localization.localize(a), UINotificationType.NEGATIVE])
              events.hideLoader();
          }
      })
      view.setInteractionState(!0)
  }
}
