export function registerLifecycleEvents(deps) {
  const { events, info, fy, debug } = deps;
  //26.04 通知特殊球员信息
events.noticeSpecialPlayerInfo = (player) => {
    if(info.specialPlayers?.DList?.includes(player.rareflag)){
        const days = Math.max(0, Math.ceil((info.specialPlayers.dynamic[player.rareflag].exp - Date.now()/1000) / (60 * 60 * 24)));
        events.notice(fy(["special.dynamic.notice", fy("special.dynamic"), days]), 1)
    }
    if(info.specialPlayers?.ECList?.includes(player.rareflag)){
        let extraChemInfo = [];
        _.forEach(info.extraChemKeys, key => {
            let value = info.specialPlayers.extraChem[player.rareflag][key];
            if(value > 0){
                extraChemInfo.push(fy([`special.extrachem.${key}`,  value]));
            }
        })
        events.notice(fy(["special.extrachem.notice", fy("special.extrachem"), extraChemInfo.join("、")]), 1)
    }
}

//26.04 位置合并
events.normalizePositions = positions => {
    const set = _.uniq(positions);
    if (_.includes(set, 'LB') && _.includes(set, 'RB')) {
        _.pull(set, 'LB', 'RB');
        set.push('LRB');
    }
    if (_.includes(set, 'LM') && _.includes(set, 'RM')) {
        _.pull(set, 'LM', 'RM');
        set.push('LRM');
    }
    if (_.includes(set, 'LW') && _.includes(set, 'RW')) {
        _.pull(set, 'LW', 'RW');
        set.push('LRW');
    }
    return set;
};

//26.04 新排序和筛选方法
events.listSortFilter = (controller, config) => {
    debug.log(controller, config)
    let players = controller._fsu.Players.filter(p => {
        if (config.position.visible && config.position.select) {
            if (!p.possiblePositions.includes(config.position.id)) {
                return false;
            }
        }
        if (config.quality.visible && config.quality.select) {
            if (
                config.quality.select === 1
                    ? p.rareflag >= 2
                    : p.rareflag < 2
            ) {
                return false;
            }
        }
        if (config.scope.visible && config.scope.select) {
            const pile =
                config.scope.select === 1 ? ItemPile.STORAGE : ItemPile.CLUB;
            if (p.pile !== pile) {
                return false;
            }
        }
        return true;
    });
    const sortRules = [];

    if (config.chemistry.order) {
        sortRules.push(
            {
                key: p => controller._fsu.chemistry[p.definitionId].squad,
                order: config.chemistry.order
            },
            {
                key: p => controller._fsu.chemistry[p.definitionId].points,
                order: config.chemistry.order
            }
        );
    }

    if (config.rating.order) {
        const ratingRule = {
            key: "rating",
            order: config.rating.order
        };

        if (config.priority === "rating") {
            sortRules.unshift(ratingRule);
        } else {
            sortRules.push(ratingRule);
        }
    }

    sortRules.push(
        { key: "untradeableCount", order: "desc" },
        { key: "rareflag", order: "asc" },
        { key: "pile", order: "desc" },
        { key: "_itemPriceLimits.minimum", order: "asc" },
        { key: "_itemPriceLimits.maximum", order: "asc" }
    );

    players = _.orderBy(
        players,
        sortRules.map(r => r.key),
        sortRules.map(r => r.order)
    );
    
    controller.clubViewModel.resetCollection(players);
    controller.clubViewModel.isFull = true;
    controller.updateItemList(controller.clubViewModel.getPageItems());
}
}

import { CachePruner } from "../core/CachePruner.js";

export function installLifecyclePatches(deps) {
  const { events, cntlr, isPhone, info } = deps;
  const cachePruner = new CachePruner(() => info);
  //26.04 销毁释放资源方法
events.fsuDispose = function (controller, key) {
    const container = controller?.[key];
    if (!container || typeof container !== "object") return;
    Object.keys(container).forEach(k => {
        const v = container[k];
        if (v instanceof EAView) {
            v.dealloc();
        } else if (v instanceof Element) {
            v.isConnected && v.remove();
        }

        container[k] = null;
    });
    controller[key] = null;
    cachePruner?.pruneAll?.();
    events.invalidatePlayerSearchCache?.();
};


//26.04 界面控制器销毁事件
const EAViewController_dealloc = EAViewController.prototype.dealloc;
EAViewController.prototype.dealloc = function (...args) {

    //清除创建的资源
    events.fsuDispose(this, "_fsu")

    //EA本身清除资源
    EAViewController_dealloc.call(this, ...args)
}
//26.04 界面视图销毁事件
const EATargetActionView_dealloc = EATargetActionView.prototype.dealloc;
EATargetActionView.prototype.dealloc = function (...args) {
    //清除创建的资源
    events.fsuDispose(this, "_fsu")

    //EA本身清除资源
    EATargetActionView_dealloc.call(this, ...args)
}

//26.04 卡片销毁事件
const UTPlayerItemView_dealloc = UTPlayerItemView.prototype.dealloc;
UTPlayerItemView.prototype.dealloc = function (...args) {

    //清除创建的资源
    events.fsuDispose(this, "_fsu")

    //EA本身清除资源
    UTPlayerItemView_dealloc.call(this, ...args)
}

//26.04 阵容选择位置
events.squadPositionSelection = async(controller, criteria, players) => {
    let squadController = controller;
    //手机端关闭弹窗
    if (isPhone()) {
        //等待书写
    }

    let vacancySlot = _.find(controller._squad.getNonBrickSlots(), slot => !slot.isValid() && !slot.isBrick());
    if(vacancySlot){
        let selectSlotIndex = vacancySlot.index;
        controller.getView().slotViews[selectSlotIndex]._tapDetected()
    }else{
        let currentSelected = controller.getView().getSelectedSlot();
        if(!currentSelected){
            let selectSlotIndex = _.find(squadController._squad.getNonBrickSlots())?.index;
            let conceptSlot = _.find(controller._squad.getNonBrickSlots(), slot => slot.isValid() && slot.item.concept);
            if(conceptSlot){
                selectSlotIndex = conceptSlot.index;
            }
            controller.getView().slotViews[selectSlotIndex]._tapDetected()
            
        }else{
            currentSelected._tapDetected()
        }
    }

    

    let attempts = 0;
    const maxAttempts = 20; // 最多尝试 50 次 (约 5 秒)
    while (!((isPhone() ? cntlr.current().currentController : cntlr.right()) instanceof UTSlotDetailsViewController)) {
        if (attempts >= maxAttempts) {
            console.error("等待超时：目标控制器未出现");
            return; // 或者抛出错误
        }
        attempts++;
        await events.wait(0.3, 0.3);
    }

    events.SBCDisplayPlayers((isPhone() ? cntlr.current().currentController : cntlr.right()) , criteria, players)
};
}
