export function registerHomeHubEvents(deps) {
  const { events, info, cntlr, isPhone, services } = deps;

  events.reloadPlayers = async () => {
    GM_setValue("players", JSON.stringify({}));
    let current = getAppMain().getRootViewController();
    await services.Club.getStats().observe(current, async function _onGetStats(e, t) {
      e.unobserve(current);
      t.success
        ? t.response.stats.forEach(async function (stat) {
            if (stat.type == "players") {
              if (stat.count !== services.Club.clubDao.clubRepo.items.length) {
                events.showLoader();
                let playersCount = 200;
                let playersPage = Math.ceil(stat.count / playersCount);
                for (let i = 0; i < playersPage; i++) {
                  let playersCriteria = new UTSearchCriteriaDTO();
                  playersCriteria.type = "player";
                  playersCriteria.sortBy = "ovr";
                  playersCriteria.sort = "desc";
                  playersCriteria.count = playersCount;
                  playersCriteria.offset = i * playersCount;
                  events.changeLoadingText(["loadingclose.ldata", `${i}`, `${playersPage}`]);
                  try {
                    await new Promise((resolve, reject) => {
                      services.Club.search(playersCriteria).observe(stat, (p, t) => {
                        if (p.unobserve(p), t.success && JSUtils.isObject(t.response)) {
                          resolve(t.response);
                        } else {
                          reject(new Error("Search operation failed"));
                        }
                      });
                    });
                    await events.wait(0.2, 0.5);
                  } catch (error) {
                    console.error("Search error:", error);
                    services.Notification.queue([
                      services.Localization.localize("notification.club.failedToLoad"),
                      UINotificationType.NEGATIVE
                    ]);
                    const navController = stat.getNavigationController();
                    if (navController) {
                      navController.popViewController(true);
                    }
                  }
                }

                await services.Item.searchStorageItems(new UTSearchCriteriaDTO()).observe(
                  current,
                  function (e, t) {
                    e.unobserve(current);
                  }
                );
                events.hideLoader();
                info.base.state = true;
                events.notice("notice.ldatasuccess", 0);
                if (
                  cntlr.current().className == "UTHomeHubViewController" &&
                  info.task.obj.html &&
                  cntlr
                    .current()
                    .getView()
                    ._objectivesTile.__tileContent.querySelector(".ut-tile-view--subtitle")
                ) {
                  if (!cntlr.current().getView()._objectivesTile.__root.querySelector(".fsu-task")) {
                    cntlr
                      .current()
                      .getView()
                      ._objectivesTile.__tileContent.before(
                        events.createDF(`<div class="fsu-task">${info.task.obj.html}</div>`)
                      );
                  }
                  let objCountElement = cntlr
                    .current()
                    .getView()
                    ._objectivesTile.getRootElement()
                    .querySelector(".fsu-obj-count");
                  if (objCountElement && info.task.obj.stat.catReward) {
                    objCountElement.textContent = info.task.obj.stat.catReward;
                    objCountElement.style.display = "block";
                  }
                }
                if (
                  cntlr.current().className == "UTHomeHubViewController" &&
                  info.task.sbc.html &&
                  !cntlr.current().getView()._sbcTile.__root.querySelector(".fsu-task") &&
                  cntlr
                    .current()
                    .getView()
                    ._sbcTile.__tileContent.querySelector(".ut-tile-content-graphic-info")
                ) {
                  cntlr
                    .current()
                    .getView()
                    ._sbcTile.__tileContent.before(
                      events.createDF(`<div class="fsu-task">${info.task.sbc.html}</div>`)
                    );
                }
              }
            }
          })
        : NetworkErrorManager.checkCriticalStatus(t.status) &&
          NetworkErrorManager.handleStatus(t.status) &&
          events.hideLoader() &&
          events.notice("notice.ldataerror", 2);
    });
  };
}

export function installHomeHubPatches(deps) {
  const { call, events, info, fy, cntlr, services, debug, fsuSC } = deps;

  UTHomeHubView.prototype._generate = function (...args) {
    if (!this._generated) {
      call.task.home.call(this, ...args);
      GM_addStyle(info.base.sytle);
      debug.log(fy("tile.settitle"));
      this._fsuDodo = events.createTile(fy("tile.dodotitle"), fy("tile.dodotext"), () => {
        GM_openInTab(`https://fut.to`, { active: true, insert: true, setParent: true });
      });
      this._sbcTile.__root.after(this._fsuDodo.__root);
      this._fsuSet = events.createTile(fy("tile.settitle"), fy("tile.settext"), () => {
        var n = cntlr.current().getNavigationController();
        if (n) {
          var t = new fsuSC();
          n.pushViewController(t);
        }
      });
      this._fsuDodo.__root.after(this._fsuSet.__root);
      this._fsuGP = events.createTile(fy("tile.gptitle"), fy("tile.gptext"), () => {
        services.Club.clubDao.clubRepo.items.reset();
        events.waitForClickShieldToHide(() => {
          try {
            const cur = cntlr.current();
            if (cur) {
              events.init();
            } else {
              console.warn("cntlr.current() 为空，跳过初始化");
            }
          } catch (e) {
            console.warn("cntlr.current() 结构未就绪，跳过 events.init()");
          }
        });
      });
      this._fsuGP._parent = this;
      this._fsuSet.__root.after(this._fsuGP.__root);

      events.waitForClickShieldToHide(() => {
        try {
          const cur = cntlr.current();
          if (cur) {
            events.init();
          } else {
            console.warn("cntlr.current() 为空，跳过初始化");
          }
        } catch (e) {
          console.warn("cntlr.current() 结构未就绪，跳过 events.init()");
        }
      });
    }
  };

  UTHomeHubView.prototype.getObjectivesTile = function () {
    if (info.task.obj.html && !this._objectivesTile.__root.querySelector(".fsu-task") && info.set.info_obj) {
      this._objectivesTile.__tileContent.before(
        events.createDF(`<div class="fsu-task">${info.task.obj.html}</div>`)
      );
    }

    debug.log(services.Configuration.checkFeatureEnabled(UTServerSettingsRepository.KEY.META_FCAS_ENABLED));
    if (services.Configuration.checkFeatureEnabled(UTServerSettingsRepository.KEY.META_FCAS_ENABLED) == false) {
      services.Configuration.serverSettings.setSettingByKey(UTServerSettingsRepository.KEY.META_FCAS_ENABLED, 1);
    }
    return this._objectivesTile;
  };

  UTHomeHubView.prototype.getSBCTile = function () {
    if (info.set.info_sbc && info.task.sbc.html && !this._sbcTile.__root.querySelector(".fsu-task")) {
      this._sbcTile.__tileContent.before(
        events.createDF(`<div class="fsu-task">${info.task.sbc.html}</div>`)
      );
    }
    return this._sbcTile;
  };
}