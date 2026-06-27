export function installClubHubPatches(deps) {
  const { call, events, info, fy, cntlr, isPhone, repositories, services } = deps;

  UTClubHubView.prototype.clearTileContent = function (...args) {
    call.view.clubHub.call(this);

    if (services.Configuration.checkFeatureEnabled(UTServerSettingsRepository.KEY.STORAGE_PILE_ENABLED)) {
      let v = this;
      let e = new UTSearchCriteriaDTO();
      services.Item.searchStorageItems(e).observe(v, function (e, t) {
        e.unobserve(v);
        if (this._sbcStorageTile) {
          this.addTileStats(this._sbcStorageTile, repositories.Item.numItemsInCache(ItemPile.STORAGE));
        }
      });
    }

    if ("_fsuLockTile" in this) {
      this.addTileStats(this._fsuLockTile, info.lock.length);
    } else {
      let lockTile = new UTTileView();
      lockTile.getRootElement().classList.add("col-1-2");
      lockTile.getRootElement().classList.add("ut-tile-view--with-gfx");
      lockTile.getRootElement().classList.add("fsu-lock");
      lockTile.init();
      lockTile.title = fy("locked.tile");
      lockTile._parent = this;
      this._fsuLockTile = lockTile;
      this._fsuLockTile.addTarget(
        this._fsuLockTile,
        (e) => {
          events.goToLockPlayers(e._parent);
        },
        EventType.TAP
      );
      this.addTileStats(this._fsuLockTile, _.size(events.getItemBy(1, { id: info.lock })));
      this.getRootElement().querySelector("div.grid").appendChild(this._fsuLockTile.getRootElement());
    }
  };

  events.goToStoragePlayers = () => {
    let nav = cntlr.current().getNavigationController();
    if (nav) {
      let criteria = new UTSearchCriteriaDTO();
      criteria.type = SearchType.PLAYER;
      let controller = isPhone()
        ? new UTClubSearchResultsViewController()
        : new controllers.club.ClubSearchResultsLandscape();
      controller.initWithSearchCriteria(criteria);
      if (isPhone()) {
        controller._fsuStorage = true;
      } else {
        controller._listController._fsuStorage = true;
      }
      nav.pushViewController(controller);
    }
  };

  events.goToLockPlayers = () => {
    let nav = cntlr.current().getNavigationController();
    if (nav) {
      let criteria = new UTSearchCriteriaDTO();
      criteria.type = SearchType.PLAYER;
      let controller = isPhone()
        ? new UTClubSearchResultsViewController()
        : new controllers.club.ClubSearchResultsLandscape();
      controller.initWithSearchCriteria(criteria);
      if (isPhone()) {
        controller._fsuLock = true;
      } else {
        controller._listController._fsuLock = true;
      }
      nav.pushViewController(controller);
    }
  };
}