export function registerClubSelectEvents(deps) {
  const { events, info, cntlr, services, repositories, fy } = deps;
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
events.accelePopup = (player, _isLoadMeta) => {
    let sl = services.Localization;
    gClickShield.showShield(EAClickShieldView.Shield.LOADING);
    const currentStyleId = player.playStyle;
    const styleIds = _.range(250, 269);
    
    services.PlayerMetaData.updateItemPlayerMeta([player]).observe(cntlr.current(), function (t, _e) {
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
            (_t) => {
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







//rewards → installRewardPatches
}
