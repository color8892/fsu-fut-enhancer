export function installPlayerListPatches(deps) {
  const { call, events, info, cntlr, isPhone, debug, repositories, services, fy } = deps;
  //列表形式(右侧、拍卖行搜索结果、俱乐部)球员列表 读取球员列表查询价格
UTPaginatedItemListView.prototype.renderItems = function(t) {
    call.plist.paginated.call(this,t);
    this._fsu ??= {};

    //26.04 进化球员显示增加的属性
    const currentController = isPhone() ? cntlr.current() : cntlr.right();
    if(currentController instanceof UTAcademyPlayerFromClubViewController){
        const academyId = currentController.academySlot.id;
        const academyAttr = _.find(info.academy, { id: academyId });
        const currentThis = this;
        if(academyAttr){
            this.listRows.map(function (i) {
                i._fsu ??= {};
                const attrBox = events.createElementWithConfig("div",{
                    classList: ["academyViewBox", "itemList"]
                });
                i.getRootElement().after(attrBox);
                i._fsu.attrBox = attrBox;
                currentThis._fsu[`attrBox_${i.data.id}`] = attrBox;
                if(repositories.PlayerMeta.get(i.data.definitionId)){
                    const attrMap = events.academyAttrToList(events.academyAddAttr(academyAttr.attr, academyAttr.isGK, i.data).map);
                    attrBox.appendChild(events.academyAddAttrOutput(attrMap));
                    i._fsu.attrMap = attrMap;
                    currentThis._fsu[`attrMap_${i.data.id}`] = attrMap;
                    if(attrMap.size === 0){
                        attrBox.querySelector(".academyBoostsBox").style.opacity = "0.5";
                    }
                }else{
                    attrBox.appendChild(events.createElementWithConfig("div",{
                        textContent: fy("academy.attr.load"),
                        classList: ["academyBoostsTips"],
                        style: {
                            fontSize: "12px",
                            padding: "0px"
                        }
                    }))
                }
            })
        }
    }


    this.listRows.map(function (i) {
        if(i.data.type == "player"){
            //价格高亮显示
            if(events.getCachePrice(i.data.definitionId, 3)){
                let np = events.getCachePrice(i.data.definitionId,1).num;
                if(np && i.data.getAuctionData().buyNowPrice <= np){
                    i.__auctionBuyValue.style.backgroundColor = "#36b84b"
                }
            }
        }
    })

    events.loadPlayerInfo(_.map(this.listRows,"data"));

    let c = cntlr.current(),csbc = false;

    if(isPhone()){
        if(c.hasOwnProperty("_squad") && c._squad && c._squad.isSBC()){
            csbc = true;
        }
    }else{
        if(c.hasOwnProperty("rightController") && c.rightController){
            c = cntlr.right().parentViewController;
        }
        if(c.hasOwnProperty("_squad") && c._squad.isSBC()){
            csbc = true;
        }
    }
    if(!isPhone() && c.hasOwnProperty("rightController") && c.rightController){
        c = cntlr.right().parentViewController;
    }
    if(csbc){
        if(c.getNavigationTitle() == services.Localization.localize("navbar.label.clubsearch")){
            let s = [];
            if(_.has(c,"_fsuFillArray") && c._fsuFillArray.length && c.currentController.searchCriteria.defId.length && this.listRows.length){
                s = this.listRows.map(i => {
                    if(c.currentController.searchCriteria.defId.includes(i.data.definitionId)){
                        return i.data.definitionId
                    }else{
                        i.hide()
                    }
                }).filter(Boolean);
                if(!s.length){
                    this.__itemList.prepend(events.createDF(`<div class="ut-no-results-view"><div class="contents"><span class="no-results-icon"></span><h2>${fy("emptylist.t")}</h2><p>${fy("emptylist.c")}</p></div></div>`));
                }else{
                    if(this.__itemList.querySelector(".ut-no-results-view")){
                        this.__itemList.querySelector(".ut-no-results-view").remove()
                    }
                }
            }
        }else{
            //假想球员搜索结果排除其他版本项目
            let pn = this._targets._collection.rowselect[0].target;
            if(info.set.sbc_market && pn.hasOwnProperty("pinnedItemView") && pn.pinnedItemView && pn.pinnedItemView.itemCell.data.concept){
                let z = 0;
                let pi = pn.pinnedItemView.itemCell.data.definitionId;
                this.listRows.forEach(function(i) {
                    if(i.data.definitionId !== pi){
                        i.__root.style.filter = "brightness(0.5)";
                        z++;
                    }
                })
                if(z && !isPhone()){
                    events.notice("notice.conceptdiff",1)
                }
            }
        }
    }
}

//球员预览包打开 → installStorePatches

//俱乐部卖掉球员 移除在阵容列表内球员 以便计算重复效果
UTClubRepository.prototype.removeClubItem = function(t) {
    call.plist.club.call(this,t);
    if(info.roster.thousand.hasOwnProperty(t.definitionId)){
        delete(info.roster.thousand[t.definitionId]);
    }
}

//阵容评分获取 每次球员变化都会获取 主要计算阵容整体价格
UTSquadEntity.prototype.getRating = function() {
    let r = call.plist.squadGR.call(this);
    let totalElement = document.getElementById("squadValue");
    if(totalElement){
        totalElement.innerText = _.sumBy(this.getFieldPlayers(), i => events.getCachePrice(i.item.definitionId, 1).num).toLocaleString();
    }
    return r;
}

//球员价格读取 需要传递球员ID列表(数组)
events.loadPlayerInfo = async(items, el, type) => {
    const list = _.map(
        _.filter(items, function (i) {
            return _.has(i,"type") && i.type == "player" && !events.getCachePrice(i.definitionId,3) && i.definitionId > 0;
        }),"definitionId");
    if(list.length > 0){
        let la = Array.from(new Set(list));
        let chunks = _.chunk(la, 23);
        let pu = _.cloneDeep(chunks)
        for (let k in pu) {
            let playerPrice;
            try {
                if(type){
                    playerPrice = Object.fromEntries(
                        await Promise.all(
                            pu[k].map(async i => {
                                if(_.has(info.futbinId, i)){
                                    await futbinId.getPrice(i, info.futbinId[i]);
                                    return [i, info.roster.data[i]];
                                } else {
                                    const item = items.find(it => it.definitionId === i);
                                    await futbinId.getId(item);
                                    return [i, info.roster.data[i]];
                                }
                            })
                        )
                    );
                    debug.log(playerPrice);
                }else{
                    playerPrice = await events.getPriceForUrl(pu[k]);
                }
            }catch {
                continue;
            }

            info.roster.data = Object.assign(info.roster.data,playerPrice);
            _.map(playerPrice,(v,k) => {

                if(info.roster.element[k]){
                    const priceJson = events.getCachePrice(k,1);
                    const priceType = info.priceType[priceJson.type];
                    _.map(info.roster.element[k],(i) => {
                        i.setAttribute("data-show", 1);
                        i.querySelector(".fsu-PriceValue").innerText = priceJson.text;
                        const typeElement = i.querySelector(".fsu-PriceType");
                        typeElement.innerText = priceType;
                        typeElement.setAttribute("data-content", priceType);
                        const { cs, rareflag, rating } = i.dataset;
                        if (Number(cs) == 21 && rareflag && rating && events.isPrecious(Number(rating), Number(rareflag), priceJson.num, priceJson.type)) {
                            i.classList.add("precious");
                        }
                    })
                    info.roster.element[k] = null;
                    delete info.roster.element[k];
                }

            })
        }
        let totalElement = document.getElementById("squadValue");
        if(totalElement){
            totalElement.innerText = _.sumBy(cntlr.current()._squad.getFieldPlayers(), i => events.getCachePrice(i.item.definitionId, 1).num).toLocaleString();
        }
    }
    if(el){
        //24.15 球员挑选最佳提示：拍卖后重触发挑选事件
        if(el.className == "UTPlayerPicksView" && info.set.player_pickbest){
            events.playerSelectionSort(el);
        }else if(el.className.includes('UTUnassigned') && el.className.includes('Controller') && "_fsuScreenshot" in el){
            let sPrice = 0;
            _.map(list,i => {sPrice += events.getCachePrice(i,1).num;})
            el._fsuScreenshot._header.setText(fy(["screenshot.text",list.length,sPrice.toLocaleString()]))
        }else{
            events.losAuctionCount(el,0)
        }
    }
    if(!type && list.length > 0){
        let lackPlayers = _.filter(items, function (i) {
            return _.has(i,"type") && i.type == "player" && !events.getCachePrice(i.definitionId,3) && i.definitionId > 0;
        });
        if(lackPlayers.length){
            events.loadPlayerInfo(lackPlayers, el, 2);
        }
    }
}
}
