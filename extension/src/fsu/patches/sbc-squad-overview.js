export function registerSbcIgnoreTextEvent(deps) {
  const { events, info, fy } = deps;
  events.getIgnoreText = () => {
    let ignoreTextArray = [];
    ignoreTextArray.push(fy(["builder.goldenrange.short",info.set.goldenrange]))
    const options = ["ignorepos","untradeable","league","flag","academy","strictlypcik","firststorage","comprange","comprare","sbfirstcommon"];
    const optionsTextMap = {
        league: () => fy([`builder.league.short`, info.set.shield_league.length]),
        flag: () => fy([`builder.flag.short`, info.set.shield_flag.length]),
        comprange: () => fy([`builder.comprange.short`,info.set.goldenrange]),
        default: (i) => fy(`builder.${i}.short`)
    };
    _.forEach(options,i => {
        if(info.build[i]){
            const textFunc = optionsTextMap[i] || optionsTextMap.default;
            ignoreTextArray.push(textFunc(i));
        }
    })
    return ignoreTextArray.join("、");
  };
}

export function installSbcSquadOverviewPatches(deps) {
  const { events, info, fy, cntlr, isPhone, repositories, debug, SBCEligibilityKey } = deps;
  //26.04 SBC初始化需求内容
const UTSBCSquadOverviewViewController_initWithSBCSet = UTSBCSquadOverviewViewController.prototype.initWithSBCSet;
UTSBCSquadOverviewViewController.prototype.initWithSBCSet = function (...args) {
    UTSBCSquadOverviewViewController_initWithSBCSet.call(this, ...args);
    if(this._challenge){
        debug.log(this._challenge)
        this._challenge.squadController = this;
        const thisController = this;
        this._fsu ??= {};
        let hasChemistry = 0, hasRating = 0, exactRating = 0;
        let showReqBtnAttr = [];
        this._challenge.eligibilityRequirements.forEach((req, index) => {
            let reqKey = req.getFirstKey();
            let reqValue = req.getValue(reqKey);
            let criteria = {};
            switch (reqKey) {
                case SBCEligibilityKey.CLUB_ID:
                    let teamId = [];
                    let teamLinks = Array.from(repositories.TeamConfig.teamLinks);
                    _.map(reqValue, tId => {
                        let tLinks = _.find(teamLinks, pair => pair.includes(tId));
                        if (tLinks) {
                            teamId.push(...tLinks);
                        } else {
                            teamId.push(tId);
                        }
                    })
                    criteria.teamId = teamId;
                    showReqBtnAttr.push({
                        type: AssetLocationUtils.FILTER.CLUB,
                        criteria : criteria,
                        ids: reqValue,
                        count: req.count
                    })
                    break;
                case SBCEligibilityKey.LEAGUE_ID:
                    criteria.leagueId = reqValue;
                    showReqBtnAttr.push({
                        type: AssetLocationUtils.FILTER.LEAGUE,
                        criteria : criteria,
                        ids: reqValue,
                        count: req.count
                    })
                    break;
                case SBCEligibilityKey.NATION_ID:
                    criteria.nationId = reqValue;
                    showReqBtnAttr.push({
                        type: AssetLocationUtils.FILTER.NATION,
                        criteria : criteria,
                        ids: reqValue,
                        count: req.count
                    })
                    break;
                case SBCEligibilityKey.PLAYER_RARITY:
                    criteria.rareflag = reqValue;
                    showReqBtnAttr.push({
                        type: AssetLocationUtils.FILTER.RARITY,
                        criteria : criteria,
                        ids: reqValue,
                        count: req.count
                    })
                    break;
                case SBCEligibilityKey.PLAYER_MIN_OVR:
                    criteria.GTrating = reqValue;
                    break;
                case SBCEligibilityKey.PLAYER_RARITY_GROUP:
                    criteria.groups = reqValue;
                    break;
                case SBCEligibilityKey.PLAYER_EXACT_OVR:
                    criteria.rating = reqValue;
                    exactRating = reqValue;
                    break;
                case SBCEligibilityKey.TEAM_RATING:
                    const rating = [reqValue].flat()[0];
                    if (Number.isFinite(rating)) hasRating = rating;
                    break;
                case SBCEligibilityKey.CHEMISTRY_POINTS:
                    const chme = [reqValue].flat()[0];
                    if (Number.isFinite(chme)) hasChemistry = chme;
                    break;
                default:
                    break;
            }
            if(_.size(criteria)){
                this._fsu[`reqBtn_${index}`] = events.createButton(
                    new UTImageButtonControl(),
                    "",
                    (_e) => {
                        events.squadPositionSelection(
                            thisController,
                            criteria,
                            null
                        )
                    },
                    "filter-btn fsu-eligibilitysearch"
                )
            }
        })
        const updateObj = { hasChemistry, hasRating, exactRating };
        if (showReqBtnAttr.length > 0) {
            updateObj.showReqBtnAttr = showReqBtnAttr;
        }

        // 给 底层界面 赋值
        Object.assign(this._fsu, updateObj);

        // 给 阵容 赋值
        if (this?._squad) {
            this._squad._fsu ??= {};
            Object.assign(this._squad._fsu, updateObj);
        }

        //批量购买假想球员生成
        this._fsu.bulkBuyBtn = events.createButton(
            new UTStandardButtonControl(),
            fy("bibconcept.btntext"),
            (_e) => {
                let conceptPlayers = _.map(_.filter(thisController._squad.getPlayers(), slot => {
                    return slot.item.concept;
                }),"item");
                if(isPhone() && !(cntlr.current() instanceof UTSBCSquadOverviewViewController)){
                    cntlr.current().parentViewController._eBackButtonTapped();
                }
                setTimeout(() => {
                    events.buyConceptPlayer(conceptPlayers);
                },500);
            },
            "mini call-to-action",
            {
                width: 'calc(100% - 2rem)',
                marginLeft: '1rem',
                marginRight: '1rem',
                marginTop: '1rem',
            }
        )
        if (this?._squad?._fsu) {
            this._squad._fsu.bulkBuyBtn = this._fsu.bulkBuyBtn;
        }
        this._fsu.bulkBuyBtn.hide();

        //方案填充按钮
        if(info.set.sbc_template){
            this._fsu.fillSquadBtn = events.createButton(
                new UTStandardButtonControl(),
                fy("sbc.squadfill"),
                (e) => {
                    if (info.set.sbc_templatemode) {
                        events.popup(
                            fy("consult.popupt"),
                            fy("consult.popupm"),
                            (t,i) => {
                                if(t === 2){
                                    let v = i.getValue();
                                    if(v == ""){
                                        events.getTemplate(e,1);
                                    }else{
                                        const patterns = {
                                            gg: /(?:squad-builder\/|^)([a-f0-9-]{36})/, // 匹配 UUID 格式
                                            bin: /(?:squad\/|^)(\d+)/                 // 匹配纯数字 ID
                                        };

                                        const matchGG = v.match(patterns.gg);
                                        const matchBin = v.match(patterns.bin);

                                        if (matchGG) {
                                            events.getTemplate(e, 3, matchGG[1]);
                                        } else if (matchBin) {
                                            events.getTemplate(e, 2, matchBin[1]);
                                        } else {
                                            events.notice("consult.error", 2);
                                        }
                                    }
                                }
                            }
                            ,false,
                            [fy("consult.placeholder"),""],
                            true
                        )
                    } else {
                        events.getTemplate(e, 1);
                    }
                },
                "call-to-action"
            )
            this._fsu.fillSquadBtn.challenge = this._challenge;
        }
        
        //排除球员配置按钮
        this._fsu.ignoreBtn = events.createButton(
            new UTStandardButtonControl(),
            fy("playerignore.button"),
            (e) => {
                events.ignorePlayerPopup(e.ignoreTextElment);
            },
            "mini call-to-action",
            {
                width: 'calc(100% - 1rem)',
                margin: '.5rem auto',
            }
        )
        this._fsu.ignoreText = events.createElementWithConfig(
            "div",
            {
                textContent: events.getIgnoreText(),
                style: {
                    fontSize: "12px",
                    color: "#888",
                    textAlign: "center",
                    margin: ".5rem",
                }
            }
        )
        this._fsu.ignoreBtn.ignoreTextElment = this._fsu.ignoreText;

        //一键填充
        let oneFillCriteria = events.oneFillCreationGF(this._challenge.eligibilityRequirements,11 - this._squad.getAllBrickIndices().length);

        if(oneFillCriteria.length){

            //快捷任务进行二次处理
            let fastSbcNeedInfo = _.cloneDeep(oneFillCriteria);
            _.remove(fastSbcNeedInfo, (f) => f.c === 0);
            _.forEach(fastSbcNeedInfo,f => {
                let keyText = _.join(_.keys(f.t),"-");
                if((keyText == "rareflag-rs" || keyText == "rs-rareflag") && f.t.rareflag == 1 && f.t.rs == 2){
                    f.t = {
                        gs: true,
                        rs: 2
                    }
                }
            })

            //添加快捷任务
            if(fastSbcNeedInfo.length){
                let fastJson = {};
                fastJson[`${this._challenge.id}#${this._challenge.setId}`] = {
                    "g":fastSbcNeedInfo,
                    "t":this._challenge.endTime
                }
                debug.log(fastJson);

                const fastSbcName = `${this._challenge.id}#${this._challenge.setId}`;

                //26.02 自动添加到快捷任务
                if(!_.has(info.base.fastsbc, fastSbcName)){
                    info.base.fastsbc[fastSbcName] = fastSbcNeedInfo;
                }
                
                const fastSbcStats = _.has(info.base.fastsbc,fastSbcName) ? "del" : "add";
                this._fsu.fastSbcStatsBtn = events.createButton(
                    new UTStandardButtonControl(),
                    fy(`fastsbc.${fastSbcStats}`),
                    (_q) => {
                        if(fastSbcStats == "add"){
                            info.base.fastsbc[fastSbcName] = fastSbcNeedInfo;
                        }else{
                            delete info.base.fastsbc[fastSbcName];
                        }
                        cntlr.current().getRootNavigationController().navigationBar.primaryButton._tapDetected(this);
                        events.notice([`notice.${fastSbcStats}fastsbc`,e.name],0);
                    },
                    fastSbcStats == "add" ? "mini call-to-action" : "mini",
                    {
                        width: 'calc(100% - 1rem)',
                        margin: '.5rem auto',
                    }
                )
            }

            if(info.set.sbc_autofill){
                //一键填充按钮
                this._fsu.autoFillBtn = events.createButton(
                    new UTStandardButtonControl(),
                    fy("autofill.btntext"),
                    (e) => {
                        let playerList = [], removeIds = [];
                        //24.16 排除球员配置按钮：一键填充严格模式应用
                        if(!info.build.strictlypcik && events.isEligibleForOneFill(oneFillCriteria)){
                            let criteriaNumber = oneFillCriteria[0].c + oneFillCriteria[1].c;
                            let getCriteria = {rs:JSON.parse(JSON.stringify(oneFillCriteria[0].t.rs))};
                            getCriteria = events.ignorePlayerToCriteria(getCriteria);
                            playerList = events.getItemBy(2,getCriteria,repositories.Item.getUnassignedItems()).slice(0,criteriaNumber);
                        }else{
                            for (let i of oneFillCriteria) {
                                let getCriteria = JSON.parse(JSON.stringify(i.t));
                                getCriteria = events.ignorePlayerToCriteria(getCriteria);
                                if(removeIds.length){
                                    getCriteria["NEdatabaseId"] = removeIds;
                                }
                                getCriteria["lock"] = false;
                                let result = events.getItemBy(2, getCriteria, repositories.Item.getUnassignedItems());

                                let cropping = result.slice(0, i.c);
                                debug.log(cropping,_.map(cropping,"rating"))
                                removeIds = removeIds.concat(cropping.map( i => {return i.databaseId}))
                                playerList = playerList.concat(cropping)
                            }
                        }
                        if(playerList.length){
                            events.playerListFillSquad(thisController._challenge,playerList,2);
                        }else{
                            e.setInteractionState(0)
                            events.notice("notice.noplayer",2)
                        }
                    },
                    "call-to-action"
                )
                if(events.isEligibleForOneFill(oneFillCriteria)){
                    this._fsu.autoFillBtn.tipsType = 1;
                }else if(_.size(oneFillCriteria) == 1){
                    if(oneFillCriteria[0].t.rs == 2){
                        this._fsu.autoFillBtn.tipsType = 2;
                    }else{
                        this._fsu.autoFillBtn.tipsType = 3;
                    }
                }
            }
        }else if(info.set.sbc_dupfill && repositories.Item.getUnassignedItems().length){

            //重复球员填充按钮
            this._fsu.dupFillBtn = events.createButton(
                new UTStandardButtonControl(),
                fy("dupfill.btntext"),
                (e) => {
                    const dupIds = _.map(
                        _.filter(repositories.Item.getUnassignedItems(),
                            p => p.isDuplicate() && p.isPlayer() && !p.isLimitedUse()
                        ),
                        'duplicateId'
                    );
                    let criteria = {
                        id:dupIds,
                        lock:false
                    }
                    criteria = events.ignorePlayerToCriteria(criteria);
                    let playerlist = events.getItemBy(2,criteria);
                    if(playerlist.length){
                        if(repositories.Item.getUnassignedItems().filter(i => {return i.duplicateId}).length > playerlist.length){
                            events.notice("notice.dupfilldiff",1)
                        }
                        const slotPlayer = thisController._squad.getPlayers().filter(slot => slot.item.id !== 0).map(slot => slot.item);
                        events.playerListFillSquad(thisController._challenge, slotPlayer.concat(playerlist), 1)
                    }else{
                        e.setInteractionState(0)
                        events.notice("notice.noplayer",2)
                    }
                },
                "call-to-action"
            )
        }
        
        //阵容补全按钮
        if( info.set.sbc_squadcmpl && hasRating){
            this._fsu.squadCmplBtn = events.createButton(
                new UTStandardButtonControl(),
                fy("squadcmpl.btntext"),
                (_e) => {
                    debug.log(thisController._challenge)
                    let va = thisController._squad.getNumOfRequiredPlayers() - thisController._squad.getFieldPlayers().filter(i => i.isValid()).length,
                    fillRating = events.needRatingsCount(hasRating, thisController._squad),
                    inputText = fy(va ? "squadcmpl.placeholder" : "squadcmpl.placeholder_zero");

                    if(fillRating.length && fillRating[0].lackRatings.length == 0 && fillRating[0].ratings.length && hasRating){
                        inputText = [fy("squadcmpl.placeholder"),fillRating.length == "0" && va == 0 ? "" : fillRating[0].ratings.join(`,`)];
                    }

                    if(exactRating){
                        inputText = [fy("squadcmpl.placeholder"), hasRating.toString()];
                    }

                    let popupBtns = hasRating && info.set.sbc_top ? [{ labelEnum: enums.UIDialogOptions.OK },{ labelEnum: 44401 },{ labelEnum: enums.UIDialogOptions.CANCEL },] : false;
                    events.popup(
                        fy("squadcmpl.popupt"),
                        fy("squadcmpl.popupm"),
                        (t,i) => {
                            if(t === 2){
                                const value = i.getValue(), 
                                reg = /^\d{2}([+\-]|-\d{2})?(,\d{2}([+\-]|-\d{2})?)*$/,
                                isValid = reg.test(value);

                                if (isValid || value === "") {
                                    const ratings = isValid ? value.split(',') : [];
                                    events.showLoader();
                                    const playerlist = events.getRatingPlayers(thisController._squad, ratings);
                                    events.playerListFillSquad(thisController._challenge, playerlist, 2);
                                } else {
                                    events.notice(fy("squadcmpl.error"), 2);
                                }
                            }
                            if(t === 44401){
                                thisController._fsu.countRating._tapDetected();
                            }
                        },
                        popupBtns,
                        inputText,
                        va,
                        fy(va ? "squadcmpl.popupmsup" : "squadcmpl.popupmsupallconcept")
                    )
                    if(fillRating.length && fillRating[0].ratings.length && fillRating[0].lackRatings.length == 0){
                        const squadRating = fillRating[0].squadRating ?? hasRating;
                        events.notice(["squadcmpl.simulatedsuccess",`${squadRating}`,`${fillRating[0].existValue.toLocaleString()}`],0)
                    }else if(va && !exactRating){
                        events.notice("squadcmpl.simulatederror",2)
                    }
                },
                "call-to-action"
            )
        }
    }
};
}

