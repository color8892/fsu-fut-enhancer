export function installClubSelectPatches(deps) {
  const { call, events, fy, isPhone } = deps;
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
                let players = _.clone(this.getParentViewController()._fsuFillArray);

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
}
