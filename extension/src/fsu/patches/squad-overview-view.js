export function installSquadOverviewViewPatches(deps) {
  const { call, events, info, fy, cntlr, isPhone, repositories, services, debug, SBCEligibilityKey, GM_openInTab } = deps;
  //26.04 改用新的快捷球员载入方法
UTSquadOverviewViewController.prototype.viewDidAppear = function() {
    call.plist.squad.call(this);

    this._fsu ??= {};

    if(info.set.info_squad && !_.has(this._fsu, "squadValueBox")){

        const squadPrice = _.sumBy(this._squad.getFieldPlayers(), i => events.getCachePrice(i.item.definitionId, 1).num);

        let squadValueBox = events.createElementWithConfig("div", {
            classList: ["fsu-SquadValue"]
        })
        this._fsu.squadValueBox = squadValueBox;
        
        let squadValue = events.createElementWithConfig("div", {
            classList: ["fsu-SquadValueItem"]
        })
        squadValue.appendChild(
            events.createElementWithConfig("div", {
                textContent: fy("sbc.topsquad"),
                classList: ["fsu-SquadValueTitle"]
            })
        )
        squadValue.appendChild(
            events.createElementWithConfig("div", {
                textContent: squadPrice.toLocaleString(),
                classList: ["fsu-SquadValuePrice", "currency-coins"],
                attributes: {
                    "id": "squadValue",
                }
            })
        )
        squadValueBox.appendChild(squadValue)
        this._fsu.squadValue = squadValue;


        if(this._squad.isSBC()){

            const sbcStat = info.task.sbc.stat?.[this._set.id];

            let price = (this._set.challengesCount === 1)
                ? sbcStat?.[info.base.platform]
                : sbcStat?.child?.[this._challenge.id]?.price;

            price = price || 0;
            
            let SBCValue = events.createElementWithConfig("div", {
                classList: ["fsu-SquadValueItem"]
            })
            SBCValue.appendChild(
                events.createElementWithConfig("div", {
                    textContent: fy("sbc.topprice"),
                    classList: ["fsu-SquadValueTitle"]
                })
            )
            SBCValue.appendChild(
                events.createElementWithConfig("div", {
                    textContent: price.toLocaleString(),
                    classList: ["fsu-SquadValuePrice", "currency-coins"]
                })
            )
            squadValueBox.appendChild(SBCValue)
            this._fsu.SBCValue = SBCValue;
        }

        this.getView().getPitch().getRootElement().prepend(squadValueBox)
    }
    
    events.loadPlayerInfo(_.map(this._squad._players,"_item"));



    if(this._squad.isSBC()  && !_.has(this._fsu, "quickTop")){

        if(isPhone()){
            this.getView()._detailsButton.__root.style.zIndex = 999;
        }
        let eligibility = this._challenge.eligibilityRequirements;
        let baseRating = 0;
        let listType = 1; //1为普通 2为最低评分模式 3正好评分模式
        let isQuality = false;
        let qualityType = 0;
        let maxRating = 99;

        

        const thisController = this;

        if(info.set.sbc_top){
            this._fsu.baseRating = baseRating;
            let quickTop = events.createElementWithConfig("div",{
                classList:["fsu-quick","top"]
            })
            this._fsu.quickTop = quickTop;

            let quickOther = events.createElementWithConfig("div",{
                classList:["fsu-quick-list","other"]
            })
            this._fsu.quickOther = quickOther;
        }

        for (let i of eligibility) {
            if(this._fsu?.quickOther){
                
                //评分计算按钮
                if(i.kvPairs._collection.hasOwnProperty(SBCEligibilityKey.TEAM_RATING)){
                    baseRating = i.kvPairs._collection[SBCEligibilityKey.TEAM_RATING][0];
                    this._fsu.countRating = events.createButton(
                        new UTButtonControl(),
                        fy("sbc.count"),
                        () => {
                            events.squadCount(baseRating);
                        },
                        "im"
                    )
                    this._fsu?.quickOther.append(this._fsu.countRating.getRootElement());
                }

                //抄作业按钮
                if(i.kvPairs._collection.hasOwnProperty(SBCEligibilityKey.CHEMISTRY_POINTS) || i.kvPairs._collection.hasOwnProperty(SBCEligibilityKey.ALL_PLAYERS_CHEMISTRY_POINTS)){
                    this._fsu.consult = events.createButton(
                        new UTButtonControl(),
                        fy("sbc.consult"),
                        () => {
                            GM_openInTab(`https://www.futbin.com/squad-building-challenges/ALL/${this._challenge.id}/list`, { active: true, insert: true, setParent :true });
                        },
                        "im"
                    )
                    this._fsu?.quickOther.append(this._fsu.consult.getRootElement());
                }
            }
            

            //24.16 交换SBC优化：新加入快捷计算评分类型
            if(i.kvPairs._collection.hasOwnProperty(SBCEligibilityKey.PLAYER_MIN_OVR) && eligibility.length == 1){
                baseRating = i.kvPairs._collection[SBCEligibilityKey.PLAYER_MIN_OVR][0];
                listType = 2;
            }

            //25.10 加入品质计算
            if(i.kvPairs._collection.hasOwnProperty(SBCEligibilityKey.PLAYER_QUALITY)){
                qualityType = i.kvPairs._collection[SBCEligibilityKey.PLAYER_QUALITY][0];
                isQuality = true;
                if(qualityType == 1){
                    baseRating = 45;
                    maxRating = 63;
                }else if(qualityType == 2){
                    baseRating = 65;
                    maxRating = 74;
                }else{
                    baseRating = 75;
                    maxRating = info.set.goldenrange;
                }
                listType = 2;
            }

            //25.21 加入正好评分球员计算
            if(i.kvPairs._collection.hasOwnProperty(SBCEligibilityKey.PLAYER_EXACT_OVR) && eligibility.length == 1){
                baseRating = i.kvPairs._collection[SBCEligibilityKey.PLAYER_EXACT_OVR][0];
                listType = 3;
            }
        }

        //25.10 判断是否可以快速完成并插入按钮
        if(_.size(info.base.fastsbc) > 0 && this._fsu?.quickOther){
            let sId = this._set.id,
                cId = this._challenge.id,
                q = info.base.fastsbc[`${cId}#${sId}`];
            if(q){

                let qs = events.fastSBCQuantity(true,_.filter(repositories.Item.getUnassignedItems(), item => item.isPlayer() && item.duplicateId !== 0),q);
                if(qs){

                    this._fsu.quicklyBtn = events.createButton(
                        new UTButtonControl(),
                        fy(["fastsbc.sbcbtntext",qs]),
                        () => {
                            if (info.base.fastsbctips) {
                                events.isSBCCache(sId, cId)
                            } else {
                                events.popup(
                                    fy("fastsbc.popupt"),
                                    fy("fastsbc.popupm"),
                                    (t) => {
                                        if (t === 2) {
                                            info.base.fastsbctips = true;
                                            events.isSBCCache(sId, cId)
                                        }
                                    }
                                )
                            }
                        },
                        "im"
                    );
                    this._fsu.quicklyBtn.getRootElement().style.fontSize = "90%";
                    this._fsu?.quickOther.append(this._fsu.quicklyBtn.getRootElement());
                }
            }
        }


        let ratingStart = baseRating !== 0 ? baseRating : 75;


        let ratingArray = [],
        ratingLimit = listType == 1 ? (isPhone() ? [4,8] : [5,10]) : (listType == 2 ? (isPhone() ? [0,8] : [0,10]) : [0,1]);
        for (let i = 1; i < 11; i++) {
            if(listType == 2 || listType == 3){
                break;
            }
            if(events.getDedupPlayers(events.getItemBy(1,{"rating":ratingStart - i}),this._squad.getPlayers()).length){
                ratingArray.push(ratingStart-i);
            }
            if(ratingArray.length == ratingLimit[0]){
                break;
            }
        }
        for (let i = 0; i < maxRating - ratingStart; i++) {
            if(events.getDedupPlayers(events.getItemBy(1,{"rating":ratingStart + i}),this._squad.getPlayers()).length){
                ratingArray.unshift(ratingStart + i);
            }
            if(ratingArray.length == ratingLimit[1]){
                break;
            }
        }
        if(ratingStart !== 0 && ratingArray.length && this._fsu?.quickTop){
            let quickLeft = events.createElementWithConfig("div",{
                classList: ["fsu-quick-list","left"]
            });
            this._fsu?.quickTop.append(quickLeft);
            this._fsu.quickLeft = quickLeft;

            if(!isQuality && !qualityType){
                if(listType !== 3){
                    let ratPlus = Number(ratingArray[0]) + 1;
                    let leftRatingPlusBtn = events.createButton(
                        new UTButtonControl(),
                        "",
                        () => {
                            events.squadPositionSelection(
                                thisController,
                                {GTrating:ratPlus},
                                null
                            )
                        },
                        "im"
                    )
                    leftRatingPlusBtn.getRootElement().innerHTML = `<span> >= </span>${ratPlus}`;
                    this._fsu.leftRatingPlusBtn = leftRatingPlusBtn;
                    quickLeft.append(leftRatingPlusBtn.getRootElement());
                }

                if(listType == 1){
                    let ratMinus = Number(ratingArray[ratingArray.length - 1]) - 1;
                    let leftRatingMinusBtn = events.createButton(
                        new UTButtonControl(),
                        "",
                        () => {
                            events.squadPositionSelection(
                                thisController,
                                {LTrating:ratMinus},
                                null
                            )
                        },
                        "im"
                    )
                    leftRatingMinusBtn.getRootElement().innerHTML = `<span> <= </span>${ratMinus}`;
                    this._fsu.leftRatingMinusBtn = leftRatingMinusBtn;
                    quickLeft.append(leftRatingMinusBtn.getRootElement());
                }
            }else{
                let leftQalityBtn = events.createButton(
                    new UTButtonControl(),
                    "",
                    () => {
                        events.squadPositionSelection(
                            thisController,
                            {rs: qualityType - 1},
                            null
                        )
                    },
                    "im"
                )
                leftQalityBtn.getRootElement().innerHTML = `${ratingStart}<span>-</span>${maxRating}`;
                this._fsu.leftQalityBtn = leftQalityBtn;
                quickLeft.append(leftQalityBtn.getRootElement());
            }
        }
        if(this._fsu?.quickOther.innerHTML !== ""){
            this._fsu?.quickTop.append(this._fsu?.quickOther);
        }
        //初始载入保存阵容
        events.saveOldSquad(this._squad,false,true);
        info.douagain.sbc = this._set.id;

        //24.15 头部快捷入口：进入SBC插入到SBCLIST
        events.SBCListInsertToFront(this._set.id,1);


        if(info.set.sbc_right){
            let quickRight = events.createElementWithConfig("div",{
                classList: ["fsu-quick","right"]
            });
            this._fsu.quickRight = quickRight;
            let quickRightList = events.createElementWithConfig("div",{
                classList: "fsu-quick-list"
            });
            quickRight.appendChild(quickRightList)
            this._fsu.quickRightList = quickRightList;

            for (let i of ratingArray) {
                let rightRatingBtn = events.createButton(
                    new UTButtonControl(),
                    i,
                    () => {
                        events.squadPositionSelection(
                            thisController,
                            {rating: i},
                            null
                        )
                    },
                    "im"
                );
                this._fsu[`rightRatingBtn_${i}`] = rightRatingBtn;
                quickRightList.append(rightRatingBtn.getRootElement());
            }

            //未分配按钮
            if(repositories.Item.numItemsInCache(ItemPile.PURCHASED)){
                let unassignedBtn = events.createButton(
                    new UTButtonControl(),
                    fy("sbc.qucikdupes"),
                    () => {
                        const squadDefIds = _.map(thisController._squad.getPlayers(),"item.definitionId");
                        const duplicatePlayers = _.map(repositories.Item.unassigned.filter(t => {
                            return !squadDefIds.includes(t.definitionId)
                        }), "duplicateId")
                        const players = events.getItemBy(2, {"id": duplicatePlayers});
                        if(players.length){
                            events.squadPositionSelection(
                                thisController,
                                null,
                                players
                            )
                        }else{
                            events.notice("notice.noplayer",2);
                        }
                    },
                    "im"
                );
                this._fsu.unassignedBtn = unassignedBtn;
                quickRightList.append(unassignedBtn.getRootElement());
            }

            //转会按钮
            if(repositories.Item.numItemsInCache(ItemPile.TRANSFER)){
                let transferBtn = events.createButton(
                    new UTButtonControl(),
                    fy("sbc.quciktransfers"),
                    () => {
                        const squadDefIds = _.map(thisController._squad.getPlayers(),"item.definitionId");
                        const duplicatePlayers = _.map(repositories.Item.transfer.filter(t => {
                            return !squadDefIds.includes(t.definitionId) && t.getAuctionData().isInactive()
                        }), "duplicateId")
                        const players = events.getItemBy(2, {"id": duplicatePlayers});
                        if(players.length){
                            events.squadPositionSelection(
                                thisController,
                                null,
                                players
                            )
                        }else{
                            events.notice("notice.noplayer",2);
                        }
                    },
                    "im"
                );
                this._fsu.transferBtn = transferBtn;
                quickRightList.append(transferBtn.getRootElement());
            }

            //仓库按钮
            if(repositories.Item.numItemsInCache(ItemPile.STORAGE)){
                let storageBtn = events.createButton(
                    new UTButtonControl(),
                    fy("sbc.qucikstorage"),
                    () => {
                        events.squadPositionSelection(
                            thisController,
                            null,
                            repositories.Item.getStorage().values()
                        )
                    },
                    "im"
                );
                this._fsu.storageBtn = storageBtn;
                quickRightList.append(storageBtn.getRootElement());
            }

            //回退按钮
            if(info.set.sbc_sback){
                let squadBackBtn = events.createButton(
                    new UTButtonControl(),
                    fy("sbc.squadback"),
                    () => {
                        let count = thisController._squad._fsu.oldSquadCount;
                        if(count){
                            events.popup(
                                fy("squadback.popupt"),
                                fy(["squadback.popupm",count]),
                                (t) => {
                                    if(t === 2){
                                        events.showLoader();
                                        let squad = thisController._squad._fsu.oldSquad[count - 1]
                                        events.saveSquad(thisController._challenge, thisController._squad, squad, []);
                                        thisController._squad._fsu.oldSquadCount--;
                                        thisController._squad._fsu.oldSquad.pop();
                                    }
                                }
                            )
                        }else{
                            events.notice("notice.nosquad",2);
                        }
                    },
                    "im"
                );
                this._fsu.backBtn = squadBackBtn;
                quickRightList.append(squadBackBtn.getRootElement());
            }
            this.getView()._summaryPanel.getRootElement().after(quickRight);
        }

        if(info.set.sbc_top){
            this.getView()._summaryPanel.getRootElement().append(this._fsu?.quickTop);
        }
    }
}
}
