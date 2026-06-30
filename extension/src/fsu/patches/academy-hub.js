export function installAcademyHubPatches(deps) {
  const { info, events, fy, repositories, debug } = deps;

  const UTAcademyHubViewController_onRequestHubDataComplete =
    UTAcademyHubViewController.prototype.onRequestHubDataComplete;
  UTAcademyHubViewController.prototype.onRequestHubDataComplete = function (e, t) {
    t.data.slots = _.orderBy(
      t.data.slots,
      [
        (item) => (info.evolutions.new.includes(item.id) ? 0 : 1),
        (item) => (item.endTimePurchaseVisibility === 0 ? Infinity : item.endTimePurchaseVisibility),
        (item) => (item.endTime === 0 ? Infinity : item.endTime)
      ],
      ["asc", "asc", "asc"]
    );
    UTAcademyHubViewController_onRequestHubDataComplete.call(this, e, t);
  };

  const UTAcademyHubView_setupTabs = UTAcademyHubView.prototype.setupTabs;
  UTAcademyHubView.prototype.setupTabs = function (e) {
    UTAcademyHubView_setupTabs.call(this, e);
    _.forEach(this._navigation.items, (item) => {
      if (item.id !== -1) {
        const academyCategory = _.find(e, (i) => i.id === item.id);
        if (academyCategory) {
          const newCount = _.intersection(academyCategory.slotIds, info.evolutions.new).length;
          if (newCount) {
            events.navigationAddCount(item, newCount);
          }
          const expiryAcademy = _.filter(academyCategory.slotIds, (id) => {
            let academySlot = repositories.Academy.getSlotById(id);
            let endTime =
              academySlot?.status == AcademySlotState.NOT_STARTED
                ? _.min(
                    _.filter(
                      [academySlot.endTime, academySlot.endTimePurchaseVisibility],
                      (v) => v && v !== 0
                    )
                  )
                : academySlot?.endTime;
            return endTime && endTime - Math.round(new Date() / 1000) < 172800;
          });
          if (expiryAcademy.length) {
            events.navigationAddCount(item, -expiryAcademy.length);
          }
        }
      }
    });
  };

  const UTAcademyHubView_generateSlot = UTAcademyHubView.prototype.generateSlot;
  UTAcademyHubView.prototype.generateSlot = function (e) {
    const tileView = UTAcademyHubView_generateSlot.call(this, e);
    const tileViewRoot = tileView.getRootElement();
    tileView._fsu ??= {};
    let isChange = false;
    if (info.evolutions.new.includes(e.id)) {
      isChange = true;
      tileView._fsu.new = events.createDF(`<div class='fsu-newtips'>${fy("task.new")}</div>`);
      tileViewRoot.appendChild(tileView._fsu.new);
    }
    const endTime =
      e.status == AcademySlotState.NOT_STARTED
        ? _.min(_.filter([e.endTime, e.endTimePurchaseVisibility], (v) => v && v !== 0))
        : e.endTime;
    if (endTime && endTime - Math.round(new Date() / 1000) < 172800) {
      isChange = true;
      tileView._fsu.expire = events.createDF(`<div class='task-expire'>${fy("task.expire")}</div>`);
      tileViewRoot.prepend(tileView._fsu.expire);
      Object.assign(tileViewRoot.querySelector(".task-expire").style, {
        position: "absolute",
        width: "100%",
        top: "0",
        left: "0"
      });
      tileView.__title.style.marginTop = "16px";
    }
    if (isChange) {
      tileViewRoot.style.position = "relative";
      tileViewRoot.style.overflow = "clip";
    }

    const attr = _.find(info.academy, { id: e.id });
    if (attr) {
      if (attr.rating > 0) {
        let h1 = tileViewRoot.querySelector("h1");
        if (h1 && !h1.textContent.startsWith(`[${attr.rating}] `)) {
          h1.textContent = `[${attr.rating}] ${h1.textContent}`;
        }
      }
      if (attr.attrText.size > 3) {
        tileView._fsu.attr = events.createElementWithConfig("div", {
          classList: "academyViewBox"
        });
        tileView._fsu.attr.appendChild(events.academyAddAttrOutput(attr.attrText));
        tileView.__description.after(tileView._fsu.attr);
      }
    }

    return tileView;
  };

  const UTAcademyClubSearchView_init = UTAcademyClubSearchView.prototype.init;
  UTAcademyClubSearchView.prototype.init = function (...args) {
    UTAcademyClubSearchView_init.call(this, ...args);
    setTimeout(() => {
      this._searchFilters.getSortDropDown().addTarget(this, this._eDropDownChanged, EventType.CHANGE);
      this._searchFilters.getSortDropDown().setDefaultIndexById(SearchSortID.RATING_DESC, !0);
      this._searchFilters._filterContainer._playerNameSearch = new UTPlayerSearchControl();
      this._searchFilters._filterContainer._playerNameSearch.init();
      this._searchFilters._filterContainer.addSubview(
        this._searchFilters._filterContainer._playerNameSearch
      );
      this._searchFilters._filterContainer
        .getRootElement()
        .prepend(this._searchFilters._filterContainer._playerNameSearch.getRootElement());
      this._playerNameSearch = this._searchFilters.getPlayerNameSearch();
      this._playerNameSearch?.addTarget(this, this.eButtonSelected, EventType.CHANGE);
      this._searchFilters.onFilterChange.observe(this, this._eFilterChanged);
      this._searchFilters._filterContainer.show();
      _.forOwn(this._searchFilters._filterContainer.searchFilters._collection, (value, key) => {
        if (
          key !== enums.UISearchFilters.CLUB &&
          key !== enums.UISearchFilters.LEAGUE &&
          key !== enums.UISearchFilters.NATION
        ) {
          value.hide();
        }
      });
    }, 50);
  };

  const UTAcademyPlayerFromClubViewController_requestItems =
    UTAcademyPlayerFromClubViewController.prototype.requestItems;
  UTAcademyPlayerFromClubViewController.prototype.requestItems = function (...args) {
    let localSearch = {},
      sc = this.searchCriteria;
    if (sc.defId.length) {
      localSearch.definitionId = sc.defId;
    }
    if (sc.nation != -1) {
      localSearch.nationId = sc.nation;
    }
    if (sc.club != -1) {
      localSearch.teamId = sc.club;
    }
    if (sc.league != -1) {
      localSearch.leagueId = sc.league;
    }
    if (_.size(localSearch)) {
      _.forEach(this.academySlot.eligibilityRequirements, (er) => {
        if (er.attribute == AcademyEligibilityAttribute.OVR && er.scope < 3) {
          const op = er.scope == AcademyEligibilityScope.MAX ? "LT" : "GT";
          localSearch[`${op}rating`] = er.targets;
        }
        if (er.attribute == AcademyEligibilityAttribute.BASE_TRAITS_COUNT) {
          localSearch[`maxNumBasicPlayStyles`] = er.targets;
        }
        if (er.attribute == AcademyEligibilityAttribute.ICON_TRAITS_COUNT) {
          localSearch[`maxNumPlusPlayStyles`] = er.targets;
        }
        if (er.attribute == AcademyEligibilityAttribute.POSITION) {
          localSearch[`includePos`] = er.targets;
        }
        if (er.attribute == AcademyEligibilityAttribute.POSITION_NEGATED) {
          localSearch[`excludePos`] = er.targets;
        }
        if (er.attribute == AcademyEligibilityAttribute.POSSIBLE_POSITIONS_COUNT) {
          localSearch[`maxNumPos`] = er.targets;
        }
      });
      let result = events.getItemBy(2, localSearch, false, repositories.Item.club.items.values());
      debug.log(result);
      this.handleItemRetrieval(result, true);
    } else {
      UTAcademyPlayerFromClubViewController_requestItems.call(this, ...args);
    }
    debug.log(this);
  };
}