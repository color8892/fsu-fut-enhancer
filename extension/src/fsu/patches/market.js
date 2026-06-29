export function installMarketPatches(deps) {
  const { call, events, info, cntlr, isPhone, fy, debug, repositories, services, GM_setValue } = deps;

  UTTransferMarketPaginationViewModel.prototype.startAuctionUpdates = function (...args) {
    call.view.transferMarket.call(this, ...args);
    if (services.Item.marketRepository.pages.length) {
      _.map(services.Item.marketRepository.pages, (p) => {
        _.map(p.items, (i) => {
          if (!_.has(info.roster.ea, i.definitionId) || i._marketAverage !== -1) {
            info.roster.ea[i.definitionId] = {
              n: i._marketAverage,
              t: i._marketAverage !== -1 ? i._marketAverage.toLocaleString() : 0
            };
          }
        });
      });
    }
  };

  UTMarketSearchFiltersView.prototype.setPinnedItem = function (e, t) {
    call.panel.market.call(this, e, t);
    let sbc = isPhone() ? cntlr.current().squadContext.squad.isSBC() : cntlr.current()._squad.isSBC();
    if (e.definitionId && sbc && info.set.sbc_market && e.concept) {
      let p = events.getCachePrice(e.definitionId, 1).num,
        v = this._maxBuyNowPriceRow._currencyInput._currencyInput,
        f = this._searchFilters.filters;
      if (f[1].setId == "rarity" && f[1].getValue() == -1) {
        f[1].setIndexByValue(e.rareflag);
      }
      if (f[2].setId == "position" && f[2].getIndex() !== 0) {
        f[2].setIndex(0);
      }
      setTimeout(() => {
        if (v.getValue() == 0) {
          if (p !== 0) {
            v.setValue(p);
            debug.log(v);
            if (!isPhone()) {
              events.notice("notice.marketsetmax", 1);
            }
          }
        }
      }, 50);
    }
  };

  UTTransferListViewController.prototype._renderView = function (...args) {
    call.view.transfer.call(this, ...args);
    let sectionKey = [
      UTTransferSectionListViewModel.SECTION.UNSOLD,
      UTTransferSectionListViewModel.SECTION.AVAILABLE
    ];
    for (const key of sectionKey) {
      let controller = this.getView().getSection(key);
      let list = controller.listRows;
      if (list.length) {
        let solePlayers = list.filter((i) => i.data.duplicateId == 0);
        if (solePlayers.length && info.set.player_transfertoclub) {
          controller._fsuSendClub = events.createButton(
            new UTImageButtonControl(),
            "",
            async (e) => {
              e.parent.getView().setInteractionState(!1);
              events.popup(
                fy("transfertoclub.popupt"),
                fy(["transfertoclub.popupm", e.list.length]),
                (t) => {
                  if (t === 2) {
                    events.transferToClub(e.parent, e.list);
                  } else {
                    e.parent.getView().setInteractionState(!0);
                  }
                }
              );
            },
            "filter-btn fsu-club"
          );
          controller._fsuSendClub.list = solePlayers.map((i) => {
            return i.data;
          });
          controller._fsuSendClub.parent = this;
          controller._header.getRootElement().appendChild(controller._fsuSendClub.getRootElement());
        }
      }
    }
  };

  UTMarketSearchView.prototype._generate = function (...args) {
    if (!this._generated) {
      call.view.market.call(this, ...args);
    }
  };

  UTClubSearchFiltersViewController.prototype.viewDidAppear = function () {
    call.search.club.viewDid.call(this);
    if (this.squad.isActive() || this.squad.isDream()) {
      if (!("_fsuSortInit" in this.getView())) {
        this.getView()._sortDropDown.setIndexById(2);
        this.getView()._fsuSortInit = true;
      }
    }
    if ("_fsuFillType" in this.parentViewController) {
      if (this.squad.isSBC() || this.squad.isActive() || this.squad.isDream()) {
        events.searchFill(this);
      }
    }
  };

  UTClubSearchFiltersViewController.prototype.onSearchModeChanged = function (t, e) {
    call.search.club.modeChange.call(this, t, e);
  };

  UTClubSearchResultsView.prototype.setItemsWithChemDiff = function (t, a, s, l, c) {
    call.search.club.setChemDiff.call(this, t, a, s, l, c);
    _.map(t, (player, index) => {
      let iconName = "";
      let className = "";
      if (!this.activeSquad.containsItem(player, !0)) {
        if (player.concept) {
          if (events.getItemBy(1, { definitionId: player.definitionId }).length) {
            iconName = "club";
            className = "fsu-inclubtag";
          }
        }
      }

      if (events.getItemBy(1, { id: player.id }, false, repositories.Item.storage.values()).length) {
        iconName = "sbc";
        className = "fsu-instoragetag";
      }

      if (iconName !== "") {
        let tag = new UTListActiveTagView;
        tag.setIconClass(iconName);
        tag.getRootElement().querySelector(".label-container").classList.add(className);
        this._list.getRows()[index].__rowContent.appendChild(tag.getRootElement());
        this._list.getRows()[index].addClass("is-active");
      }
    });
  };

  UTMarketSearchFiltersViewController.prototype.eSearchSelected = function (e, t, i) {
    call.other.market.eSearch.call(this, e, t, i);
    if (_.includes(this.className, "UTMarketSearch") && this.pinnedListRowItem == null) {
      let criteria = JSON.parse(JSON.stringify(this.viewmodel.searchCriteria));
      if (criteria.maskedDefId) {
        let criteriaText = JSON.stringify(Object.values(criteria));
        let repeat = 1;
        info.market.mb.forEach((element, index) => {
          if (JSON.stringify(element) == criteriaText) {
            info.market.mb.splice(index, 1);
            repeat = index;
          }
        });
        info.market.mb.unshift(Object.values(criteria));
        info.market.mb.splice(6);
        if (repeat) {
          info.market.ts = Date.now();
        }
        debug.log(info.market);
        GM_setValue("history", JSON.stringify(info.market.mb));
      }
    }
  };

  UTMarketSearchFiltersView.prototype.setFilters = function (e, t) {
    call.other.market.setFilter.call(this, e, t);
    if (e.searchBucket == 0 && e.showCategoryTab) {
      debug.log(info.market);
      if (!("_fsuHistory" in this)) {
        this._fsuHistory = {};
        this._fsuHistory.ts = 0;
        let element = document.createElement("div");
        element.classList.add("search-prices");
        let eheader = document.createElement("div");
        eheader.classList.add("search-price-header");
        element.appendChild(eheader);
        let eheadertext = document.createElement("h1");
        eheadertext.textContent = fy("history.title");
        eheader.appendChild(eheadertext);
        let ebody = events.createElementWithConfig("div", {
          classList: ["fsu-historybox"],
          style: {
            display: "grid",
            gridTemplateColumns: `repeat(${isPhone() ? 1 : 3},minmax(0,1fr))`,
            gap: "1.2rem"
          }
        });
        element.appendChild(ebody);
        this._fsuHistory.element = element;
        this._fsuHistory.btns = [];
        this.getRootElement().querySelector(".ut-pinned-list").appendChild(this._fsuHistory.element);
      }
      if (this._fsuHistory.element.style.display == "none") {
        this._fsuHistory.element.style.display = "block";
      }
      if (this._fsuHistory.ts !== info.market.ts) {
        this._fsuHistory.btns.length = 0;
        this._fsuHistory.element.querySelector(".fsu-historybox").innerHTML = "";
        let criteriaKeys = Object.keys(e.searchCriteria);

        _.map(info.market.mb, (item, _index) => {
          let playerInfo = repositories.Item.getStaticDataByDefId(
            item[criteriaKeys.indexOf("maskedDefId")]
          );
          if (playerInfo) {
            let btn = events.createButton(
              new UTStandardButtonControl(),
              `${playerInfo.name} - ${playerInfo.rating}`,
              async (e) => {
                debug.log(e.criteria);
                let current = cntlr.current().viewmodel.searchCriteria;
                let keys = Object.keys(current);
                if (!(keys.length - e.criteria.length)) {
                  keys.forEach(function (value, index) {
                    let condition = false;
                    if (Array.isArray(current[value])) {
                      condition = current[value].length !== e.criteria[index].length;
                    } else {
                      condition = current[value] !== e.criteria[index];
                    }
                    if (condition) {
                      debug.log(
                        `${value}，目前的元素 ${current[value]}，存储值为 ${e.criteria[index]}`
                      );
                      current[value] = e.criteria[index];
                    }
                  });
                  cntlr.current().getView().eSearchButtonSelected();
                }
              },
              "mini"
            );
            btn.getRootElement().style.width = "100%";
            btn.criteria = item;
            this._fsuHistory.btns.push(btn);
            let eblock = document.createElement("div");
            eblock.classList.add("price-filter");
            eblock.appendChild(btn.getRootElement());
            let elable = document.createElement("div");
            elable.style.textAlign = "center";
            elable.style.color = "#9E9E9E";
            let bid = [];
            if (item[criteriaKeys.indexOf("minBid")] + item[criteriaKeys.indexOf("maxBid")] > 0) {
              bid = [
                item[criteriaKeys.indexOf("minBid")],
                item[criteriaKeys.indexOf("maxBid")],
                "auctioninfo.bidprice"
              ];
            } else {
              bid = [
                item[criteriaKeys.indexOf("minBuy")],
                item[criteriaKeys.indexOf("maxBuy")],
                "auctioninfo.buynowprice"
              ];
            }
            let defaultText = services.Localization.localize("search.comboBoxDefaultValue");
            elable.textContent = `${services.Localization.localize(bid[2])}${bid[0] ? bid[0] : defaultText} - ${bid[1] ? bid[1] : defaultText}`;
            eblock.appendChild(elable);
            this._fsuHistory.element.querySelector(".fsu-historybox").appendChild(eblock);
          }
        });
        this._fsuHistory.ts = info.market.ts;
      }
    } else if ("_fsuHistory" in this) {
      this._fsuHistory.element.style.display = "none";
    }
  };

}