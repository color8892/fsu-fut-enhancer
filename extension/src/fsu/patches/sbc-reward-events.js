export function registerSbcRewardEvents(deps) {
  const { events, info, cntlr, isPhone, repositories, debug, oneFillCriteriaService, SBCEligibilityKey } = deps;
  events.oneFillCreationGF = (req, miss) =>
    oneFillCriteriaService.createFromRequirements(req, miss, SBCEligibilityKey);

//根据类型获取当前的view和controller
events.getCurrent = (type) => {
    let r = cntlr.current();
    if(!isPhone() && _.has(r,"leftController")){
        r = cntlr.left();
    }
    if(type && type == 2){
        r = r.getView()
    }
    return r;
}
//SBC完成后的奖励弹窗
//24.20 新插入在一键完成后出现的弹层
events.showRewardsView = (set) => {
    var rewardsController = new UTGameRewardsViewController(set.awards);
    rewardsController.init(),
    rewardsController.modalDisplayDimensions.width = "24em";
    rewardsController.getView().setSbcSet(set);
    let challenge = _.first(set.challenges.values());
    let tryAgainBtn;
    const fastInfo = info.base.fastsbc[`${challenge.id}#${set.id}`];
    const controllerType = cntlr.current().className == 'UTSBCHubViewController' ? 1 : (cntlr.current().className.includes('UTUnassignedItems') ? 2 : 0);
    if(controllerType){
        const fastCount = events.fastSBCQuantity(controllerType == 1,_.filter(repositories.Item.getUnassignedItems(), item => item.isPlayer() && item.duplicateId !== 0),fastInfo) - 1;
        if(fastInfo && fastCount >= 1){
            tryAgainBtn = events.createButton(
                new UTCurrencyButtonControl(),
                fy("trypack.button.again") + `(${fastCount})`,
                () => {
                    rewardsController.onBackButton();
                    events.isSBCCache(set.id, challenge.id);
                },
                "call-to-action fsu-challengefastbtn"
            )
            Object.assign(tryAgainBtn.getRootElement().style, {
                marginTop: ".5rem",
                width: "100%"
            });
            tryAgainBtn.__currencyLabel.innerHTML = events.getFastSbcSubText(fastInfo);
            rewardsController.getView().getRootElement().querySelector("footer").appendChild(tryAgainBtn.getRootElement());
        }
    }
    //25.21 领取并发送球员到俱乐部按钮添加
    if (controllerType == 2 && !tryAgainBtn) {
        const allArePlayers = _.every(repositories.Item.getUnassignedItems(), i => i.type === ItemType.PLAYER);
        if (allArePlayers) {
            const duplicateIds = _.map(repositories.Item.getUnassignedItems(),"duplicateId");
            const clubIds = events.getItemBy(1,{"id":duplicateIds});
            if(duplicateIds.length === 0 || clubIds.length === 0){
                debug.log("可以全部发送到俱乐部")
                const allSendClubBtn = events.createButton(
                    new UTStandardButtonControl(),
                    fy("allsendclub.button.text"),
                    () => {
                        let controller = isPhone()? cntlr.current() : cntlr.left();
                        rewardsController.onBackButton();
                        controller.storeInClub();
                    },
                    "call-to-action"
                )
                Object.assign(allSendClubBtn.getRootElement().style, {
                    marginTop: ".5rem",
                    width: "100%"
                });
                rewardsController.getView().getRootElement().querySelector("footer").appendChild(allSendClubBtn.getRootElement());
            }
        }
    }
    gPopupClickShield.setActivePopup(rewardsController);
    debug.log(rewardsController);
    debug.log(set);
    repositories.Item.setDirty(ItemPile.PURCHASED);
    setTimeout(() => {
        debug.log(_.first(set.challenges.values()).isCompleted())
        if(tryAgainBtn && _.first(set.challenges.values()).isCompleted()){
            tryAgainBtn.setInteractionState(0);
        }
    }, 50);
}
}
