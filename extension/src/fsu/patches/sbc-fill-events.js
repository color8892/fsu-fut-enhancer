export function registerSbcFillEvents(deps) {
  const { call, events, info, cntlr, isPhone, services, debug, repositories, build, fastSbcService, oneFillCriteriaService, sbcSquadFillService, sbcTemplateService, sbcSquadSaveService } = deps;
  events.fastSBCQuantity = (clubMode, playerPool, criteria) =>
    fastSbcService.calculateQuantity({
        clubMode,
        playerPool,
        criteria,
        helpers: {
            getItemBy: (...args) => events.getItemBy(...args),
            isEligibleForOneFill: (...args) => events.isEligibleForOneFill(...args),
            ignorePlayerToCriteria: (...args) => events.ignorePlayerToCriteria(...args),
            build: info.build
        }
    });
//未分配界面
UTUnassignedItemsViewController.prototype.renderView = function(...args) {
    call.view.unassigned.call(this, ...args);
    //未分配为0直接返回
    setTimeout(() => {
        if(this.getViewModel() && this.getViewModel().length === 0 && !document.querySelector(".ut-player-picks-view")){
            if(isPhone()){
                this.parentViewController.backButton._tapDetected(this)
            }else{
                this.parentViewController.parentViewController.backButton._tapDetected(this)
            }
            events.notice("notice.packback",1);
        }

        if(this.getViewModel() == null){
            return;
        }
        //24.15 头部SBC导航：未分配列表时检测无效的包予以隐藏
        let invalidPick = _.filter(this.getViewModel().values(), item => {
            return item.isPlayerPickItem() && item.id === item.definitionId;
        });
        if(invalidPick.length){
            _.map(this.getView().sections,section => {
                _.map(section.listRows,item => {
                    if(item.data.isPlayerPickItem() && item.data.id === item.data.definitionId){
                        item.hide()
                    }
                })
            })
        }



    },800);
}

//SBC无须排列创建队伍
UTSquadBuilderViewModel.prototype.generatePlayerCollection = function(e, o, n, r) {
    let c = 0;
    let ls = info.build.league ? info.set.shield_league : [];
    let rs = info.build.rare ? [3] : [];
    let p = o.filter(item => !ls.includes(item.leagueId) && !rs.includes(item.rareflag))
    let v = 0;
    for (let i = 0; i < 11; i++) {
        if(!r.getSlot(i).isValid() && !r.getSlot(i).isBrick()){
            v++;
        }
    }
    if(p.length < v && (ls.length || rs.length)){
        events.notice("notice.builder",2)
    }
    let s = this;
    let pa = e.map(function (_, t) {
        var i = r ? r.getSlot(t) : null;
        return i && (i.isValid() || i.isBrick()) ?
            i.getItem() :
            info.build.ignorepos ?
            p[c++] : s.getBestPlayerForPos(_, p);
    })
    events.loadPlayerInfo(pa);
    return pa;
};

//拍卖优化部分代码加载 → installMarketPatches

//拍卖查询价格
// events.getAuction → ModuleRegistry

//getAuctionPrice → MarketActionService

//24.18 假想球员批量购买：新购买方法
// events.buyConceptPlayer → ModuleRegistry





//假想球员购买
// events.buyPlayer → ModuleRegistry


//购买失败添加标识
events.cardAddBuyErrorTips = (defId) => {
    let squad = cntlr.current()._squad;
    if(!("_fsuBuyEroor" in squad)){
        squad._fsuBuyEroor = [];
    }
    if (!_.includes(squad._fsuBuyEroor,defId)) {
        squad._fsuBuyEroor.push(defId);
    }
    debug.log(squad._fsuBuyEroor)
    if(!isPhone()){
        _.map(squad._fsuBuyEroor,i => {
            if(document.querySelector(`.fsu-cards-buyerror[data-id="${i}"]`) == null && document.querySelector(`.fsu-cards-price[data-id="${i}"]`) !== null){
                let buyErrorElement = events.getCardTipsHtml(1);
                let targetElement = document.querySelector(`.ut-squad-slot-view .concept .fsu-cards-price[data-id="${i}"]`).parentNode;
                let parentElement = targetElement.parentNode;
                if(parentElement.querySelector(".fsu-cards-buyerror") == null){
                    parentElement.insertBefore(buyErrorElement, targetElement);
                }
            }
        })
    }
}
events.getCardTipsHtml = (type) => {
    const configMap = {
        1: {
            tipsClass: "fsu-cards-buyerror",
            tipsIcon: "icon_untradeable"
        },
        2: {
            tipsClass: "fsu-cards-storage",
            tipsIcon: "icon_sbc"
        },
        3: {
            tipsClass: "fsu-cards-unassigned",
            tipsIcon: "icon_undo_discard"
        },
    };
    //type 1:购买失败 2:SBC仓库 3:未分配列表
    const {
        tipsClass,
        tipsIcon,
    } = configMap[type] || configMap[1]; // 默认使用 type=1 配置
    let tipsElement = events.createElementWithConfig("div",{
        classList:["ut-squad-slot-chemistry-points-view","item","fsu-cards",tipsClass]
    })
    let tipsElementIcon = events.createElementWithConfig("div",{
        classList:["ut-squad-slot-chemistry-points-view--container","chemstyle",tipsIcon]
    })
    tipsElement.appendChild(tipsElementIcon);
    return tipsElement;
}
// events.readAuctionPrices → ModuleRegistry

// events.searchTransferMarket → ModuleRegistry

events.sendPinEvents = (pageId) => {
    services.PIN.sendData(PINEventType.PAGE_VIEW, {type: PIN_PAGEVIEW_EVT_TYPE,pgid: pageId,});
};

//25.13 一键填充的验证
events.isEligibleForOneFill = (obj) => oneFillCriteriaService.isEligibleForOneFill(obj);


//指定ID填充SBC
events.playerListFillSquad = (challenge, list, type) =>
    sbcSquadFillService.fillFromPlayerList(challenge, list, type, {
        showLoader: () => events.showLoader(),
        getFormation: (formation) => repositories.Squad.getFormation(formation),
        ignorePosition: info.build.ignorepos,
        loadPlayerInfo: (...args) => events.loadPlayerInfo(...args),
        saveSquad: (...args) => events.saveSquad(...args),
        saveOldSquad: (...args) => events.saveOldSquad(...args)
    });
//阵容智能填充
events.getTemplate = async (controller, type, sId) =>
    sbcTemplateService.loadTemplate(controller, type, sId, {
        showLoader: () => events.showLoader(),
        changeLoadingText: (...args) => events.changeLoadingText(...args),
        notice: (...args) => events.notice(...args),
        getFutbinSbcSquad: (...args) => events.getFutbinSbcSquad(...args),
        getItemBy: (...args) => events.getItemBy(...args),
        ignorePlayerToCriteria: (...args) => events.ignorePlayerToCriteria(...args),
        createVirtualChallenge: (...args) => events.createVirtualChallenge(...args),
        saveSquad: (...args) => events.saveSquad(...args),
        saveOldSquad: (...args) => events.saveOldSquad(...args),
        isTemplateRunning: () => info.run.template,
        setTemplateRunning: (value) => {
            info.run.template = value;
        },
        getGoldenRange: () => info.set.goldenrange,
        getFormationMap: () => info.formation,
        debug,
        isPhone,
        navigateBack: () => cntlr.current().getNavigationController()._eBackButtonTapped()
    });
//阵容方案保存

events.saveSquad = async (challenge, squad, players) =>
    sbcSquadSaveService.save(challenge, squad, players, {
        setSaving: (value) => {
            info.base.savesquad = value;
        },
        saveChallenge: (target) => services.SBC.saveChallenge(target),
        loadChallengeData: (target) => services.SBC.loadChallengeData(target),
        notice: (...args) => events.notice(...args),
        hideLoader: () => events.hideLoader(),
        loadPlayerInfo: (...args) => events.loadPlayerInfo(...args),
        isPhone,
        getCurrentController: () => cntlr.current(),
        getActiveView: () => (isPhone() ? cntlr.current() : cntlr.left()),
        debug
    });
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
