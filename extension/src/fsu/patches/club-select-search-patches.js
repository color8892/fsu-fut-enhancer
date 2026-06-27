export function installClubSelectSearchPatches(deps) {
  const { call, events, info, fy, cntlr, repositories, services } = deps;
UTClubSearchResultsViewController.prototype._requestItems = function(r) {
    if("_fsuLock" in this && this._fsuLock){
        var s = this;
        void 0 === r && (r = !1);
        var e = this.getView().getSubTypesDropDown()
            , t = new UTSearchCriteriaDTO;
        t.update(this.searchCriteria),
        0 < e.length && (t.subtypes = [e.id]),
        services.Club.search(t).observe(this, function(e, t) {
            var i;
            if (e.unobserve(s),
            s.clubViewModel && t.success && JSUtils.isObject(t.response)) {
                //debug.log(t)
            var o = s.clubViewModel.getIndex()
                , n = s.searchCriteria.sortBy === SearchSortType.RECENCY
                , p = t.response.items.filter( i => info.lock.includes(i.id));
            s.clubViewModel.sortByRecency = n,
            s.clubViewModel.sort = s.searchCriteria.sort,
            s.clubViewModel.sortType = s.searchCriteria.sortBy,
            s.clubViewModel.removeArray(t.response.items),
            s.clubViewModel.addArray(p),
            s.clubViewModel.isFull = t.response.retrievedAll,
            s.clubViewModel.setIndex(o),
            s.updateItemList(s.clubViewModel.getPageItems(), !r)
            } else
            services.Notification.queue([services.Localization.localize("notification.club.failedToLoad"), UINotificationType.NEGATIVE]),
            null === (i = s.getNavigationController()) || void 0 === i || i.popViewController(!0)
        })
    }else if("_fsuStorage" in this && this._fsuStorage){
        var s = this;
        void 0 === r && (r = !1);
        var e = this.getView().getSubTypesDropDown()
            , t = new UTSearchCriteriaDTO;
        t.update(this.searchCriteria),
        0 < e.length && (t.subtypes = [e.id]),
        services.Item.searchStorageItems(t).observe(this, function(e, t) {
            var i;
            if (e.unobserve(s),
            s.clubViewModel && t.success && JSUtils.isObject(t.response)) {
                //debug.log(t)
            var o = s.clubViewModel.getIndex()
                , n = s.searchCriteria.sortBy === SearchSortType.RECENCY;
            s.clubViewModel.sortByRecency = n,
            s.clubViewModel.sort = s.searchCriteria.sort,
            s.clubViewModel.sortType = s.searchCriteria.sortBy,
            s.clubViewModel.removeArray(t.response.items),
            s.clubViewModel.addArray(t.response.items),
            s.clubViewModel.isFull = t.response.retrievedAll,
            s.clubViewModel.setIndex(o),
            s.updateItemList(s.clubViewModel.getPageItems(), !r)
            } else
            services.Notification.queue([services.Localization.localize("notification.club.failedToLoad"), UINotificationType.NEGATIVE]),
            null === (i = s.getNavigationController()) || void 0 === i || i.popViewController(!0)
        })
    }else if("_fsuAutoBuy" in this && this._fsuAutoBuy){
        //25.20 球员自动购买 写入球员
        this.clubViewModel.resetCollection([]);
        this.clubViewModel.addArray(this._fsuAutoBuyPlayers);
        this.clubViewModel.isFull = true;
        this.clubViewModel.getIndex()
        this.updateItemList(this.clubViewModel.getPageItems(), 1)

        if(this._fsuAutoBuyPlayers.length == 0){
            this.getView()._list.noResultsView.setHeading(fy("autobuy.noresult.title"))
            this.getView()._list.noResultsView.setDescription(fy("autobuy.noresult.text"))
            this.getView()._list.noResultsView._button.hide()
            this.getView().getRootElement().classList.add("fsu-aotobuy")
        }else{
            this.getView().header.getButton().hide()

            //写入队内是否拥有标识
            _.forEach(this.getView()._list.listRows,(rows) => {
                const clubPlayers = events.getItemBy(1,{"definitionId":rows.data.definitionId});
                if(clubPlayers.length > 0){
                    let tag = new UTListActiveTagView;
                    tag.setIconClass("club");
                    rows.setActiveTagComponent(tag);
                    rows.addClass("is-active");
                    rows.__rowContent.appendChild(tag.getRootElement());
                }
            })


        }
    }else if("_fsuInPacks" in this && this._fsuInPacks){
        events.showLoader()
        const index = this.clubViewModel.getIndex()
        if(info.inpacks.defIds.length === 0){
            
        }
        this.clubViewModel.resetCollection([]);
        this.clubViewModel.addArray(info.inpacks);
        this.clubViewModel.isFull = true;
        this.clubViewModel.setIndex(index)
        this.updateItemList(this.clubViewModel.getPageItems(), 1)
        events.hideLoader()
    }else{
        call.search.request.call(this,r)
    }
}

//24.18 修正锁定列表标题的问题
UTClubSearchResultsViewController.prototype.setupHeader = function(...args) {
    call.search.setHeader.call(this,...args)
    if("_fsuLock" in this && this._fsuLock){
        this.getNavigationController().setNavigationTitle(fy("locked.navtilte"))
    }
    if("_fsuStorage" in this && this._fsuStorage){
        this.getNavigationController().setNavigationTitle(fy("storage.navtilte"))

        let sendClubPlayers = _.filter(repositories.Item.storage.values(),i => {
            let clubPlayers = events.getItemBy(1,{"definitionId": i.definitionId, "upgrades": null},false,repositories.Item.club.items.values());
            return clubPlayers.length == 0
        })
        if(sendClubPlayers.length){
            let setClubHeader = new UTSectionedTableHeaderView;
            setClubHeader.init(),
            setClubHeader.hideActionButton(),
            setClubHeader.hideBulkActionButton(),
            setClubHeader.setText(fy([`storage.setclub.text`,sendClubPlayers.length]));
            let controller = this;
            let setClubButton = events.createButton(
                new UTStandardButtonControl(),
                fy(`storage.setclub.button`),
                (e) => {
                    events.transferToClub(controller,sendClubPlayers)
                    setClubHeader.hide()
                },
                "call-to-action mini"
            )
            setClubButton._parent = setClubHeader;
            setClubHeader.getRootElement().appendChild(setClubButton.getRootElement());

            this.getView().getRootElement().prepend(setClubHeader.getRootElement())
        }
    }

    //25.20 球员自动购买 设置标题
    if("_fsuAutoBuy" in this && this._fsuAutoBuy && !_.has(this,"_playerNameInput")){
        this.getNavigationController().setNavigationTitle(fy("autobuy.nav.tilte"));


        let searchBox = document.createElement("div");
        searchBox.classList.add("fsu-sbcfilter-box");
        let searchOption = document.createElement("div");
        searchOption.classList.add("fsu-sbcfilter-option");
        searchOption.style.maxWidth = "400px";

        this._playerNameInput = new UTPlayerSearchControl();
        this._playerNameInput.init();
        this._playerNameInput.getRootElement().style.flex = 1;
        searchOption.appendChild(this._playerNameInput.getRootElement());

        this._searchButton = events.createButton(
            new UTStandardButtonControl(),
            services.Localization.localize("button.search"),
            (e) => {
                if(this._playerNameInput.getSelected()){
                    events.showLoader()
                    events.autoBuySearchPlayer(this._playerNameInput.getSelected(),this)
                }else{
                    events.notice("autobuy.noselected.notice",2)
                }
            },
            "call-to-action"
        )
        this._searchButton.getRootElement().style.marginLeft = "1rem";
        this._searchButton.getRootElement().style.width = "6rem";
        searchOption.appendChild(this._searchButton.getRootElement());

        searchBox.appendChild(searchOption);

        this.getView().header.getRootElement().after(searchBox);
    }
}

UTItemDetailsNavigationController.prototype.setSquadContext = function(e) {
    var t = this.getRootController();
    this.squadContext = e;
    t instanceof UTItemDetailsViewController && t.setSquadContext(e);
}
}
