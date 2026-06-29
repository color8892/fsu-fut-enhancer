import { FSU_BASE_STYLE } from "../ui/fsu-styles.js";

function applyHomeTaskTiles(events, info, cntlr) {
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
    const objCountElement = cntlr
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
      ._sbcTile.__tileContent.before(events.createDF(`<div class="fsu-task">${info.task.sbc.html}</div>`));
  }
}

function searchClubPage(services, stat, pageIndex, playersCount) {
  const playersCriteria = new UTSearchCriteriaDTO();
  playersCriteria.type = "player";
  playersCriteria.sortBy = "ovr";
  playersCriteria.sort = "desc";
  playersCriteria.count = playersCount;
  playersCriteria.offset = pageIndex * playersCount;
  return new Promise((resolve, reject) => {
    services.Club.search(playersCriteria).observe(stat, (observer, response) => {
      observer.unobserve(stat);
      if (response.success && JSUtils.isObject(response.response)) {
        resolve(response.response);
      } else {
        reject(new Error("Search operation failed"));
      }
    });
  });
}

function searchStorageItems(services, current) {
  return new Promise((resolve) => {
    services.Item.searchStorageItems(new UTSearchCriteriaDTO()).observe(current, (observer) => {
      observer.unobserve(current);
      resolve();
    });
  });
}

export function registerHomeHubEvents(deps) {
  const { events, info, cntlr, services } = deps;

  events.reloadPlayers = async () => {
    GM_setValue("players", JSON.stringify({}));
    const current = getAppMain().getRootViewController();
    const playersCount = 200;

    await new Promise((resolve) => {
      services.Club.getStats().observe(current, async (observer, response) => {
        observer.unobserve(current);
        if (!response.success) {
          if (
            NetworkErrorManager.checkCriticalStatus(response.status) &&
            NetworkErrorManager.handleStatus(response.status)
          ) {
            events.hideLoader();
            events.notice("notice.ldataerror", 2);
          }
          resolve();
          return;
        }

        const playerStat = _.find(response.response.stats, { type: "players" });
        if (!playerStat) {
          resolve();
          return;
        }

        if (playerStat.count === services.Club.clubDao.clubRepo.items.length) {
          info.base.state = true;
          applyHomeTaskTiles(events, info, cntlr);
          resolve();
          return;
        }

        events.showLoader();
        const playersPage = Math.ceil(playerStat.count / playersCount);
        const storagePromise = searchStorageItems(services, current);

        try {
          for (let page = 0; page < playersPage; page++) {
            events.changeLoadingText(["loadingclose.ldata", `${page + 1}`, `${playersPage}`]);
            await searchClubPage(services, playerStat, page, playersCount);
          }
          await storagePromise;
          events.hideLoader();
          info.base.state = true;
          events.notice("notice.ldatasuccess", 0);
          applyHomeTaskTiles(events, info, cntlr);
        } catch (error) {
          console.error("Search error:", error);
          events.hideLoader();
          services.Notification.queue([
            services.Localization.localize("notification.club.failedToLoad"),
            UINotificationType.NEGATIVE
          ]);
          const navController = playerStat.getNavigationController?.();
          if (navController) {
            navController.popViewController(true);
          }
        }
        resolve();
      });
    });
  };
}

function scheduleHomeInit(events, cntlr) {
  events.waitForClickShieldToHide(() => {
    try {
      const cur = cntlr.current();
      if (cur) {
        events.init();
      } else {
        console.warn("cntlr.current() 为空，跳过初始化");
      }
    } catch (_error) {
      console.warn("cntlr.current() 结构未就绪，跳过 events.init()");
    }
  });
}

export function installHomeHubPatches(deps) {
  const { call, events, info, fy, cntlr, services, debug, fsuSC } = deps;

  UTHomeHubView.prototype._generate = function (...args) {
    if (!this._generated) {
      call.task.home.call(this, ...args);
      GM_addStyle(info.base.style ?? FSU_BASE_STYLE);
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
        scheduleHomeInit(events, cntlr);
      });
      this._fsuGP._parent = this;
      this._fsuSet.__root.after(this._fsuGP.__root);

      scheduleHomeInit(events, cntlr);
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