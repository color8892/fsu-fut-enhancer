export function registerAppInitEvents(deps) {
  const { events, info, fy, cntlr, isPhone, services, repositories, debug, SBCCount, set, build, lock, GM_getValue, GM_setValue, GM_xmlhttpRequest, GM_info } = deps;
  //26.02 添加进化新增显示
UTHomeHubView.prototype.getAcademyTile = function() {
    if(info.evolutions.newCount > 0 && !this._academyTile.__root.querySelector(".fsu-task")){
        this._academyTile.__tileContent.before(
            events.createDF(`<div class="fsu-task">${info.evolutions.html}</div>`)
        )
    }
    return this._academyTile
}

//26.02 添加loading文本事件
events.addLoadingElment = () => {
    if(!info.base.close){
        info.base.close = events.createButton(
            new UTButtonControl(),
            fy("loadingclose.text"),
            async(e) => {
                events.hideLoader()
            },
            "fsu-loading-close"
        );
        document.querySelector(".ut-click-shield").append(info.base.close.__root);
    }
}
//26.02 添加enhancer兼容部分
events.enhanceStyleChange = () => {
    GM_addStyle(`
        .has-add-player .filter-btn.fsu-eligibilitysearch{right: 36px}
        .ut-search-filter-control select option{color: #2d2c36}
    `)
}
}

