export function installLocalizationPatch(deps) {
  const { call } = deps;
  //24.20 临时解决秒数无法显示的问题
//如修复则进行删除
EALocalizationService.prototype.localize = function(t, e, i) {
    if(t == "timespan.second"){
        t = "timespan.seconds"
    }
    let text = call.other.localize.call(this,t,e,i);
    return text;
}
}

export function registerPlayerMetaEvents(deps) {
  const { events, info, fy, services } = deps;
  //24.23 增加读取meta属性
//25.01 修改变为新meta显示方式
events.getPlayerMetaToText = (p) => {
    let m;
    let unknown = {
        "base":{
            "chemstyle":250,
            "name":fy("meta.role.unknown"),
            "rank":"?",
            "rankBg":"rgba(255, 255, 255, 0.8)",
            "id":-1,
            "plus":0,
            "rating":"?"
        }
    }
    if(p.academy){
        return unknown;
    }
    if(!(_.has(info.meta,p.definitionId))){
        info.meta[p.definitionId] = {
            "text": unknown
        }
    }
    m = info.meta[p.definitionId];
    if(_.has(m,"text")){
        return m.text;
    }else{
        let mt = {};
        let tacticRoles = services.Squad.getTacticRoles().map(function(z) {
            return z.type
        });
        let tempRole = _.map(p.possiblePositions,i => {
            return UTPlayerRoleVO.getRolesForPositionId(i);
        })
        let role = _.sortBy(_.uniq(_.intersection(_.flatten(tempRole), tacticRoles)));
        let plus = _.map(p.basePlusRoles,i => {
            return i.type;
        })
        plus = _.uniq(plus);
        let plusPlus = _.map(p.basePlusPlusRoles,i => {
            return i.type;
        })
        plusPlus = _.uniq(plusPlus);
        let base = 0;
        let rankText = ["S","A","B","C","D"];
        let rankBgColor = ["rgba(220,38,38,0.8)","rgba(251,146,60,0.8)","rgba(168,85,247,0.8)","rgba(6,182,212,0.8)","rgba(34,197,94,0.8)"];
        let eioNames = ["none","goalkeeper","sweeper_keeper","fullback","wingback","falseback","attacking_wingback","defender","stopper","ball_playing_defender","centre_half","holding","deep_lying_playmaker","box_to_box","playmaker","half_winger","winger","wide_playmaker","wide_midfielder","inside_forward","shadow_striker","target_forward","false_nine","poacher","advanced_forward"]
        _.forEach(role,(r,i) => {
            if(_.has(m.meta,i)){
                let rm = {};
                rm["name"] = UTLocalizationUtil.mapTacticRoleToLocString(r);
                rm["id"] = r;
                rm["rating"] = m.meta[i][0];
                rm["chemstyle"] = m.meta[i][1] + 250;
                let customSortedIndex = _.findIndex(info.meta.rank[r], (value) => value <= rm["rating"]);
                let rankIndex = customSortedIndex === -1? info.meta.rank[r].length : customSortedIndex;
                rm["rank"] = rankText[rankIndex];
                rm["rankBg"] = rankBgColor[rankIndex];
                rm["plus"] = 0;
                rm["eioName"] = eioNames[r];
                if(_.includes(plus,r)){
                    rm["plus"] = 1;
                }else if(_.includes(plusPlus,r)){
                    rm["plus"] = 2;
                }
                mt[r] = rm;
                if(base == 0 || rm["rating"] > base || (rm["rating"] == base && rm["plus"] > mt["base"]["plus"])){
                    base = rm["rating"];
                    mt["base"] = rm;
                }
            }
        })
        if(_.size(mt)){
            if(_.has(mt,"base")){
                let namePlus = "";
                for (let i = 0; i < mt["base"].plus; i++) {
                    namePlus += '+';
                }
                mt["base"].name += namePlus;
            }
            info.meta[p.definitionId][`text`] = mt;
        }
        return mt;
    }
}

//25.01 新增meta popup文本显示方法
events.getPlayerMetaPopupText = (meta,pos) => {
    let t = "";
    let v = "";
    let sl = services.Localization;
    let desc = meta.id == -1 ? meta.name : sl.localize(`tactics.roles.role${meta.id}.description`);
    if(pos){
        let vs = UTPlayerRoleVO.getVariationsForRoleAndPositionId(pos,meta.id);
        let vsa = _.map(vs,vt => {
            return sl.localize("tactics.roles.variation" + vt);
        })
        v = fy(["plyers.relo.popupm.v1",vsa.join("、")])
    }else{
        v = fy("plyers.relo.popupm.v2")
    }
    return fy([
        "plyers.relo.popupm",
        meta.name,
        sl.localize(`playstyles.playstyle${meta.chemstyle}`),
        desc,
        v,
        meta.rank,
        meta.rating
    ])
}
}
