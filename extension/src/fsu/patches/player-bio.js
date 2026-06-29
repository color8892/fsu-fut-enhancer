export function installPlayerBioPatches(deps) {
  const { events, cntlr, services, debug, fy, repositories } = deps;
  /** 球员简历页面 */
//24.18 可进化标识：球员预览属性标注
//25.01 角色分页插入评分
//26.02 合并原有错误的两个事件
const UTPlayerBioView_render = UTPlayerBioView.prototype.render;
UTPlayerBioView.prototype.render = function(t, e, i){
    UTPlayerBioView_render.call(this, t, e, i);
    if(_.some(cntlr.current().getNavigationController()._childViewControllers, { className: 'UTAcademySlotItemDetailsViewController' })){
        this.fsuAcademy = true;
    }
    if("fsuAcademy" in this && this.fsuAcademy){
        if(e.getMetaData().id !== e.definitionId){
            let newMeta = repositories.PlayerMeta.get(e.definitionId);
            if(newMeta){
                e.setMetaData(newMeta)
            }else{
                debug.log("尝试载入Meta失败")
            }
        }
        if(!("fsuAcademyChange" in this)){
            this.fsuAcademyChange = {};
            const nowPlayer = this.fsuAcademy.nowPlayer;
            debug.log(e, nowPlayer)
            let infoChange = [],attrChange = [],styleChange = [],roleChange = [];
            if(e.rareflag !== nowPlayer.rareflag){
                infoChange.push({type:0,index:0,value:0,count:true});
            }
            const posDiff = e.possiblePositions.length - nowPlayer.possiblePositions.length;
            if(posDiff){
                infoChange.push({type:1,index:6,value:posDiff,count:true});
            }
            let posAdd = e.possiblePositions.length > 1 ? 1 : 0;
            const weakFootDiff = e.getWeakFoot() - nowPlayer.getWeakFoot();
            if(weakFootDiff){
                infoChange.push({type:1,index:7 + posAdd,value:weakFootDiff,count:true});
            }
            const skillMovesDiff = e.getSkillMoves() - nowPlayer.getSkillMoves();
            if(skillMovesDiff){
                infoChange.push({type:1,index:8 + posAdd,value:skillMovesDiff,count:true});
            }
            if(infoChange.length){
                this.fsuAcademyChange[PlayerBioDisplayGroup.INFO] = infoChange;
            }
            const ratingDiff = e.rating - nowPlayer.rating;
            if(ratingDiff){
                attrChange.push({type:1,index:0,value:ratingDiff,count:true});
            }


            let attrCount = 0,
                cardAttr = this.__pinnedDiv.querySelectorAll(".player-stats-data-component .value");
            _.map(e.getAttributes(), (value, index) => {
                attrCount++;
                const attribute = value - nowPlayer.getAttribute(index);
                if(attribute){
                    attrChange.push({type:1,index:attrCount,value:attribute,count:true});
                    if(cardAttr.length == 6){
                        cardAttr[index].style.color = "#00A7CC";
                    }
                }
                _.map(e.getSubAttributesByParent(index),sValue => {
                    attrCount++;
                    const subAttributeDiff = e.getSubAttribute(sValue).value() - nowPlayer.getSubAttribute(sValue).value();
                    if(subAttributeDiff){
                        attrChange.push({type:1,index:attrCount,value:subAttributeDiff,count:false});
                    }
                })
            });
            if(attrChange.length){
                this.fsuAcademyChange[PlayerBioDisplayGroup.ATTRIBUTES] = attrChange;
            }


            let styleCount = 0;
            _.map(_.groupBy(e.getPlayStyles(), 'category'),value => {
                _.map(value,sValue => {
                    const nowStyle = _.find(nowPlayer.getPlayStyles(), { traitId: sValue.traitId });
                    let styleAddType = 0;
                    if(nowStyle){
                        if(sValue.isIcon && !nowStyle.isIcon){
                            styleAddType = 2;
                        }
                    }else{
                        styleAddType = 3;
                    }
                    if(styleAddType){
                        styleChange.push({type:styleAddType,index:styleCount,value:0,count:true})
                    }
                    styleCount++;
                })
            })
            if(styleChange.length){
                this.fsuAcademyChange[PlayerBioDisplayGroup.TRAITS] = styleChange;
            }

            let roleCont = 0;
            const plusRolePos = _.uniq(_.map(e.getPlusRoles(), "position"));
            _.forEach(e.possiblePositions,posId => {
                let roleIds = services.Squad.getRoleIdsForPosition(posId);
                if(!_.includes(nowPlayer.possiblePositions, posId)){
                    _.forEach(roleIds,roleId => {
                        debug.log(roleCont, posId, roleId, "新增")
                        roleChange.push({type:1,index:roleCont,value:0,count:true});
                        roleCont++;
                    })
                }else{
                    if(_.includes(plusRolePos, posId)){
                        let plusPlusRoles = [], 
                            plusRoles = [], 
                            baseRoles = [];
                        const getRoleTypes = (player, method, posId) => _.map(_.filter(player[method](), { position: posId }), "type");
                        const posPlusPlusRoles = getRoleTypes(e, "getPlusPlusRoles", posId);
                        const posPlusRoles = getRoleTypes(e, "getPlusRoles", posId);
                        const nowPosPlusPlusRoles = getRoleTypes(nowPlayer, "getPlusPlusRoles", posId);
                        const nowPosPlusRoles = getRoleTypes(nowPlayer, "getPlusRoles", posId);
                        _.forEach(roleIds,roleId => {
                            if(_.includes(posPlusPlusRoles, roleId)){
                                plusPlusRoles.push(roleId);
                                if(!_.includes(nowPosPlusPlusRoles, roleId)){
                                    debug.log(roleCont, posId, roleId, "升级")
                                    roleChange.push({type:2,index:roleCont,value:0,count:true});
                                }
                            }else if(_.includes(posPlusRoles, roleId)){
                                plusRoles.push(roleId);
                                if(!_.includes(nowPosPlusRoles, roleId)){
                                    debug.log(roleCont, posId, roleId, "升级")
                                    roleChange.push({type:2,index:roleCont,value:0,count:true});
                                }
                            }else{
                                baseRoles.push(roleId);
                            }
                            roleCont++;
                        })
                        
                    }else{
                        _.forEach(roleIds,_roleId => {
                            roleCont++;
                        })
                    }
                }
            })
            if(roleChange.length){
                this.fsuAcademyChange[PlayerBioDisplayGroup.ROLES] = roleChange;
            }
            

            //插入数字显示
            _.map(this._navigation.items,i => {
                if(_.has(this.fsuAcademyChange, i.id)){
                    let count = _.size(_.filter(this.fsuAcademyChange[i.id], { 'count': true }))
                    if(count){
                        i.addNotificationBubble(count)
                    }
                }
            })

            //插入价格显示
            if(_.isObject(this.fsuAcademy)){
                let coins = this.fsuAcademy.getPrice(GameCurrency.COINS),points = this.fsuAcademy.getPrice(GameCurrency.POINTS);
                let priceBox = events.createElementWithConfig("div", {
                    classList:["ut-academy-slot-tile-view--prices"],
                });
                let titleBox = events.createElementWithConfig("div", {
                    textContent:services.Localization.localize("undoDiscard.row.priceLabel"),
                    style:{
                        paddingRight:".5rem",
                        fontSize:".8rem",
                    }
                });
                priceBox.appendChild(titleBox);
                if(coins){
                    let coinsBox = events.createElementWithConfig("span", {
                        classList:["ut-academy-slot-tile-view--prices-coins"],
                        textContent:services.Localization.localizeNumber(coins)
                    });
                    priceBox.appendChild(coinsBox);
                }
                if(points){
                    let pointsBox = events.createElementWithConfig("span", {
                        classList:["ut-academy-slot-tile-view--prices-points"],
                        textContent:services.Localization.localizeNumber(points)
                    });
                    priceBox.appendChild(pointsBox);
                }
                if(!coins && !points){
                    let freeBox = events.createElementWithConfig("span", {
                        textContent:fy("academy.freetips")
                    });
                    priceBox.appendChild(freeBox);
                }
                this.__pinnedDiv.querySelector(".entityContainer").style.width = "100%";
                this.__pinnedDiv.querySelector(".entityContainer").appendChild(priceBox);
            }

            if(_.isObject(this.fsuAcademy)){
                this.fsuAcademy.status === AcademySlotState.NOT_STARTED && (this.fsuAcademy.player = new UTNullItemEntity,
                this.fsuAcademy.levels.forEach(function(e) {
                    return e.boostedPlayer = null
                }))
            }
        }
        if(_.has(this,"fsuAcademyChange") && _.has(this.fsuAcademyChange,t) && t !== PlayerBioDisplayGroup.ROLES){
            let changeAttr = this.fsuAcademyChange[t],
                textType = ["change","add","upgrade","new"],
                queryType = {"0":"h1","1":".title","3":"span","4":"span"},
                attrElement = this.__dataDisplay.querySelectorAll("li");
            let changeElementTemplate = events.createElementWithConfig("span", {
                textContent:"",
                style:{
                    paddingLeft:".2rem",
                    fontSize:"80%",
                    color:"#00d1ff"
                }
            })
            _.map(changeAttr,a => {
                if(_.has(attrElement,a.index)){
                    let targetElement = attrElement[a.index].querySelector(queryType[t]);
                    let changeElement = changeElementTemplate.cloneNode(true);
                    changeElement.textContent = fy(a.type == 1 ? [`academy.bio.${textType[a.type]}`,a.value] : `academy.bio.${textType[a.type]}`);
                    targetElement.appendChild(changeElement)
                }
            })
        }
    }
}

/** 球员简历页面-位置选项浏览界面 */
//26.02 添加
const UTPlayerBioView_renderPlayerRoles = UTPlayerBioView.prototype.renderPlayerRoles;
UTPlayerBioView.prototype.renderPlayerRoles = function(item) {
    UTPlayerBioView_renderPlayerRoles.call(this, item)
    if(_.has(this,"fsuAcademyChange") && _.has(this.fsuAcademyChange,PlayerBioDisplayGroup.ROLES)){
        let roleChange = this.fsuAcademyChange[PlayerBioDisplayGroup.ROLES];
        let textType = ["change","add","upgrade","new"];
        let roleElement = this.__dataDisplay.querySelectorAll("span");
        let changeElementTemplate = events.createElementWithConfig("span", {
            textContent:"",
            style:{
                paddingLeft:".2rem",
                fontSize:"80%",
                color:"#00d1ff"
            }
        })
        debug.log(roleChange)
        _.forEach(roleChange,change => {
            if(_.size(roleElement) >= change.index){
                let targetElement = roleElement[change.index];
                let changeElement = changeElementTemplate.cloneNode(true);
                changeElement.textContent = fy(`academy.bio.${textType[change.type]}`);
                targetElement.appendChild(changeElement);
                Object.assign(targetElement.style,{
                    width:"100%",
                    alignItems:"center",
                    juestifyContent:"space-between",
                })
                let plusElement = targetElement.querySelector(".ut-player-bio-role-cell-view--familiarity");
                if(plusElement){
                    plusElement.style.flex = "1";
                }
                debug.log(targetElement)
            } 
        })
    }
}
}
