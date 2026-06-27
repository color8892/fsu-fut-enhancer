export function registerSbcTileEvents(deps) {
  const { events, info, fy, cntlr, isPhone, services, GM_setValue, AssetLocationUtils } = deps;
  //24.15 头部快捷入口：SBC列表插入最前方
events.SBCListInsertToFront = (sbcId,type) => {
    if(info.set.sbc_headentrance && info.douagain.hasOwnProperty("SBCListHtml")){
        let SBCIndex = _.indexOf(info.douagain.SBCList, sbcId);
        if(SBCIndex != -1){
            info.douagain.SBCList.splice(SBCIndex, 1);
        }
        if(type == 1){
            info.douagain.SBCList.unshift(sbcId);
        }
        if(services.SBC.repository.sets.length){
            info.douagain.SBCList = _.filter(info.douagain.SBCList, SBCId => {
                const set = services.SBC.repository.getSetById(SBCId);
                return set && !set.isComplete();
            });
            info.douagain.SBCList = info.douagain.SBCList.slice(0, info.set.headentrance_number);
            info.douagain.SBCListHtml.innerHTML = ""
            //24.16 调整为读取配置显示入口数量
            _.map(info.douagain.SBCList,(item,index) => {
                let button = events.createButton(
                    new UTImageButtonControl(),
                    "",
                    (e) => {
                        events.goToSBC(services.SBC.repository.getSetById(Number(e.__root.getAttribute("data-SBCId"))));
                    },
                    ""
                )
                button.__root.setAttribute("data-SBCId",item);
                let img = events.createElementWithConfig("img", {
                    style:{
                        height:"100%",
                        width:"auto"
                    }
                })
                img.setAttribute("src",AssetLocationUtils.getSquadBuildingSetImageUri(services.SBC.repository.getSetById(item).assetId));
                button.getRootElement().appendChild(img);
                if(index >= info.set.headentrance_number){
                    button.__root.style.display = "none";
                }
                info.douagain.SBCListHtml.appendChild(button.getRootElement())
            })
        }
        GM_setValue("sbclist",JSON.stringify(info.douagain.SBCList));
    }
}
events.goToSBC = (SBCSetEntity) => {
    let controller = cntlr.current(),
    view = controller.getView(),
    eventText = UTSBCHubView.Event.TILE_SELECTED,
    r;
    view.setInteractionState(!1);
    services.SBC.requestChallengesForSet(SBCSetEntity).observe(controller, (e, t) => {
        if (e.unobserve(controller),t.success && 0 < t.data.challenges.length){
            if (SBCSetEntity.hidden){
                r = t.data.challenges[0],
                services.SBC.loadChallenge(r).observe(controller, (ee,tt) => {
                    if (ee.unobserve(controller),tt.success){
                        var i = controller.getNavigationController();
                        if (i) {
                            if(!SBCSetEntity.getChallenge(r.id).squad){
                                SBCSetEntity.getChallenge(r.id).update(r);
                            }
                            var o = isPhone() ? new UTSBCSquadOverviewViewController : new UTSBCSquadSplitViewController;
                            o.initWithSBCSet(SBCSetEntity, r.id),
                            i.pushViewController(o)
                        }
                    }else{
                        let n = ee.error && tt.error.code === UtasErrorCode.SERVICE_IS_DISABLED ? "sbc.notification.disabled" : "notification.sbcChallenges.failedToLoad";
                        services.Notification.queue([services.Localization.localize(n), UINotificationType.NEGATIVE])
                    }
                    view.setInteractionState(!0)
                });
            }else {
                let i = controller.getNavigationController();
                if (i) {
                    let o = isPhone() ? new UTSBCChallengesViewController : new UTSBCGroupChallengeSplitViewController;
                    o.initWithSBCSet(SBCSetEntity),
                    i.pushViewController(o, !0)
                    i.setNavigationTitle(SBCSetEntity.name);
                }
                view.setInteractionState(!0)
            }
        }else if(NetworkErrorManager.checkCriticalStatus(t.status)){
            NetworkErrorManager.handleStatus(t.status);
        }else {
            let n = t.error && t.error.code === UtasErrorCode.SERVICE_IS_DISABLED ? "sbc.notification.disabled" : "notification.sbcChallenges.failedToLoad";
            s.setInteractionState(!0),
            services.Notification.queue([services.Localization.localize(n), UINotificationType.NEGATIVE])
        }
    })
}
events.setPackTileText = (packTile) => {
    if(!info.douagain.pack){
        packTile.setInteractionState(0);
        packTile.setDescription(fy("douagain.packtile.text"))
    }else{
        let pack = services.Store.storeDao.storeRepo.myPacks.values().filter(i => i.id == info.douagain.pack);
        if(pack.length){
            packTile.setInteractionState(1);
            packTile.setDescription(`${services.Localization.localize(pack[0].packName)} (${pack.length})`)
        }else{
            packTile.setInteractionState(0);
            packTile.setDescription(fy("douagain.packtile.text"))
        }
    }
}
events.judgmentSbcCount = (SBCTile) => {
    if(services.SBC.repository.getSets().length){
        events.setSbcTileText(SBCTile);
    }else{
        services.SBC.requestSets().observe(this, (e, t) => {
            if (e.unobserve(this),
            t.success) {
                events.setSbcTileText(SBCTile);
            } else if (NetworkErrorManager.checkCriticalStatus(t.status))
                NetworkErrorManager.handleStatus(t.status);
            else {
                var o = t.error && t.error.code === UtasErrorCode.SERVICE_IS_DISABLED ? "sbc.notification.disabled" : "notification.sbcSets.failedToLoad";
                services.Notification.queue([services.Localization.localize(o), UINotificationType.NEGATIVE]);
            }
        })
    }
}
events.setSbcTileText = (SBCTile) => {
    let SBC = services.SBC.repository.getSetById(info.douagain.sbc),
    SBCCountText = "";
    if(SBC){
        if(SBC.isComplete()){
            info.douagain.sbc = 0;
        }else{
            if(!SBC.isSingleChallenge){
                if(!SBC.timesCompleted){
                    SBCTile.setInteractionState(1);
                }else{
                    if(SBC.challengesCount > SBC.challengesCompletedCount){
                        SBCCountText = `(${SBC.challengesCompletedCount}/${SBC.challengesCount})`;
                        SBCTile.setInteractionState(1);
                    }else{
                        SBCCountText = `(${fy("douagain.sbctile.state3")})`;
                        SBCTile.setInteractionState(0);
                    }
                }
            }else{
                if(SBC.repeats){
                    let residual = SBC.repeats - SBC.timesCompleted;
                    SBCCountText = `(${fy(["douagain.sbctile.state2",residual])})`;
                    if(residual){
                        SBCTile.setInteractionState(1);
                    }else{
                        SBCTile.setInteractionState(0);
                    }
                }else{
                    SBCCountText = `(${fy(["douagain.sbctile.state1",SBC.timesCompleted])})`;
                    SBCTile.setInteractionState(1);
                }
            }
            SBCTile.setDescription(`${SBC.name} ${SBCCountText}`);
        }
    }
}
}
