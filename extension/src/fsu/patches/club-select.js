export function installClubSelectPatches(deps) {
  const { call, events, info, fy, cntlr, isPhone, repositories, services, debug } = deps;
  UTSelectItemFromClubViewController.prototype.requestItems = function() {
    if(this.clubViewModel.canShowPage() && !this.clubViewModel.shouldRequestItems()){
        this.updateItemList(this.clubViewModel.getPageItems())
    }else{
        let method = true,resultPlayers;
        if(this.squad.isSBC()){
            const searchView = this?.getParentViewController()?.getPreviousController().getView();
            const type = this.getParentViewController()._fsuFillType;
            //25.22 解决同地区假想搜索卡死问题
            if (![1, 2, 9].includes(type)) {
                let players = _.clone(this.getParentViewController()._fsuFillArray),
                sort = _.split(_.replace(_.toLower(SearchSortID[this.getParentViewController()._fsuFillSort]), "rating", "ovr"), '_');

                //25.21 升降序显示错误问题，尤其是仓库按钮。
                if (this.getParentViewController()._fsuFillSort == 2) {
                    players = _.orderBy(players, "rating", "desc");
                }
                if (searchView && _.isArray(players)) {
                    if (type > 3 && type % 2 == 0) {
                        method = false;
                        let repository = new UTItemRepository();
                        for (const i of players) {
                            repository.set(i.id, i);
                        }
                        resultPlayers = repository.search(this.searchCriteria);
                    } else if (type % 2 == 1 && type > 1) {
                        method = false;
                        resultPlayers = players;
                    }
                }
            }
        }

        if(this?.squad?.isSBC() === true && this?._fsu && this._fsu?.displayPlayers){
            method = false;
            resultPlayers = this._fsu.displayPlayers;

            // 设置头部导航
            if(isPhone()){
                this.getNavigationController().setNavigationVisibility(!0, !0)
            }
        }

        // debug.log(this.searchCriteria)
        // debug.log(resultPlayers)
        // debug.log(range)
        // debug.log(method)
        if(method){
            this.searchCriteria.count = 200;
            call.selectClub.request.call(this);
        }else{
            this.handleItemRetrieval(resultPlayers,true)
        }

    }
}

//25.07 插入筛选项目
//26.04 筛选项目重新计算
UTSelectItemFromClubViewController.prototype.handleItemRetrieval = function(t, e) {
    

    let showItems = t;
    if (this?.squad?.isSBC() === true) {

        //移除阵容中成员
        const baseIds = _.map(this.squad.getPlayers(),"item.databaseId");
        showItems = showItems.filter(
            i => !baseIds.includes(i.databaseId)
        );

        if(showItems.length){
            this._fsu ??= {};
            this._fsu.Players = showItems;

            //默契度计算
            const items = _.map(this.squad.getFieldPlayers(), i => {return i.inPossiblePosition ? i.item : {teamId: -1, leagueId: -1, nationId: -1}});;
            this._fsu.chemistry = {};
            const baseChemistry = events.calculateChemistry(items, this.slotIndex);
            const slotPosition = this.squad.getSlot(this.slotIndex).position.typeId;
            _.forEach(showItems, item => {

                let chemistry = { squad: baseChemistry.totalChemistry, points: baseChemistry.playerChemistry };

                if (item.possiblePositions.includes(slotPosition)) {
                    const { totalChemistry: squad, playerChemistry: points } = events.calculateChemistry(items, this.slotIndex, item);
                    chemistry = { squad, points };
                }

                this._fsu.chemistry[item.definitionId] = chemistry;
            });

            const currentPosition = this.squad.getFormation().getPosition(this.slotIndex);
            const listControl = {
                priority: "rating",
                rating: {
                    type: "sort",
                    visible: true,
                    order: "asc"
                },
                chemistry: {
                    type: "sort",
                    visible: true,
                    order: "desc"
                },
                position: {
                    type: "filter",
                    id: currentPosition.typeId,
                    name: currentPosition.typeName,
                    visible: true,
                    select: 0,
                },
                quality: {
                    type: "filter",
                    visible: true,
                    select: 0
                },
                scope: {
                    type: "filter",
                    visible: true,
                    select: 0
                }
            };
            this._fsu.listControl = listControl;

            //排序计算
            const { max, min } = showItems.reduce(
                (acc, { rating }) => {
                    if (rating > acc.max) acc.max = rating;
                    if (rating < acc.min) acc.min = rating;
                    return acc;
                },
                { max: -Infinity, min: Infinity }
            );

            if(!this.squad._fsu.hasChemistry){
                listControl.chemistry.visible = false;
                listControl.chemistry.order = null;
            } else {
                listControl.priority = "chemistry";
            }
            
            if(max == min){
                listControl.rating.visible = false;
                listControl.rating.order = null;
            } else {
                const hasRating = this.squad._fsuHasRating;
                if(hasRating !== 0){
                    if(max - hasRating < min - hasRating){
                        listControl.rating.order = "desc";
                    }
                }
            }
            
            //LT和GT强制修正顺序
            if(this._fsu?.fsuCriteria){
                if(this._fsu.fsuCriteria?.LTrating){
                    listControl.rating.order = "desc";
                } else if(this._fsu.fsuCriteria?.GTrating){
                    listControl.rating.order = "asc";
                }
            }


            //计算筛选项
            let hasCurrentPosition = false;
            let hasOtherPosition = false;

            let hasBasicQuality = false;
            let hasOtherQuality = false;
            let hasStorage = false;

            for (const i of showItems) {
                const match = i.possiblePositions.includes(currentPosition.typeId);

                if (match) {
                    hasCurrentPosition = true;
                } else {
                    hasOtherPosition = true;
                }

                if ([0, 1].includes(i.rareflag)) {
                    hasBasicQuality = true;
                } else {
                    hasOtherQuality = true;
                }

                if (i.pile === ItemPile.STORAGE) {
                    hasStorage = true;
                }

                // 所有状态都已确定，可提前退出
                if (
                    hasCurrentPosition &&
                    hasOtherPosition &&
                    hasBasicQuality &&
                    hasOtherQuality &&
                    hasStorage
                ) {
                    break;
                }
            }


            listControl.position.visible = hasCurrentPosition && hasOtherPosition;
            listControl.quality.visible = hasBasicQuality && hasOtherQuality;
            listControl.scope.visible = hasStorage;


            //debug.log("筛选排序初始化：", listControl)

            //显示筛选项
            if (this.view?._list) {

                const controller = this;
                let SortFilterBox = events.createElementWithConfig("div", {
                    classList: "fsu-SortFilterBox"
                })

                if(listControl.rating.visible){
                    let ratingSort = events.createElementWithConfig("div", {
                        classList: "fsu-SortFilterItem"
                    })
                    ratingSort.appendChild(events.createElementWithConfig("div", {
                        textContent: fy("listfilter.title.rating"),
                        classList: "fsu-SortFilterTitle"
                    }))
                    let ratingSortBtn = events.createButton(
                        new UTStandardButtonControl(),
                        fy(`listfilter.sort.${listControl.rating.order}`),
                        async(e) => {
                            if(listControl.priority == "rating"){
                                listControl.rating.order = listControl.rating.order === "asc" ? "desc" : "asc";
                                e.setText(fy(`listfilter.sort.${listControl.rating.order}`));
                            }else{
                                listControl.priority = "rating";
                                controller._fsu.chemistrySortBtn.removeClass("priority");
                                e.addClass("priority");
                            }
                            events.listSortFilter(controller, listControl)
                        },
                        "accordian fsu-SortFilterBtn"
                    );
                    ratingSort.appendChild(ratingSortBtn.getRootElement());
                    this._fsu.ratingSort = ratingSort;
                    this._fsu.ratingSortBtn = ratingSortBtn;
                    SortFilterBox.appendChild(ratingSort);
                }
                
                if(listControl.chemistry.visible){
                    let chemistrySort = events.createElementWithConfig("div", {
                        classList: "fsu-SortFilterItem"
                    })
                    chemistrySort.appendChild(events.createElementWithConfig("div", {
                        textContent: fy("listfilter.title.chemistry"),
                        classList: "fsu-SortFilterTitle"
                    }))
                    let chemistrySortBtn = events.createButton(
                        new UTStandardButtonControl(),
                        fy(`listfilter.sort.${listControl.chemistry.order}`),
                        async(e) => {
                            if(listControl.priority == "chemistry"){
                                listControl.chemistry.order = listControl.chemistry.order === "asc" ? "desc" : "asc";
                                e.setText(fy(`listfilter.sort.${listControl.chemistry.order}`));
                            }else{
                                listControl.priority = "chemistry";
                                controller._fsu.ratingSortBtn.removeClass("priority");
                                e.addClass("priority");
                            }
                            events.listSortFilter(controller, listControl)
                        },
                        "accordian fsu-SortFilterBtn"
                    );
                    chemistrySort.appendChild(chemistrySortBtn.getRootElement());
                    this._fsu.chemistrySort = chemistrySort;
                    this._fsu.chemistrySortBtn = chemistrySortBtn;
                    if(listControl.priority == "chemistry"){
                        SortFilterBox.prepend(chemistrySort);
                        chemistrySortBtn.addClass("priority");
                    }else{
                        this._fsu.ratingSortBtn.addClass("priority");
                        SortFilterBox.appendChild(chemistrySort);
                    }
                }

                if(listControl.position.visible){
                    let positionFilter = events.createElementWithConfig("div", {
                        classList: "fsu-SortFilterItem"
                    })
                    positionFilter.appendChild(events.createElementWithConfig("div", {
                        textContent: fy("listfilter.title.position"),
                        classList: "fsu-SortFilterTitle"
                    }))
                    let positionFilterBtn = events.createButton(
                        new UTStandardButtonControl(),
                        fy(`listfilter.select.all`),
                        async(e) => {
                            listControl.position.select = listControl.position.select === 0 ? 1 : 0;
                            let eTitle = listControl.position.select ? ["listfilter.select.position", listControl.position.name] : "listfilter.select.all";
                            e.setText(fy(eTitle));
                            events.listSortFilter(controller, listControl)
                        },
                        "accordian fsu-SortFilterBtn"
                    );
                    positionFilter.appendChild(positionFilterBtn.getRootElement());
                    this._fsu.positionFilter = positionFilter;
                    this._fsu.positionFilterBtn = positionFilterBtn;
                    SortFilterBox.appendChild(positionFilter);
                }

                if(listControl.quality.visible){
                    let qualityFilter = events.createElementWithConfig("div", {
                        classList: "fsu-SortFilterItem"
                    })
                    qualityFilter.appendChild(events.createElementWithConfig("div", {
                        textContent: fy("listfilter.title.quality"),
                        classList: "fsu-SortFilterTitle"
                    }))
                    let qualityFilterBtn = events.createButton(
                        new UTStandardButtonControl(),
                        fy(`listfilter.select.all`),
                        async(e) => {
                            let titleSuffix = ["all", "normal", "special"]
                            listControl.quality.select = (listControl.quality.select + 1) % 3;
                            e.setText(fy(`listfilter.select.${titleSuffix[listControl.quality.select]}`));
                            events.listSortFilter(controller, listControl)
                        },
                        "accordian fsu-SortFilterBtn"
                    );
                    qualityFilter.appendChild(qualityFilterBtn.getRootElement());
                    this._fsu.qualityFilter = qualityFilter;
                    this._fsu.qualityFilterBtn = qualityFilterBtn;
                    SortFilterBox.appendChild(qualityFilter);
                }

                if(listControl.scope.visible){
                    let scopeFilter = events.createElementWithConfig("div", {
                        classList: "fsu-SortFilterItem"
                    })
                    scopeFilter.appendChild(events.createElementWithConfig("div", {
                        textContent: fy("listfilter.title.scope"),
                        classList: "fsu-SortFilterTitle"
                    }))
                    let scopeFilterBtn = events.createButton(
                        new UTStandardButtonControl(),
                        fy(`listfilter.select.all`),
                        async(e) => {
                            let titleSuffix = ["all", "storage", "club"]
                            listControl.scope.select = (listControl.scope.select + 1) % 3;
                            e.setText(fy(`listfilter.select.${titleSuffix[listControl.scope.select]}`));
                            events.listSortFilter(controller, listControl)
                        },
                        "accordian fsu-SortFilterBtn"
                    );
                    scopeFilter.appendChild(scopeFilterBtn.getRootElement());
                    this._fsu.scopeFilter = scopeFilter;
                    this._fsu.scopeFilterBtn = scopeFilterBtn;
                    SortFilterBox.appendChild(scopeFilter);
                }

                this._fsu.SortFilterBox = SortFilterBox;
                this.view._list.getRootElement().before(SortFilterBox);

                events.listSortFilter(this, listControl);
                return;
            }
        }

    }

    call.selectClub.handle.call(this, showItems, e);

}
//25.07 设置搜索列表筛选器标题
events.setListFilterTitleAndState = (element,players,initPlayers) => {

    let parentElement = element[1]._parent;
    //判断评分排序
    let rBtn = element[1];
    let currentRating = _.map(players,"rating");
    if(_.isEqual(currentRating, _.reverse(_.sortBy(currentRating)))){
        rBtn._state = 1;
        rBtn.setText("√" + rBtn._text[1])
    }else if(_.isEqual(currentRating, _.sortBy(currentRating))){
        rBtn._state = 0;
        rBtn.setText("√" + rBtn._text[0])
    }else{
        rBtn._state = 1;
        rBtn.setText("×" + rBtn._text[1])
    }
    if(_.every(currentRating, (num) => num === currentRating[0])){
        rBtn.setInteractionState(0);
    }else{
        rBtn.setInteractionState(1);
    }

    //判断默契排序
    let currentChem;
    let cBtn = element[4];
    if(!("_fsuAllChem" in parentElement)){
        let chems = {};
        let squadPlayers = _.map(parentElement.squad.getPlayers(),s => {
            return s.index == parentElement.slotIndex ? null : s.item
        })
        let squadFormation = parentElement.squad.getFormation();
        let squadManager = parentElement.squad.getManager().item;
        _.map(players,p => {
            squadPlayers[parentElement.slotIndex] = p;
            let chem = parentElement.chemCalculator.calculate(squadFormation,squadPlayers,squadManager)
            chems[p.id] = chem.chemistry
        })
        parentElement._fsuAllChem = chems
        currentChem = chems
    }else{
        currentChem = _.map(players,p => {return parentElement._fsuAllChem[p.id]});
    }
    if(_.isEqual(currentChem, _.reverse(_.sortBy(currentChem)))){
        cBtn._state = 1;
        cBtn.setText("√" + cBtn._text[1])
    }else if(_.isEqual(currentChem, _.sortBy(currentChem))){
        cBtn._state = 0;
        cBtn.setText("√" + cBtn._text[0])
    }else{
        cBtn._state = 0;
        cBtn.setText("×" + cBtn._text[0])
    }
    if(_.every(currentChem, (num) => num === _.get(_.values(currentChem), 0, null))){
        cBtn.setInteractionState(0);
    }else{
        cBtn.setInteractionState(1);
    }


    //复合判断筛选项
    let scopeKey = _.has(element,2) ? 2 : 5;
    let tBtn = element[scopeKey],pBtn = element[3];
    let fp,afp;
    if(scopeKey == 2){

        if(!("_fsuAllStorage" in parentElement)){
            afp = _.map(_.filter(initPlayers,p => repositories.Item.storage.get(p.id)),"id");
            parentElement._fsuAllStorage = afp;
        }else{
            afp = parentElement._fsuAllStorage;
        }
        fp = _.filter(players,p => _.includes(afp,p.id));

    }else{

        if(!("_fsuAllClub" in parentElement)){
            let pIds = _.map(initPlayers,"id");
            afp = events.getItemBy(1,{"definitionId":pIds})
            parentElement._fsuAllClub = afp;
        }else{
            afp = parentElement._fsuAllClub;
        }

        fp = _.filter(players,p => _.includes(afp,p.id));
    }

    tBtn._state = players.length == fp.length && players.length !== 0 ? 1 : 0;
    tBtn.setText(tBtn._text[tBtn._state])



    let pp,app;
    if(!("_fsuPosPlayers" in parentElement)){
        app = _.map(_.filter(initPlayers,p => _.includes(p.possiblePositions,pBtn._pos.typeId)),"id");
        parentElement._fsuPosPlayers = app;
    }else{
        app = parentElement._fsuPosPlayers;
    }
    pp = _.filter(players,p => _.includes(app,p.id));

    pBtn._state = players.length == pp.length ? 1 : 0;
    pBtn.setText(pBtn._text[pBtn._state])



    if(afp.length == initPlayers.length || afp.length == 0 || players.length == 0 || (pBtn._state == 1 && fp.length == 0)){
        tBtn.setInteractionState(0);
    }else{
        tBtn.setInteractionState(1);
    }

    if(app.length == initPlayers.length || app.length == 0 || players.length == 0 || (tBtn._state == 1 && pp.length == 0)){
        pBtn.setInteractionState(0);
    }else{
        pBtn.setInteractionState(1);
    }

}

//25.07 进行筛选数据
events.listFilterData = (element,type) => {
    let players = _.cloneDeep(element._fsuInitPlayers);


    const evaluateState = (state, typeNumber) => {
        if (type === typeNumber) {
        return state === 0 ? 1 : 0; // 翻转状态
        }
        return state; // 正常状态
    }

    if(_.has(element._fsulistfilter,3)){
        if(evaluateState(element._fsulistfilter[3]._state,3)){
            players = _.filter(players,p => _.includes(element._fsuPosPlayers,p.id))
        }
    }

    if(_.has(element._fsulistfilter,2)){
        if(evaluateState(element._fsulistfilter[2]._state,2)){
            players = _.filter(players,p => _.includes(element._fsuAllStorage,p.id))
        }
    }

    if(_.has(element._fsulistfilter,5)){
        if(evaluateState(element._fsulistfilter[5]._state,5)){
            players = _.filter(players,p => _.includes(element._fsuAllClub,p.id))
        }
    }



    const getChem = (p) => {
        return element._fsuAllChem[p.id];
    }
    let orderKey = [];
    let orders = [];

    if(_.has(element._fsulistfilter,1)){
        orders.push(evaluateState(element._fsulistfilter[1]._state,1) ? "desc" : "asc")
    }

    if(_.has(element._fsulistfilter,4)){
        orders.push(evaluateState(element._fsulistfilter[4]._state,4) ? "desc" : "asc")
    }

    if(type == 4 || (element._fsulistfilter[4].getRootElement().textContent.includes('√') && type !== 1)){
        orderKey = [getChem,"rating"]
        orders = _.reverse(orders);
    }else{
        orderKey = ["rating",getChem]
    }

    players = _.orderBy(players, orderKey, orders);


    //debug.log(players)

    element.clubViewModel.resetCollection(players);
    element.updateItemList(element.clubViewModel.getPageItems());
    element.clubViewModel.isFull = true;
    if(players.length == 0){
        element.getView()._list.__itemList.style.height = "auto";
    }else{
        element.getView()._list.__itemList.style.height = "calc(100% - 7rem)";
    }
    events.setListFilterTitleAndState(element._fsulistfilter,players,element._fsuInitPlayers)

}

//UTGameRewardsViewController.onButtonTapped → installRewardPatches
// 25.22 等待loading后回调事件
events.waitForClickShieldToHide = (callback, timeout = 5000) => {
    const start = Date.now();

    const interval = setInterval(() => {
        if (!gClickShield.isShowing()) {
            clearInterval(interval);
            callback(); // 执行后续逻辑
        } else if (Date.now() - start > timeout) {
            clearInterval(interval);
            console.warn("等待 gClickShield 隐藏超时");
        }
    }, 100); // 每 100ms 检查一次
}

// 25.22 移除进化重复图标问题
const UTItemEntityGetPlusPlayStyles = UTItemEntity.prototype.getPlusPlayStyles;
UTItemEntity.prototype.getPlusPlayStyles = function () {
    const result = UTItemEntityGetPlusPlayStyles.call(this);
    return _.uniqWith(result, (a, b) => a.equals(b));
};
// 25.22 加速类型计算
events.getAcceleRate = (player, chem = 3, styleId = player.playStyle) => {
    const height = player.getMetaData()?.height ?? 0;
    const gender = player.gender;
    const acceleration = events.getBoostedAttribute(player, styleId, chem, 0);
    const agility = events.getBoostedAttribute(player, styleId, chem, 2);
    const strength = events.getBoostedAttribute(player, styleId, chem, 6);

    let type;
    if (agility >= 80 && (agility - strength) >= 10 && acceleration >= 65 && height <= (gender ? 162 : 182)) {
        type = 'E'; // Explosive 爆发
    }
    else if (strength >= 65 && (strength - agility) >= 4 && acceleration >= 40 && height >= (gender ? 165 : 185)) {
        type = 'L';  // Lengthy 漫长
    }
    else {
        type = 'C';  // Controlled 掌控
    }
    // debug.log(player.id, { height, acceleration, agility, strength , styleId} , type);
    return type;
}
// 25.22 加速类型介绍弹窗
events.accelePopup = (player, isLoadMeta) => {
    let sl = services.Localization;
    gClickShield.showShield(EAClickShieldView.Shield.LOADING);
    const currentStyleId = player.playStyle;
    const styleIds = _.range(250, 269);
    
    services.PlayerMetaData.updateItemPlayerMeta([player]).observe(cntlr.current(), function (t, e) {
        t.unobserve(cntlr.current());
        const acceleToGroup = {};
        styleIds.forEach(styleId => {
            acceleToGroup[styleId] = events.getAcceleRate(player, 3, styleId);
        });
        const acceleResults = _.groupBy(styleIds, styleId => acceleToGroup[styleId]);
        const currentResult = acceleToGroup[currentStyleId];
        _.forEach(
            document.querySelectorAll(`.fsu-cards-accele[data-defid="${player.definitionId}"]`),
            el => {
                if (el.textContent.includes('*')) {
                    el.textContent = currentResult
                }
            }
        );
        const currentStyleText = sl.localize(`playstyles.playstyle${currentStyleId}`);
        const currentResultText = fy(`accelerate.type.${currentResult}`);
        const acceleResultsHtml = [];
        _.forEach(acceleResults, (value, key) => {
            let resultsHtml = `<div style="display: flex; align-items: center; justify-content: flex-start; gap: 0px 10px; flex-flow: row wrap;"><div class="color: white;">${fy(`accelerate.type.${key}`)} : </div>`
            _.forEach(value,i => {
                resultsHtml += `<div class="item" style="display: flex; align-items: center;"><div class="playStyle chemstyle${i}" style="font-size: 18px; margin-right: 6px;"></div><div>${services.Localization.localize(`playstyles.playstyle${i}`)}</div></div>`;
            })
            resultsHtml += `</div>`;
            acceleResultsHtml.push(resultsHtml);
        });
        const accelePopupText = `${fy(["accelerate.popupm",currentStyleText,currentResultText])}${acceleResultsHtml.join("<br>")}<br><br><span style="color:#a4a9b4">${fy("accelerate.popupm2")}</span>`;

        
        events.popup(
            fy("accelerate.popupt"),
            accelePopupText,
            (t) => {
            }
        )
        // debug.log(acceleResults, currentResult, accelePopupText);
        
        gClickShield.hideShield(EAClickShieldView.Shield.LOADING);
    })
}
events.getBoostedAttribute = function (player, styleId, chem, attrId) {
    const sid = String(styleId);
    const aid = String(attrId);
    const chemKey = info.chemstyle?.[sid]?.[aid];
    const bonus = chemKey ? (info.chemMap?.[String(chem)]?.[chemKey] || 0) : 0;
    return Math.min(99, player.getSubAttribute(attrId).rating + bonus);
};


// events.createElementWithConfig → ModuleRegistry




//rewards → installRewardPatches
installRewardPatches({ call, events, info, fy, cntlr, repositories, debug });


installClubHubPatches({ call, events, info, fy, cntlr, isPhone, repositories, services });
//club hub → installClubHubPatches
//读取显示锁定球员
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
