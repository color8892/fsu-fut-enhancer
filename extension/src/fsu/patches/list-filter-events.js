export function registerListFilterEvents(deps) {
  const { events, repositories } = deps;
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
    let orders = [];

    if(_.has(element._fsulistfilter,1)){
        orders.push(evaluateState(element._fsulistfilter[1]._state,1) ? "desc" : "asc")
    }

    if(_.has(element._fsulistfilter,4)){
        orders.push(evaluateState(element._fsulistfilter[4]._state,4) ? "desc" : "asc")
    }

    const reverseOrder = type == 4 || (element._fsulistfilter[4].getRootElement().textContent.includes('√') && type !== 1);
    const orderKey = reverseOrder ? [getChem,"rating"] : ["rating",getChem];
    if(reverseOrder){
        orders = _.reverse(orders);
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
}
