export function installClubSelectSearchPatches(deps) {
  const { call, events, info, fy, repositories, services } = deps;
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
    }else if("_fsuInPacks" in this && this._fsuInPacks){
        events.showLoader()
        const index = this.clubViewModel.getIndex()
        if(info.inpacks.defIds.length === 0){
            void 0;
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
                (_e) => {
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
}

UTItemDetailsNavigationController.prototype.setSquadContext = function(e) {
    var t = this.getRootController();
    this.squadContext = e;
    t instanceof UTItemDetailsViewController && t.setSquadContext(e);
}
}
