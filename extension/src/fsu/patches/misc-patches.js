export function registerMiscEvents(deps) {
  const { events } = deps;
  events.jsonToItemEntity = (json, isUntradeable) => {
    const baseItem = {
        "assetId": 0,
        "assists": 0,
        "attributeArray": [0, 0, 0, 0, 0, 0],
        "baseTraits": [],
        "cardsubtypeid": 2,
        "contract": 7,
        "discardValue": 0,
        "formation": "f3412",
        "gender": 0,
        "id": 0,
        "injuryGames": 0,
        "injuryType": "none",
        "itemState": "free",
        "itemType": "player",
        "lastSalePrice": 0,
        "leagueId": 0,
        "lifetimeAssists": 0,
        "lifetimeStatsArray": [0, 0, 0, 0, 0],
        "loyaltyBonus": 1,
        "marketDataMaxPrice": 0,
        "marketDataMinPrice": 0,
        "nation": 0,
        "owners": 1,
        "pile": 7,
        "playStyle": 250,
        "plusRoles": [],
        "possiblePositions": [],
        "preferredPosition": "",
        "preferredfoot": 1,
        "rareflag": 0,
        "rating": 0,
        "resourceGameYear": 2026,
        "resourceId": 0,
        "skillmoves": 0,
        "statsArray": [0, 0, 0, 0, 0],
        "teamid": 0,
        "timestamp": 0,
        "untradeable": true,
        "weakfootabilitytypecode": 0
    }
    const items = _.map(json.packItem.items, i => _.assign({}, baseItem, {
        assetId: i.id,
        resourceId: i.id,
        rating: i.rating,
        preferredPosition: _.get(_.find(i.positions, { isPreferred: true }), 'name', ''),
        teamid: _.get(i, 'club.id', 0),
        leagueId: _.get(i, 'league.id', 0),
        nation: _.get(i, 'nation.id', 0),
        attributeArray: _.values(i.attributes || {}),
        skillmoves: (i.skills || 1) - 1,
        weakfootabilitytypecode: i.weekFoot ?? 0,
        preferredfoot: i.foot ?? 1,
        possiblePositions: _.map(i.positions, "name"),
        baseTraits: _.map(_.filter(i.traits, { isIcon: false }), 'id'),
        iconTraits: _.map(_.filter(i.traits, { isIcon: true }), 'id'),
        rareflag: _.get(i, 'rarity.id', 0),
        untradeable: isUntradeable
    }));
    let itemFactory = new UTItemEntityFactory;
    if(items && items.length){
        return _.map(items,i => {return itemFactory.createItem(i)});
    }else{
        return false;
    }
}
}

export function installMiscPatches(deps) {
  const { events } = deps;

//** 25.21 其他界面进入未分配列表 */
events.goToUnassigned = (controller) => {
    repositories.Item.unassigned.reset();
    services.Item.requestUnassignedItems().observe(controller, (e, t) => {
        if(e.unobserve(controller),t.success && JSUtils.isObject(t.response)){
            if(0 < t.response.items.length){
                const nowController = controller && controller instanceof EAViewController ? controller : cntlr.current();
                UTStoreViewController.prototype.gotoUnassigned.call(nowController);
            }
        }
    });
}
}
