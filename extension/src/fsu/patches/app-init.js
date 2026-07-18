import { safeParseJson } from "../infra/JsonParsing.js";
import { RemoteConfigService } from "../domain/RemoteConfigService.js";
import {createExternalLink, createTrustedMarkup } from "../ui/HtmlSafety.js";

export function registerAppInitEvents(deps) {
  const { events, info, fy, patchLifecycle } = deps;
  //26.02 添加进化新增显示
  patchLifecycle.install({
    id: "home.academy-tile",
    phase: "pre-installer-bootstrap",
    targetLabel: "UTHomeHubView.prototype.getAcademyTile",
    resolveTarget: () =>
      typeof UTHomeHubView === "undefined"
        ? null
        : { owner: UTHomeHubView.prototype, key: "getAcademyTile" },
    verify: ({ originalDescriptor, originalValue }) => ({
      ok: originalDescriptor === undefined && originalValue === undefined,
      missing: ["UTHomeHubView.prototype.getAcademyTile.unexpected-existing"]
    }),
    apply: ({ target }) => {
      Object.defineProperty(target.owner, target.key, {
        configurable: true,
        enumerable: true,
        writable: true,
        value: function getAcademyTile() {
          if (
            info.evolutions.newCount > 0 &&
            !this._academyTile.__root.querySelector(".fsu-task")
          ) {
            this._academyTile.__tileContent.before(
              events.createDF(createTrustedMarkup(`<div class="fsu-task">${info.evolutions.html}</div>`))
            );
          }
          return this._academyTile;
        }
      });
    }
  });

//26.02 添加loading文本事件
events.addLoadingElment = () => {
    if(!info.base.close){
        info.base.close = events.createButton(
            new UTButtonControl(),
            fy("loadingclose.text"),
            async(_e) => {
                events.hideLoader()
            },
            "fsu-loading-close"
        );
        document.querySelector(".ut-click-shield").append(info.base.close.__root);
    }
}

events.wait = (min, max) => {
    const delay = Math.floor(Math.random() * (max * 1000 - min * 1000 + 1)) + min * 1000;
    return new Promise((resolve) => setTimeout(resolve, delay));
};

events.changeLoadingText = (t, s) => {
    events.addLoadingElment();
    const closeEl = document.querySelector(".fsu-loading-close");
    if (!closeEl) {
        return;
    }
    closeEl.replaceChildren();
    closeEl.appendChild(document.createTextNode(String(fy(t) ?? "")));
    if (s && s !== "") {
        closeEl.appendChild(document.createElement("br"));
        closeEl.appendChild(document.createTextNode(String(fy(s) ?? "")));
    }
};
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
  const parseStoredJson = (key, fallback) =>
    safeParseJson(GM_getValue(key, JSON.stringify(fallback)), fallback, {
      label: `GM:${key}`,
      onError: (error, context) => debug.log(`${context.label} parse failed`, error)
    });
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

    let history_a = parseStoredJson("history", []),history_b = [];
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

    const remoteConfigService = new RemoteConfigService({
        info,
        fy,
        debug,
        notice: (...args) => events.notice(...args),
        request: (details) => GM_xmlhttpRequest(details),
        taskHtml: (...args) => events.taskHtml(...args),
        scriptVersion: GM_info.script.version
    });
    remoteConfigService.load({
        onHeaderReady: ({ urlText, urlLink }) => {
            getAppMain()._FCHeader.getView().__easportsLink.after(
                createExternalLink({
                    className: "header_explain",
                    href: urlLink,
                    text: urlText
                })
            );
        }
    });
    let user = services.User.getUser().getSelectedPersona();
    if(user.isXbox || user.isPlaystation || user.isStadia){
        info.base.platform = "ps";
    }
    services.User.maxAllowedAuctions = 100;

    //26.07 加载玩家meta
    info.playerMetaData = parseStoredJson(`playerMetaData_${info.base.year}`, {});

    //26.02 loading文本添加事件
    events.addLoadingElment();
 
    info.base.localization = services.Localization.repository._collection;
    //25.22 获取SBC信息并插入头部导航
    services.SBC.requestSets().observe(getAppMain().getRootViewController(), function(e, t) {
        if (e.unobserve(getAppMain().getRootViewController()),t.success && JSUtils.isObject(t.data)) {
            let tempSBCList = parseStoredJson("sbclist", []).reverse();
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
                            let academyCache = parseStoredJson("academy", {});
                            
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
                                    events.createDF(createTrustedMarkup(`<div class="fsu-task">${info.evolutions.html}</div>`))
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
