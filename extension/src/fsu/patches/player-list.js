export function registerPlayerListEvents(deps) {
  const { events, info, cntlr, debug, futbinId, priceService, GM_setValue } = deps;
  events.wait = (min,max) => {
    let delay = Math.floor(Math.random() * (max * 1000 - min * 1000 + 1)) + min * 1000;
    return new Promise(resolve => setTimeout(resolve, delay));
}
events.changeLoadingText = (t,s) =>{
    //24.18 loading文本插入换行符设置
    let text = fy(t);
    if(s && s !== ""){
        text += `<br>${fy(s)}`;
    }
    //26.02 增加loading元素添加，避免导致无法重载数据
    events.addLoadingElment();
    document.querySelector('.fsu-loading-close').innerHTML = text;
}
//批量挂拍卖
// events.losAuctionSell → ModuleRegistry

// events.losAuctionCount → ModuleRegistry
}

export function installPlayerListPatches(deps) {
  const { call, events, info, cntlr, isPhone, debug, repositories, services } = deps;
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
        //25.20 球员自动购买 移除右侧球员部分
        if(_.has(c.leftController,"_fsuAutoBuy") && _.has(c,"rightController") && c.rightController){
            c.removeRightController();
        }

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
    if(info.set.card_meta && [1, 2].includes(info.apiPlatform) && false){
        const ggrList = _.filter(items, function (i) {
            return _.has(i,"type") && i.type == "player" && i.rating >= 75 && !_.has(info.ggr,(i.definitionId)) && i.definitionId > 0;
        })
        let ggrChunks = _.chunk(ggrList, 30);
        for (let chunk of ggrChunks) {
            events.getGGRating(chunk, el);
        }
    }
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
            }catch(error) {
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
        }else if(el.className == "UTStorePackRevealModalListViewController" && "_packoddo" in el){
            let packItemsPriceElements = el.getView().getRootElement().querySelectorAll(".fsu-price-val");
            const packItesmPrices = _.sumBy(packItemsPriceElements, i => Number(i.getAttribute("data-value")));
            el.getView().getRootElement().querySelector(".trypack-count").innerText = packItesmPrices.toLocaleString();
            let sDiff = Math.round((packItesmPrices/el._packoddo-1)*100);
            let diffElement = el.getView().getRootElement().querySelector(".trypack-diff");
            if(sDiff > 0){
                diffElement.style.color = "#36b84b"
                diffElement.textContent = `+${sDiff}%`
            }else{
                diffElement.style.color = "#d21433"
                diffElement.textContent = `${sDiff}%`
            }

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

//** 25.21 读取GGRating **/
events.getGGRating = async(list,el) => {
    const now = Math.floor(Date.now() / 1000); // 当前时间（单位：秒）
    const filtered = _.map(list,"definitionId");
    if(filtered.length){
        let baseUrl = info.apiPlatform === 2 ? `${info.apiProxy}?futggapi=` : "https://www.fut.gg/api/fut/";
        const response = await events.externalRequest("GET",baseUrl + "metarank/players/?ids=" + filtered.join("%2C"));
        const originalJson = JSON.parse(response);
        _.forEach(originalJson.data, (v,k) => {
            info.ggr[v.eaId] = {
                "score": v.score,
                "position": v.position,
                "time": now
            }

            for (let i of list) {
                let ggrGrade = document.querySelector(`.fsu-cards-metarating[data-id="${i.id}"][data-defid="${i.definitionId}"]`);
                let ggrBox = document.querySelector(`.fsu-cards-meta[data-id="${i.id}"][data-defid="${i.definitionId}"]`);
                if(ggrGrade || ggrBox){
                    const ggr = events.getPlayerGGR(i);
                    if(ggr.score){
                        if(ggrGrade){
                            ggrGrade.innerText = ggr.grade;
                            ggrGrade.style.display = "block";
                        }
                        if(ggrBox){
                            const ggrBoxMrk = ggrBox.querySelector(".mrk")
                            ggrBoxMrk.innerText = ggr.grade;
                            if(info.set.card_style !== 1){
                                ggrBoxMrk.style.backgroundColor = ggr.gradeColor;
                            }
                            ggrBox.querySelector(".mpr").innerText = ggr.scoreText;
                            ggrBox.querySelector(".mrp").innerText = ggr.posText;
                            ggrBox.style.display = "";
                        }
                    }
                }
            }
            
        })
        GM_setValue("ggr", JSON.stringify(info.ggr));

        debug.log(el)
    }else{
        debug.log("无需要读取的GGRating")
    }
}
//** 25.21 读取GGRating **/
events.getPlayerGGR = (player) => {
    const result = {
        "score": 0,
        "scoreText": "0",
        "grade": "F",
        "pos": 0,
        "posText": "NONE",
        "gradeColor": "rgba(255,255,255,0.8)"
    }
    if(_.has(info.ggr,player.definitionId)){
        const grades = ["S", "A", "B", "C", "D"];
        const gradeColors = [
            "rgba(255,215,0,0.9)",     // S - 金色
            "rgba(220,38,38,0.8)",     // A - 红
            "rgba(251,146,60,0.8)",    // B - 橙
            "rgba(6,182,212,0.8)",     // C - 青
            "rgba(34,197,94,0.8)",     // D - 绿
        ];
        result.pos = info.ggr[player.definitionId].position;
        result.posText = services.Localization.localize(`extendedPlayerInfo.positions.position${result.pos}`);
        const isNoAcademy = player.academy == null || (!player.academy._attributes.length && !player.academy._baseTraits.length && !player.academy._iconTraits.length && !player.academy._skillMoves && !player.academy._weakFoot);
        result.score = info.ggr[player.definitionId].score;
        result.scoreText = result.score.toFixed(1);
        if(!isNoAcademy){
            const ratingMaxScore = info.GGRRAR.rating[result.pos][player.rating];
            if(player.rating == player._rating){
                result.score = ratingMaxScore;
            }else{
                result.score = ratingMaxScore - (player.rating - player._rating) * 0.02;
            }
            result.scoreText = `${result.score.toFixed(1)}*`;
        }
        const customSortedIndex = _.findIndex(info.GGRRAR.rank[result.pos], (value) => value <= result.score);
        if(customSortedIndex !== -1){
            result.grade = grades[customSortedIndex] + (result.score < player.rating ? " ↓" : " ↑");
            result.gradeColor = gradeColors[customSortedIndex];
        }
    }
    return result;
}
}
