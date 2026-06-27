import { registerSbcSubPriceEvent } from "./sbc-squad.js";
import { installSbcChallengesPatch } from "./sbc-challenges.js";

export function registerSbcNavEvents(deps) {
  const { events, info, fy, cntlr, isPhone, repositories, services, futbinId, GM_openInTab } = deps;
  events.squadCount = (reqRating) => {
    let pa = cntlr.current()._squad.getFieldPlayers().map(i => {if(!i.isBrick() && i.item.rating && !i.item.concept){return i.item.rating}}).filter(Boolean),pr = "";
    if(pa.length > 0){
        pr = "&ratings=" + pa.join(",");
    }
    let dli = [...new Set(events.getItemBy(2,{"NEdatabaseId":cntlr.current()._squad.getFieldPlayers().map(i => i.item.databaseId).filter(Boolean)}).map(i => {return i.rating}))],
    br = reqRating > 84 ? 70 : reqRating < 61 ? 46 : reqRating - 15,
    cs = Array.from({ length: 30 }, (_, i) => i + br).filter(n => !dli.includes(n)),
    l = cs.length ? `&lock=${cs.join(",")}` : "";
    GM_openInTab(`https://futcd.com/sbc.html?target=${reqRating}${pr}${l}`, { active: true, insert: true, setParent :true });
}

//取出排重后的ID列表
events.getDedupPlayers = (s,p) => {
    let dp = p.map( i => {
        return i.item.databaseId
    }).filter(Boolean);
    let r = s.map( i => {
        if(typeof i === 'object'){
            if(!dp.includes(i.databaseId)){
                return i;
            }
        }else{
            if(!dp.includes(i)){
                return i;
            }
        }
    }).filter(Boolean);
    return r;
};

registerSbcSubPriceEvent({ events, info, fy, isPhone, repositories });
installSbcChallengesPatch({
    info,
    events,
    services,
    eligibilityKeys: SBCEligibilityKey,
    localize: fy
});

//打开futbin球员链接，需要元素携带data-id（球员id）和data-name（球员全称）
events.openFutbinPlayerUrl = async(e, player) => {
    events.showLoader();
    const fbId =
        info.futbinId[player.definitionId] ??
        await futbinId.getId(player);
    events.hideLoader();
    GM_openInTab(`https://www.futbin.com/${info.base.year}/player/${fbId}/1`, { active: true, insert: true, setParent :true });
};
//events.sbcInfoFill → registerSbcInfoFillEvent
events.getOddo = (t) => {
    if(_.has(info.base.oddo,t)){
        return info.base.oddo[t];
    }else{
        return 0;
    }
}
}
