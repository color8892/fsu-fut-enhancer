export function installSbcFillPatches(deps) {
  const { call, events, info, cntlr, isPhone, services, debug, repositories, build, fsuSC, fy, enums, GM_setValue } = deps;
UTSBCService.prototype.loadChallengeData = function (r) {
    var s = this,
        a = new EAObservable();
    return (
        this.sbcDAO
        .loadChallenge(r.id, r.isInProgress())
        .observe(this, function (t, e) {
            t.unobserve(s);
            a.notify(e);
        }),
        a
    );
};

//24.18 修改请求fut阵容链接报错提示
// events.getFutbinSbcSquad → ModuleRegistry


UTAppSettingsView.prototype._generate = function (...args) {
    if (!this._generated) {
        call.view.setting.call(this,...args)
        this._fsu ??= {};
        this._fsu.box = events.createElementWithConfig("div", {
            className: "ut-button-group"
        });
        this._fsu.setBtn = events.createButton(
            new UTGroupButtonControl(),
            `FSU ${services.Localization.localize("button.settings")}`,
            async(e) => {
                var n = cntlr.current().getNavigationController();
                if(n){
                    var t = new fsuSC();
                    n.pushViewController(t);
                }
            },
            "more"
        )
        this._fsu.box.appendChild(this._fsu.setBtn.getRootElement());

        this._fsu.proxyBtn = events.createButton(
            new UTGroupButtonControl(),
            fy("apiprroxy.popupt"),
            async(e) => {
                events.popup(
                    fy("apiprroxy.popupt"),
                    fy("apiprroxy.popupm"),
                    (t,i) => {
                        if(t === 2){
                            let v = _.trim(i.getValue());
                            const urlPattern = /^https:\/\/[^\s/$.?#].[^\s]*$/i;
                            if (_.isEmpty(v) || urlPattern.test(v)) {
                                GM_setValue("apiproxy", v);
                                info.apiProxy = v;
                                events.notice(fy("notice.setsuccess"), 0);
                                if (info.apiPlatform !== 1) {
                                    info.apiPlatform = _.isEmpty(v) ? 3 : 2;
                                }
                            } else {
                                // 输入了非空内容但格式错误
                                events.notice(fy("notice.seterror"), 2);
                            }
                        }
                    }
                    ,
                    [
                        { labelEnum: enums.UIDialogOptions.OK },
                        { labelEnum: enums.UIDialogOptions.CANCEL }]
                    ,
                    [fy("apiprroxy.placeholder"), info.apiProxy],
                    true
                )
            },
            "more"
        )
        this._fsu.box.appendChild(this._fsu.proxyBtn.getRootElement());
        
        this.__topGroup.after(this._fsu.box);
    }
}

//球员挂拍卖
// events.playerToAuction → ModuleRegistry


//重置拍卖行信息
events.playerGetLimits = async(i) => {
    return new Promise((resolve) => {
        if (i.hasPriceLimits()) {
            resolve();
        return;
        }
        services.Item.requestMarketData(i).observe(
            this,
            async function (sender, response) {
                resolve();
            }
        );
    });
}

UTSelectItemFromClubViewController.prototype.updateItemList = function(t) {
    call.selectClub.updata.call(this,t)
    //填充状态重置为0判断
    if(this.parentViewController._fsuFillType){
        if(this.parentViewController._fsuFillType%2){
            this.parentViewController._fsuFillType++;
            if(t.length == 0){
                events.notice("notice.noplayer",2);
                services.Item.itemDao.itemRepo.unassigned.reset();
            }
        }
    }
}

//SBC阵容默契读取程序
UTSBCChallengeRequirementsView.prototype.renderChallengeRequirements = function(n, r) {
    call.squad.requirements.call(this,n,r)
    setTimeout(() => {
        const reqItems = this.__requirements?.querySelectorAll("li");
    
        if(reqItems?.length && n?.squadController?._fsu){
            _.forEach(reqItems, (item, index) => {
                const btn = n.squadController._fsu[`reqBtn_${index}`];
                if(btn && !item.hasAttribute("data-el")){
                    item.appendChild(btn.getRootElement());
                    item.setAttribute("data-el", true)
                }
            })
        }
    }, 50);
}
UTSquadEntity.prototype.swapPlayersByIndex = function(t, e) {
    call.squad.swapPlayers.call(this,t,e)
    events.saveOldSquad(this,true)
}
UTSquadEntity.prototype.addItemToSlot = function(t, e) {
    call.squad.addItem.call(this,t,e)
    if(this.isSBC()){
        let op = this._fsu.oldSquad[this._fsu.oldSquadCount][t];
        if(op.definitionId == e.definitionId && op.concept == true){
            this._fsu.oldSquad[this._fsu.oldSquadCount][t] = e;
        }else{
            events.saveOldSquad(this,true)
        }
    }
}
UTSquadEntity.prototype.removeItemFromSlot = function(t) {
    call.squad.removeItem.call(this,t)
    events.saveOldSquad(this,true)
}
UTSquadEntity.prototype.removeAllItems = function(t) {
    call.squad.removeAll.call(this,t)
    events.saveOldSquad(this,true)
}
UTSquadEntity.prototype.setPlayers = function(t, e) {
    call.squad.setPlayers.call(this,t,e)
    events.saveOldSquad(this,true)
}

//读取阵容保存
// events.saveOldSquad → ModuleRegistry

// events.getRatingPlayers → ModuleRegistry


//未分配名单读取
UTUnassignedTileView.prototype.setNumberOfItems = function(e) {
    call.other.uaTile.call(this,e)
    let ball = this.__root.querySelectorAll('.btn-standard');
    ball.forEach(b => b.remove());
    let type = 1;
    let item = _.filter(repositories.Item.getUnassignedItems(), item => {
        const repeat = events.getItemBy(1, { id: item.duplicateId });
        if(repeat.length === 0 && item.isDuplicate() && info.base.state){
            type = 2;
        }
        return (item.isPlayer() && repeat.length === 0) || (!item.isPlayer() && !item.isDuplicate() && !item.isMiscItem());
    });
    if(item.length && info.set.player_uatoclub && info.base.state){
        let b = events.createButton(
            new UTStandardButtonControl(),
            fy(["uatoclub.btntext",item.length]),
            (e) => {
                e.setInteractionState(0);
                async function setUnassignedToClub(items){
                    await events.wait(0.2,0.5)
                    debug.log(items)
                    services.Item.move(items,ItemPile.CLUB).observe(cntlr.current(),(a, b) => {
                            if (a.unobserve(cntlr.current()), b.success) {
                                events.notice("uatoclub.success",0)
                                if(cntlr.current().className == 'UTStoreHubViewController'){
                                    cntlr.current().getUnassignedItems();
                                }else if(cntlr.current().className == 'UTHomeHubViewController'){
                                    cntlr.current().nUnassignedItemAdded()
                                }else if(cntlr.current().className == 'UTStorePackViewController'){
                                    if(repositories.Item.getUnassignedItems().length){
                                        e._parent.setNumberOfItems(repositories.Item.getUnassignedItems().length);
                                        e.hide()
                                    }else{
                                        e._parent.hide()
                                    }
                                }else{
                                    services.Item.requestUnassignedItems()
                                }
                            } else {
                                events.notice("uatoclub.error",2)
                            }
                        }
                    );
                }
                if(e._fsuType == 1){
                    setUnassignedToClub(e._fsuItem)
                }else{
                    services.Item.itemDao.itemRepo.unassigned.reset();
                    services.Item.requestUnassignedItems().observe(cntlr.current(), (p, t) => {
                        p.unobserve(cntlr.current());
                        if(t.success){
                            let defIds = _.map(e._fsuItem,"definitionId")
                            debug.log(_.filter(t.response.items,i => _.includes(defIds, i.definitionId)));
                            setUnassignedToClub(_.filter(t.response.items,i => _.includes(defIds, i.definitionId)))
                        }else{
                            events.notice("uatoclub.error",2)
                        }
                    })
                }
                debug.log(1)
                e.setInteractionState(1);
            },
            "call-to-action mini"
        )
        b._fsuItem = item;
        b._fsuType = type;
        b._parent = this;
        b.__root.style.marginLeft = "2rem";
        b.__root.style.zIndex = "2";
        this.__label.after(b.__root)
    }
}

//UTStoreView.setPacks / events.truncateStrict → installStorePatches
// events.writePackReturns → ModuleRegistry


/** 25.18 SBC整体需求计算 **/
// events.sbcListNeedCount → ModuleRegistry

//计算总评的公式
// events.needRatingsCount → ModuleRegistry

// events.teamRatingCount → ModuleRegistry
}
