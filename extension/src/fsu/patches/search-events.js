export function installSearchPatches(deps) {
  const { call, events, info, isPhone, cntlr, fy } = deps;
  events.playerSearchCountShow = (e) => {
    if(_.has(e,"_fsuFiltersCount")){
        let filterToPlayer = {"nation":"nationId","league":"leagueId","club":"teamId","rarity":"rareflag","playStyle":"playStyle"},
            criteriaDefault = {"nation":-1,"league":-1,"club":-1,"rarity":[],"position":"any","level":"any","playStyle":-1},
            excludeCriteria = _.cloneDeep(e.criteria.searchCriteria);


        let controller = isPhone() ? cntlr.current() : cntlr.current().className == "UTMyClubSearchFiltersViewController" ? cntlr.current() : cntlr.right();

        let basePlayers,fsuCriteria = {"unlimited":true},readFillMode = false;


        //判断所处的界面来识别对应的获取基础数据的方式
        if("squad" in controller && controller.squad.isSBC()){

            if(controller.getParentViewController() && "_fsuFillArray" in controller.getParentViewController() && controller.getParentViewController()._fsuFillArray.length){
                readFillMode = true;
                fsuCriteria.unlimited = false;
            }
        }
        if(readFillMode){
            basePlayers = controller.getParentViewController()._fsuFillArray;
        }else{
            //剔除自身的选项
            let currentFilter = e.setId == "rarity" ? "rarities" : e.setId,
                currentFilterDefault = criteriaDefault[e.setId];

            excludeCriteria[currentFilter] = currentFilterDefault;
            if(e.setId == "position" && excludeCriteria.zone !== -1){
                excludeCriteria.zone = -1;
            }
            basePlayers = repositories.Item.club.search(excludeCriteria)
        }

        if(basePlayers.length){
            basePlayers = events.getItemBy(2,fsuCriteria,false,basePlayers);
            let resultMap = new Map(),groupedData = [];
            if(_.has(filterToPlayer,e.setId)){
                groupedData = _.groupBy(basePlayers, filterToPlayer[e.setId]);
            }else if(e.setId == "level"){
                groupedData = _.groupBy(basePlayers, i => {
                    if(i.isSpecial()){
                        return 3;
                    }else{
                        if(i.isBronzeRating()){
                            return 0;
                        }else if(i.isSilverRating()){
                            return 1;
                        }else{
                            return 2;
                        }
                    }
                });
            }else if(e.setId == "position"){
                let fuzzyPos = {
                    1: 130, 2: 130, 3: 130, 4: 130, 5: 130,
                    6: 130, 7: 130, 8: 130, 9: 131, 10: 131,
                    11: 131, 12: 131, 13: 131, 14: 131, 15: 131,
                    16: 131, 17: 131, 18: 131, 19: 131, 20: 132,
                    21: 132, 22: 132, 23: 132, 24: 132, 25: 132,
                    26: 132, 27: 132
                };

                groupedData = basePlayers.reduce((acc, item) => {
                    function posToPa(p,a){
                        a.push(p)
                        if(p > 0){
                            a.push(fuzzyPos[p])
                        }
                    }
                    let posArray = [];
                    if(excludeCriteria.preferredPositionOnly){
                        posToPa(item.preferredPosition,posArray)
                    }else{
                        item.possiblePositions.forEach(p => {
                            posToPa(p,posArray)
                        });
                    }
                    _.map(_.uniq(posArray),p => {
                        acc[p] = (acc[p] || 0) + 1;
                    })
                    return acc;
                }, {});
            }
            if(_.size(groupedData)){
                for (const key in groupedData) {
                    resultMap.set(key, _.isNumber(groupedData[key]) ? groupedData[key] : _.size(groupedData[key]));
                }
            }

            let list = isPhone() ? e.__picker.querySelectorAll("option") : e.__list.querySelectorAll("li"),
                oCount = [];
            for (let [index, element] of list.entries()) {
                let id = e.options[index].id,count = resultMap.get(`${id}`);
                if(count){
                    if(isPhone()){
                        element.append(events.createDF(`(${count})`));
                    }else{
                        element.style.position = "relative";
                        element.append(events.createDF(`<span class="fsu-fcount">${count}</span>`));
                    }
                    oCount.push(count);
                }else{
                oCount.push(0);
                }
            }
            if(e.hasOwnProperty(`_fsu${e.setId}`)){
                e[`_fsu${e.setId}`]["_oCount"] = oCount;
            }
        }
    }
}

//PC下添加数量
UTDropDownControl.prototype.open = function(){
    call.search.dropdownOpen.call(this)
    events.playerSearchCountShow(this);
}
events.searchFill = async(e) =>{
    let c = e.viewmodel.searchCriteria,t = e.parentViewController._fsuFillType,
        p = e.parentViewController._fsuFillArray,
        fs = e.parentViewController._fsuFillSort || 3,
        r = "_fsuFillRange" in e.parentViewController ? e.parentViewController._fsuFillRange : [45,99];



    if("_fsuFillFirst" in e.parentViewController && e.parentViewController._fsuFillFirst){
        c.ovrMin = r[0]
        c.ovrMax = r[1]
        e.parentViewController._fsuFillFirst = false
    }
    if(t%2 !== 1){

        //25.07 修复搜索评分选择问题
        let SLn = services.Localization,
            ovrRO = e.getView()._filterContainer._ovrRangeOptions,
            ovrRD = e.getView()._filterContainer.__ovrRangeDescription;

        ovrRO.initWith(r[0], r[1], SLn.localize("search.ovrRange.input.min"), SLn.localize("search.ovrRange.input.max"))
        ovrRD.textContent = SLn.localize("search.ovrRange.description").replace(/45/, r[0]).replace(/99/, r[1])
        ovrRO.setMinValue(c.ovrMin)
        ovrRO.setMaxValue(c.ovrMax)

    }

    if(t !== 1 && t%2 == 1){
        let s = new UTSearchCriteriaDTO(),
            not,
            sort = _.split(_.replace(_.toLower(SearchSortID[fs]),"rating","ovr"), '_');
        s._type = "player";
        s.count = 21;
        switch(t){
            case 3:
                s.sortBy = Object.keys(info.criteria).length ? info.criteria.sortBy : sort[0];
                s._sort = Object.keys(info.criteria).length ? info.criteria._sort : sort[1];
                not = "notice.duplicateloading";
                break
            case 5:
                s.sortBy = sort[0];
                s._sort = sort[1];
                not = "notice.appointloading";
                break
            case 7:
                s.sortBy = sort[0];
                s._sort = sort[1];
                not = "notice.chemplayerloading";
                break
            case 9:
                s.sortBy = sort[0];
                s._sort = sort[1];
                e.clubSearchType = "dream";
                _.map(p,(value,key) => {
                    s[key] = value;
                })
                not = "notice.searchconceptloading";
                break
        }
        await e.setSearchCriteria(s);
        debug.log(e)
        await e.getView().getSearchButton()._tapDetected(this);
        events.notice(not,1);
        return;
    }

    if(t && t%2 == 0){
        let pn = "";
        switch(t){
            case 4:
                pn = fy("sbc.duplicates");
                break
            case 6:
                pn = fy("sbc.appoint");
                break
            case 8:
                pn = fy("sbc.chemplayer");
                break
        }
        if("_fsuFilterBtn" in e.parentViewController){
            delete e.parentViewController._fsuFilterBtn
        }
        await e.getView().getPlayerNameSearch()._playerNameInput.setValue(pn);
        await e.getView().getPlayerNameSearch()._playerNameInput.setInteractionState(0);
        let sortId = SearchSortID[_.toUpper(`${_.replace(c.sortBy,"ovr","rating")}_${c.sort}`)];
        if(e.getView().getSortDropDown().getId() !== sortId){
            e.getView().getSortDropDown().setIndexById(sortId);
        }
        return;
    }


    debug.log("开始判断进行填充选项","此时的saveCriteria为：",info.criteria)
    if(Object.keys(info.criteria).length == 0 && t == 0){
        await e.getView().getSortDropDown().setIndexById(2);
    }else{
        if(!info.set.sbc_records) return;

        /** 25.18 范围选项设置 */
        if(_.has(info.criteria,"clubSearchType")){
            let CST = _.find(e.getView()._filterContainer.pileFilter.options, o => o.value == info.criteria.clubSearchType);
            if(CST){
                await e.getView()._filterContainer.pileFilter.setIndexById(CST.id)
            }
        }


        //交易选项匹配判断
        c._untradeables = info.criteria._untradeables;
        if(info.criteria._untradeables == "true"){
            await e.getView().getSortOptions().toggles._collection["sort-untradeable"].toggle(true);
        }else{
            await e.getView().getSortOptions().toggles._collection["sort-untradeable"].toggle(false);
        }
        //排除队伍选项匹配判断
        if(cntlr.current().className == `UTSquadSplitViewController`){
            c.excludeDefIds = [];
        }else{
            c.excludeDefIds = info.criteria.excludeDefIds;
            if(info.criteria.excludeDefIds.length > 0){
                await e.getView().getSortOptions().toggles._collection["sort-exclude-squad"].toggle(true);
            }else{
                await e.getView().getSortOptions().toggles._collection["sort-exclude-squad"].toggle(false);
            }
        }
        //排序条件选项匹配判断
        if(info.criteria.sortBy !== c.sortBy || info.criteria._sort !== c._sort){
            let sort = ["valuedesc","valueasc","ovrdesc","ovrasc","recentdesc"]
            for (let i = 0; i < sort.length; i++) {
                if(info.criteria.sortBy + info.criteria._sort == sort[i]){
                    await e.getView().getSortDropDown().setIndexById(i);
                    break;
                }
            }
        }
        //品质条件选项匹配判断
        if(info.criteria.level !== c.level){
            for (const v of e.getView()._filterContainer.filters[0].options) {
                if(v.value == info.criteria.level){
                    await e.getView()._filterContainer.filters[0].setIndexById(v.id);
                    break;
                }
            }
        }
        //稀有条件选项匹配判断
        if(info.criteria.rarities !== c.rarities){
            if(info.criteria.rarities.length == 1){
                await e.getView()._filterContainer.filters[1].setIndexById(info.criteria.rarities[0])
            }
        }
        //位置条件选项匹配判断
        if(info.criteria._position == "any"){
            await e.getView()._filterContainer.filters[2].setIndexById(-1)
        }else{
            let posId = -1;
            let slot = isPhone() ? cntlr.current().getCurrentController().iterator : cntlr.right().iterator;
            if(slot){
                posId = slot.get(slot.getIndex()).generalPosition;
            }
            await e.getView()._filterContainer.filters[2].setIndexById(posId)
        }
        if(info.criteria.nation !== c.nation){
            await e.getView()._filterContainer.filters[4].setIndexById(info.criteria.nation)
        }
        if(info.criteria.league !== c.league){
            await e.getView()._filterContainer.filters[5].setIndexById(info.criteria.league)
        }
        if(info.criteria.club !== c.club){
            await e.getView()._filterContainer.filters[6].setIndexById(info.criteria.club)
        }
        if(t == 1){
            setTimeout(() => {
                e.getView().getSearchButton()._tapDetected(this);
            }, 50);
            events.notice("notice.quicksearch",1);
            debug.log("快捷添加状态变为",0)
            return;
        }
    }
}

UTPaginatedItemListView.prototype.setPaginationState = function(t, e) {
    call.search.result.call(this , t ,e)
    if(this._interactionState){
        if(cntlr.current().hasOwnProperty("_squad")){
            if(cntlr.current()._squad.isSBC()){
                let w;
                if(isPhone()){
                    w = cntlr.current().currentController;
                }else{
                    w = cntlr.right();
                }
                if(w.searchCriteria){
                    if(w.getParentViewController()._fsuFillType == 0){
                        info.criteria = JSON.parse(JSON.stringify(w.searchCriteria));
                        info.criteria.clubSearchType = w.clubSearchType;
                    }
                }
            }
        }
    }
}
events.searchInput = (c) => {
    if(!info.set.sbc_input) return;
    for (let i of ["club","nation","league"]) {
        let s = c.searchFilters._collection[i];
        if(!s._interactionState){ continue };
        let a = s.options.map(e => e.label);
        s.__root.setAttribute("data-f",i);
        let st = s.__label.innerText;
        s.__label.innerHTML = "";
        s.__label.style.marginRight = 0
        0;
        s.__list.style.height = "14rem";
        s.__list.style.backgroundColor = "#171826";
        s.__list.setAttribute("data-f",i);
        let ip = document.createElement("input");
        ip.classList.remove("ut-text-input-control");
        ip.classList.add("fsu-input");
        if(st == services.Localization.localize(`sbc.requirements.subType.${i}`)){
            ip.setAttribute("placeholder",st);
        }else{
            ip.setAttribute("value",st);
        }
        ip.setAttribute("maxlength","50");
        ip.setAttribute("data-f",i);
        ip._oData = a;
        ip.addEventListener('compositionstart', events.searchInputEvent);
        ip.addEventListener('compositionend', events.searchInputEvent);
        ip.addEventListener('input', events.searchInputEvent);
        ip.addEventListener('blur', events.searchInputEvent);
        ip.addEventListener('focus', events.searchInputEvent);
        s[`_fsu${i}`] = ip;
        s.__label.append(s[`_fsu${i}`]);
    }
}
events.searchInputEvent = (e) => {
    let iz = cntlr.current().getView();
    if(cntlr.current().hasOwnProperty("rightController")){
        iz = cntlr.right().getView();
    }
    if(e.type == "compositionstart"){
        info.base.input = false;
    }
    if(e.type == "compositionend"){
        info.base.input = true;
    }
    if(e.type == "input"){
        setTimeout(() => {
            if(info.base.input){
                let v = e.target.value;
                let f = e.target.getAttribute("data-f");
                let z = (iz._filterContainer || iz._searchFilters._filterContainer).searchFilters._collection[f];
                let p = `ul[data-f='${f}'] li`;
                if(!z.isOpen){
                    z.open()
                }
                e.target._oData.forEach(function(el, i) {
                    let a = document.querySelectorAll(p)[i],c = info.set.sbc_icount && "_oCount" in e.target ? (e.target._oCount[i] >= Number(v) ? true : false) : false;
                    if(el.includes(v) || c){
                        a.classList.remove("hide");
                    }else{
                        a.classList.add("hide");
                    }
                })
            }
        }, 0);
    }
    if(e.type == "blur"){
        let v = e.target.value;
        let f = e.target.getAttribute("data-f");
        let z = (iz._filterContainer || iz._searchFilters._filterContainer).searchFilters._collection[f];
        if(v !== z.label){
            if(z.id == -1){
                e.target.value = "";
            }else{
                e.target.value = z.label;
            }
        }
    }
    if(e.type == "focus"){
        e.target.value = "";
    }
}
}

export function registerSearchEvents(deps) {
  const { call, events, info, cntlr, isPhone } = deps;
  UTItemSearchView.prototype.setFilters = function(e, t) {
    call.search.filters.call(this,e, t)
    if(e.searchCriteria.type == "player" && !isPhone()){
        events.searchInput(this)
    }
    //选项球员数量统计
    if(e.searchCriteria.type == "player" && e.searchFeature == "club" && info.set.sbc_icount){
        _.map(this.searchFilters.values(),i => {
            i._fsuFiltersCount = 1;
            i.criteria = e;
            if(isPhone() && !cntlr.current()._fsuFillType%2){
                events.playerSearchCountShow(i);
            }
        })
    }
}
}