export function installAppInitPatches(deps) {
  const {
    events,
    info,
    fy,
    services,
    cntlr,
    isPhone,
    SBCCount,
    set,
    build,
    lock,
    futbinId,
    debug,
    GM_getValue,
    GM_setValue,
    GM_xmlhttpRequest,
    GM_info
  } = deps;
  events.notice = function(text,type){
    services.Notification.queue([fy(text),type])
};
events.init =  async function(){
    SBCCount.init();
    set.init();
    build.init();
    lock.init();
    futbinId.init();
    info.myPacksSort = GM_getValue("packsSort", "desc");

    //25.22 修改插入头部SBC列表信息初始化至此处

    let nav = cntlr.current().parentViewController.navigationBar;
    if(nav){
        if(nav instanceof UTCurrencyNavigationBarView && info.set.sbc_headentrance){
            if(!info.douagain.hasOwnProperty("SBCListHtml")){
                info.douagain.SBCListHtml = events.createElementWithConfig("div", {
                    classList:["fsu-navsbc"],
                    style:{
                        display:"flex",
                    }
                })
            }
            if(isPhone()){
                nav.__root.classList.add("fsu-shownavsbc");

                //隐藏顶部俱乐部图标
                if(nav.rightContainer){
                    nav.rightContainer.style.display = "none";
                }
            }
            nav._fsuSBCList = info.douagain.SBCListHtml;
            if(nav.__root.querySelector(".view-navbar-currency")){
                nav.__root.insertBefore(nav._fsuSBCList, nav.__currencies);
            }
        }
        SBCCount.createElement(cntlr.current().parentViewController.getView());
    }

    let history_a = JSON.parse(GM_getValue("history","[]")),history_b = [];
    if (history_a && _.isArray(history_a)) {
        let newSize = _.size(new UTSearchCriteriaDTO());
        let filteredMembers = _.filter(history_a, item => _.isArray(item) && item.length === newSize);
        history_b = _.concat(history_b, filteredMembers);
    }
    debug.log(history_b)
    info.market.mb = history_b;
    info.market.ts = Date.now();
    info.base.sId = services.Authentication.utasSession.id;

    info.base.year = APP_YEAR_SHORT;
    MAX_NEW_ITEMS = 100;

    const cutoff = Math.floor(info.market.ts / 1000) - 168 * 3600; // 168 小时前时间戳
    info.ggr = JSON.parse(GM_getValue("ggr", "{}"));
    // 遍历并删除过期项
    for (const [id, data] of Object.entries(info.ggr)) {
        const time = parseInt(data.time, 10); // 解析字符串为数字
        if (isNaN(time) || time < cutoff) {
            delete info.ggr[id];
        }
    }
    // 保存回去
    GM_setValue("ggr", JSON.stringify(info.ggr));

    GM_xmlhttpRequest({
        method:"GET",
        url:"https://api.fut.to/26/updata.json",
        timeout:8000,
        headers: {
            "Content-type": "application/json",
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        },
        onload:function(res){
            let urlText = fy("top.readme");
            let urlLink = "https://mfrasi851i.feishu.cn/wiki/wikcng1Ih7fFRidBfMdNS9SrucR";
            if(res.status == 404){
                events.notice("notice.upgradefailed",2);
            }else{
                let data = JSON.parse(res.response);
                let myVersion = Number(GM_info.script.version) || 0;
                if(data["version"] > myVersion){
                    urlText = fy("top.upgrade");
                    urlLink = data["updateURL"];
                    events.notice("notice.upgradeconfirm",1);
                }
                if(_.size(data["api"])){
                    info.api = data["api"];
                    if(_.has(info.api,"meta")){
                        GM_xmlhttpRequest({
                            method:"GET",
                            url:`https://api.fut.to/26/meta.json?${info.api.meta}`,
                            headers: {
                                "Content-type": "application/json",
                                "Cache-Control": "max-age=31536000"
                            },
                            onload:function(res){
                                let metaJson = JSON.parse(res.response);
                                if(_.has(metaJson, "bodyType")){
                                    info.meta.bodyType = _.fromPairs(
                                        _.flatMap(metaJson.bodyType, (ids, bodyType) =>
                                            ids.map(id => [id, Number(bodyType)])
                                        )
                                    );
                                }
                                _.has(metaJson, "baseBodyType") && (info.meta.baseBodyType = metaJson.baseBodyType);
                                _.has(metaJson, "realFace") && (info.meta.realFace = metaJson.realFace);
                                debug.log(`meta加载完毕！`)
                            },
                        })
                    }
                    if(_.has(info.api,"fastsbc")){
                        GM_xmlhttpRequest({
                            method: "GET",
                            url: `https://api.fut.to/26/fast.json?${info.api.fastsbc}`,
                            headers: {
                                "Content-type": "application/json",
                                "Cache-Control": "max-age=31536000"
                            },
                            onload: function(res) {
                                _.forEach(JSON.parse(res.responseText),(i,k) => {
                                    let nowTime = Math.floor(Date.now() / 1000);
                                    if(i.t > nowTime){
                                        info.base.fastsbc[k] = i.g;
                                    }
                                })
                            }
                        });

                    }
                    if(_.has(info.api,"pack")){
                        GM_xmlhttpRequest({
                            method:"GET",
                            url:`https://api.fut.to/26/pack.json?${info.api.pack}`,
                            headers: {
                                "Content-type": "application/json",
                                "Cache-Control": "max-age=31536000"
                            },
                            onload:function(res){
                                info.base.oddo = JSON.parse(res.response)
                            },
                        });

                    }
                    if(_.has(info.api,"sbc")){
                        GM_xmlhttpRequest({
                            method:"GET",
                            url:`https://api.fut.to/26/sbc.json?${info.api.sbc}`,
                            headers: {
                                "Content-type": "application/json",
                                "Cache-Control": "max-age=31536000"
                            },
                            onload:function(res){
                                let sbcJson = JSON.parse(res.response);
                                info.task.sbc.stat = sbcJson;
                                let sbcRewardArray = _.map(sbcJson.reward,i => {
                                    return i == 1 ? fy("task.player") :  i == 2 ? fy("task.pack") : '';
                                })
                                info.task.sbc.html = events.taskHtml(sbcJson.new.length,sbcRewardArray.join("、"));
                            },
                        });
                    }
                    if(_.has(info.api,"ggrating")){
                        GM_xmlhttpRequest({
                            method:"GET",
                            url:`https://api.fut.to/26/ggrating.json?${info.api.ggrating}`,
                            headers: {
                                "Content-type": "application/json",
                                "Cache-Control": "max-age=31536000"
                            },
                            onload:function(res){
                                info.GGRRAR = JSON.parse(res.response);
                                debug.log(`GGRRAR加载完毕！`)
                            },
                        })
                    }
                    //26.02 加载新进化信息
                    if(_.has(info.api,"evolutions")){
                        GM_xmlhttpRequest({
                            method:"GET",
                            url:`https://api.fut.to/26/evolutions.json?${info.api.evolutions}`,
                            headers: {
                                "Content-type": "application/json",
                                "Cache-Control": "max-age=31536000"
                            },
                            onload:function(res){
                                info.evolutions.new = JSON.parse(res.response).new;
                                debug.log(`evolutions加载完毕！`)
                            },
                        })
                    }
                    //26.04 加载包内球员ids
                    if(_.has(info.api,"inpacks")){
                        GM_xmlhttpRequest({
                            method:"GET",
                            url:`https://api.fut.to/26/inpacks.json?${info.api.inpacks}`,
                            headers: {
                                "Content-type": "application/json",
                                "Cache-Control": "max-age=31536000"
                            },
                            onload:function(res){
                                const { defIds, rarityIds } = JSON.parse(res.response);
                                info.inpacks.defIds = defIds;
                                info.inpacks.rarityIds = rarityIds;
                                debug.log(`inpacks加载完毕！`)
                            },
                        })
                    }
                    //26.04 加载其他配置
                    if(_.has(info.api,"other")){
                        GM_xmlhttpRequest({
                            method:"GET",
                            url:`https://api.fut.to/26/other.json?${info.api.other}`,
                            headers: {
                                "Content-type": "application/json",
                                "Cache-Control": "max-age=31536000"
                            },
                            onload:function(res){
                                const { dynamic, chem } = JSON.parse(res.response);
                                info.specialPlayers = {
                                    "dynamic": dynamic,
                                    "DList": Object.entries(dynamic)
                                        .filter(([key, value]) => {
                                            return value.exp && value.exp > Date.now() / 1000;
                                        })
                                        .map(([key, value]) => Number(key)),
                                    "extraChem": chem,
                                    "ECList": Object.keys(chem).map(key => Number(key))
                                }
                                debug.log(`other加载完毕！`)
                            },
                        })
                    }

                    //26.07 加载fg配置
                    if(_.has(info.api,"fgconfig")){
                        GM_xmlhttpRequest({
                            method:"GET",
                            url:`https://api.fut.to/26/fgconfig.json?${info.api.fgconfig}`,
                            headers: {
                                "Content-type": "application/json",
                                "Cache-Control": "max-age=31536000"
                            },
                            onload:function(res){
                                info.fgconfig = JSON.parse(res.response);
                                debug.log(`fgconfig加载完毕！`)
                            },
                        })
                    }

                    //26.07 加载新meta配置
                    if(_.has(info.api,"playermeta")){
                        GM_xmlhttpRequest({
                            method:"GET",
                            url:`https://api.fut.to/26/playermeta.json?${info.api.playermeta}`,
                            headers: {
                                "Content-type": "application/json",
                                "Cache-Control": "max-age=31536000"
                            },
                            onload:function(res){
                                let data = JSON.parse(res.response);
                                info.playermeta = {};
                                _.forEach(data, value => {
                                    if(value.length == 4){
                                        info.playermeta[value[0]] = {
                                            "badytype":value[1],
                                            "weight":value[2],
                                            "realface":value[3],
                                        }
                                    }
                                });
                                debug.log(`playermeta加载完毕！`)
                            },
                        })
                    }

                    //26.07 加载新lowprice配置
                    if(_.has(info.api,"lowprice")){
                        GM_xmlhttpRequest({
                            method:"GET",
                            url:`https://api.fut.to/26/lowprice.json?${info.api.lowprice}`,
                            headers: {
                                "Content-type": "application/json",
                                "Cache-Control": "max-age=31536000"
                            },
                            onload:function(res){
                                let data = JSON.parse(res.response);
                                info.base.price = data[info.base.platform == "pc" ? "pc" : "ps"];
                                debug.log(`lowprice加载完毕！`)
                            },
                        })
                    }
                }
            }
            getAppMain()._FCHeader.getView().__easportsLink.insertAdjacentHTML('afterend', `<a class="header_explain" href="${urlLink}" target="_blank">${urlText}</a>`);
        },
        onerror:function(){
            events.notice("notice.upgrade.failed",2);
        }
    })
    let user = services.User.getUser().getSelectedPersona();
    if(user.isXbox || user.isPlaystation || user.isStadia){
        info.base.platform = "ps";
    }
    services.User.maxAllowedAuctions = 100;

    //26.07 加载玩家meta
    info.playerMetaData = JSON.parse(GM_getValue(`playerMetaData_${info.base.year}`, "{}"));

    //26.02 loading文本添加事件
    events.addLoadingElment();
 
    info.base.localization = services.Localization.repository._collection;
    //25.22 获取SBC信息并插入头部导航
    services.SBC.requestSets().observe(getAppMain().getRootViewController(), function(e, t) {
        if (e.unobserve(getAppMain().getRootViewController()),t.success && JSUtils.isObject(t.data)) {
            let tempSBCList = JSON.parse(GM_getValue("sbclist", "[]")).reverse();
            tempSBCList.forEach(sbcId => {
                events.SBCListInsertToFront(sbcId, 1);
            });
        }
    });
    //26.03 获取商店信息避免SBC直接模拟开包卡死
    services.Store.getPacks(PurchasePackType.ALL, true, true);
    //获取目标信息
    services.Objectives.objectivesDAO.getCategories().observe(getAppMain().getRootViewController(), function(e, t) {
        e.unobserve(getAppMain().getRootViewController());
        if(t.success && t.response && !JSUtils.isString(t.response)){
            let nowDate = Math.round(new Date().getTime()/1000),
            objNewJson = {
                new:[],
                catNew:{},
                expiry:[],
                catExpiry:{},
                reward:[],
                catReward:0
            }

            _.map(t.response.categories,cat => {
                objNewJson.catNew[cat.id] = 0;
                objNewJson.catExpiry[cat.id] = 0;
                objNewJson.catReward += cat.countNumberOfUnclaimedRewards();
                _.map(cat.getGroups(),g => {
                    if(g.type !== 2){
                        let oId = g.compositeId;
                        if(g.startTime >= nowDate - 86400 && g.startTime < nowDate){
                            objNewJson.new.push(oId);
                            objNewJson.catNew[cat.id]++;

                            if(g?.rewards){
                                let rewards = _.concat(_.cloneDeep(g.rewards.rewards),_.flatten(_.map(g.objectives.values(),"rewards.rewards")));
                                debug.log(rewards);
                                if(rewards.length){
                                    _.map(rewards,r => {
                                        if(r.isPack || (r.isItem && r.item.isMiscItem())){
                                            objNewJson.reward.push(fy("task.pack"))
                                        }
                                        if(r.isItem && r.item.isPlayer()){
                                            objNewJson.reward.push(fy("task.pack"))
                                        }
                                        if(r.isXP){
                                            objNewJson.reward.push("XP")
                                        }
                                    })
                                }
                            }
                        }
                        if(g.endTime <= nowDate + 86400 && g.endTime !== 0){
                            objNewJson.expiry.push(oId);
                            objNewJson.catExpiry[cat.id]++;
                        }
                    }
                })
            })
            objNewJson.reward = _.uniq(objNewJson.reward);
            info.task.obj.stat = objNewJson;
            info.task.obj.source = t.response.categories;
            info.task.obj.html = events.taskHtml(objNewJson.new.length,objNewJson.reward.join("、"));
        }
    })
    if(document.querySelectorAll(".app-logo").length){
        debug.log("加载了 enhancer！！！")
        info.isEnhancer = true;
        events.enhanceStyleChange();
    }else{
        debug.log("没加载 enhancer")
        info.isEnhancer = false;
    }
    await events.reloadPlayers();

    //24.18 可进化标识：读取进化任务数据
    //25.02 修复进化任务加载不全的问题
    if(repositories.Academy.isCacheExpired()){
        let academyDTO = new UTAcademySlotSearchCriteriaDTO;
        academyDTO.count = 40;
        const simpleAcademyTypes = [AcademyStatEnum.RARITY, AcademyStatEnum.COSMETIC_UPGRADE];
        const nowTime = Math.floor(Date.now() / 1000);
        services.Academy.requestAcademyHub(academyDTO).observe(getAppMain().getRootViewController(), function(e, t) {
            e.unobserve(getAppMain().getRootViewController());
            GM_setValue("academy",JSON.stringify({}));
            if(t.success && t.data && !JSUtils.isString(t.data)){
                _.map(t.data.categories,c => {
                    let DTO = new UTAcademySlotSearchCriteriaDTO;
                    DTO.categoryId = c.id;
                    DTO.count = 40;
                    services.Academy.requestSlotsByCategory(DTO).observe(getAppMain().getRootViewController(), function(ee, tt) {
                        ee.unobserve(getAppMain().getRootViewController());
                        if(tt.success && tt.data && !JSUtils.isString(tt.data)){
                            info.evolutions.newCount += _.filter(tt.data.slots,i => info.evolutions.new.includes(i.id)).length;
                            info.evolutions.html = events.taskHtml(info.evolutions.newCount, "")
                            let academyCache = JSON.parse(GM_getValue("academy","{}"));
                            
                            _.map(tt.data.slots,s => {
                                academyCache[s.id] = {
                                    "name": s.slotName,
                                    "status": s.status == AcademySlotState.NOT_STARTED ? 1 : 0,
                                    "category": repositories.Academy.categories.get(s.categoryId).description,
                                    "time": s.endTimePurchaseVisibility
                                }
                                const rewardCondition =
                                    s.academyTopRewards.length > 1 ||
                                    (
                                        s.academyTopRewards.length === 1 &&
                                        !simpleAcademyTypes.includes(s.academyTopRewards[0].type)
                                    );

                                const startedOffset = s.status === AcademySlotState.NOT_STARTED ? 0 : 1;
                                const remainingQuantity = s.numberOfRepetitions - Math.max(s.repetitionIndex, 0) + 1 - startedOffset;
                                if(remainingQuantity > 0){
                                    let time = -1;
                                    let timeDiff = Infinity;
                                    let timeDiffText = "";
                                    if(_.max(s.endTime, s.endTimePurchaseVisibility) !== 0){
                                        time = _.min(_.filter([s.endTime, s.endTimePurchaseVisibility], v => v && v !== 0));
                                        timeDiff = time - nowTime;
                                        timeDiffText = services.Localization.localizeAuctionTimeRemaining(timeDiff);
                                    }
                                    const allRewards = s.getAllSlotRewards();
                                    let reqRating = s.eligibilityRequirements.find(
                                        item => item.attribute === AcademyEligibilityAttribute.OVR
                                    )?.targets?.[0] ?? 0;
                                    info.academy.push(
                                        {
                                            id: s.id,
                                            name: s.slotName,
                                            practical: rewardCondition,
                                            time: time,
                                            timeDiff: timeDiff,
                                            timeDiffText: timeDiffText,
                                            el: _.cloneDeep(s.eligibilityRequirements),
                                            attr: allRewards,
                                            isGK: s.isGkExclusive(),
                                            rating: reqRating,
                                            attrText: events.academyAddAttr(allRewards, s.isGkExclusive()).map
                                        }
                                    )
                                }
                            })
                            info.academy = _.orderBy(info.academy, "timeDiff");
                            //debug.log(info.academy)
                            GM_setValue("academy",JSON.stringify(academyCache));
                            
                            //26.02 HOME添加进化新任务提示
                            if(cntlr.current().className == "UTHomeHubViewController" && info.evolutions.newCount > 0){
                                cntlr.current().getView()._academyTile.getRootElement()?.querySelector(".fsu-task")?.remove();
                                cntlr.current().getView()._academyTile.__tileContent.before(
                                    events.createDF(`<div class="fsu-task">${info.evolutions.html}</div>`)
                                )
                            }
                        }
                    })
                })
            }
        })
    }
    info.squad = _.map(repositories.Squad.squads.get(services.User.getUser().selectedPersona).get(services.Squad.activeSquad).getPlayers(),"item.id");
    debug.log(info.squad)
};
}