export function installSbcSquadDetailPanelPatches(deps) {
  const { info } = deps;
  //26.04 信息界面按钮载入
const UTSBCSquadDetailPanelViewController_initWithSBCSet = UTSBCSquadDetailPanelViewController.prototype.initWithSBCSet;
UTSBCSquadDetailPanelViewController.prototype.initWithSBCSet = function(...args) {
    UTSBCSquadDetailPanelViewController_initWithSBCSet.call(this, ...args);
    // debug.log(this)
    // debug.log(this._challenge.squadController)
    const fsu = this._challenge.squadController._fsu;
    const view = this.getView();
    const rewardElement = view._challengeDetails._groupRewardList.getRootElement();


    //添加排除球员选项按钮
    if(fsu?.ignoreBtn){
        rewardElement.appendChild(fsu.ignoreBtn.getRootElement())
        if(fsu?.ignoreText){
            fsu.ignoreBtn.getRootElement().after(fsu.ignoreText)   
        }
    }

    //添加快捷任务状态按钮
    if(fsu?.fastSbcStatsBtn){
        rewardElement.appendChild(fsu.fastSbcStatsBtn.getRootElement())
    }

    const exchangeElement = view._btnExchange.getRootElement();

    if(fsu.hasChemistry === 0){
        //添加一键填充按钮
        if(info.set.sbc_autofill && fsu?.autoFillBtn){
            exchangeElement.before(fsu.autoFillBtn.getRootElement())
        }

        //添加重复球员填充按钮
        if(info.set.sbc_dupfill && fsu?.dupFillBtn){
            exchangeElement.before(fsu.dupFillBtn.getRootElement())
        }

        //添加阵容补全按钮
        if(info.set.sbc_squadcmpl && fsu?.squadCmplBtn){
            exchangeElement.before(fsu.squadCmplBtn.getRootElement())
        }
        
        //非需求默契状态下
        Object.assign(view._btnSquadBuilder.getRootElement().style,{
            width: 'calc(100% - 1rem)',
            margin: '.5rem auto'
        });
        view._btnSquadBuilder.addClass("mini");
        rewardElement.appendChild(view._btnSquadBuilder.getRootElement());

        Object.assign(fsu.fillSquadBtn.getRootElement().style,{
            width: 'calc(100% - 1rem)',
            margin: '.5rem auto'
        });
        fsu.fillSquadBtn.addClass("mini");
    }

    //添加方案填充按钮
    if(info.set.sbc_template && fsu?.fillSquadBtn){
        view._btnSquadBuilder.getRootElement().after(fsu.fillSquadBtn.getRootElement());
    }

    const challengeDetails = view._challengeDetails.getRootElement();
    if(fsu?.bulkBuyBtn){
        challengeDetails.prepend(fsu.bulkBuyBtn.getRootElement())
        if(this._challenge.squad.isDream()){
            fsu.bulkBuyBtn.show();
        }
    }

    challengeDetails.style.backgroundColor = "#222426";
    exchangeElement.parentNode.style.paddingTop = "1rem";
};
}
