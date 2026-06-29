export function registerUiUtilsEvents(deps) {
  const { events, info, cntlr, fy, services } = deps;
  events.waitForClickShieldToHide = (callback, timeout = 5000) => {
    const start = Date.now();

    const interval = setInterval(() => {
        if (!gClickShield.isShowing()) {
            clearInterval(interval);
            callback();
        } else if (Date.now() - start > timeout) {
            clearInterval(interval);
            console.warn("等待 gClickShield 隐藏超时");
        }
    }, 100);
};

events.getAcceleRate = (player, chem = 3, styleId = player.playStyle) => {
    const height = player.getMetaData()?.height ?? 0;
    const gender = player.gender;
    const acceleration = events.getBoostedAttribute(player, styleId, chem, 0);
    const agility = events.getBoostedAttribute(player, styleId, chem, 2);
    const strength = events.getBoostedAttribute(player, styleId, chem, 6);

    let type;
    if (agility >= 80 && (agility - strength) >= 10 && acceleration >= 65 && height <= (gender ? 162 : 182)) {
        type = 'E';
    }
    else if (strength >= 65 && (strength - agility) >= 4 && acceleration >= 40 && height >= (gender ? 165 : 185)) {
        type = 'L';
    }
    else {
        type = 'C';
    }
    return type;
}
events.accelePopup = (player, _isLoadMeta) => {
    let sl = services.Localization;
    gClickShield.showShield(EAClickShieldView.Shield.LOADING);
    const currentStyleId = player.playStyle;
    const styleIds = _.range(250, 269);
    
    services.PlayerMetaData.updateItemPlayerMeta([player]).observe(cntlr.current(), function (t, _e) {
        t.unobserve(cntlr.current());
        const acceleToGroup = {};
        styleIds.forEach(styleId => {
            acceleToGroup[styleId] = events.getAcceleRate(player, 3, styleId);
        });
        const acceleResults = _.groupBy(styleIds, styleId => acceleToGroup[styleId]);
        const currentResult = acceleToGroup[currentStyleId];
        _.forEach(
            document.querySelectorAll(`.fsu-cards-accele[data-defid="${player.definitionId}"]`),
            el => {
                if (el.textContent.includes('*')) {
                    el.textContent = currentResult
                }
            }
        );
        const currentStyleText = sl.localize(`playstyles.playstyle${currentStyleId}`);
        const currentResultText = fy(`accelerate.type.${currentResult}`);
        const acceleResultsHtml = [];
        _.forEach(acceleResults, (value, key) => {
            let resultsHtml = `<div style="display: flex; align-items: center; justify-content: flex-start; gap: 0px 10px; flex-flow: row wrap;"><div class="color: white;">${fy(`accelerate.type.${key}`)} : </div>`
            _.forEach(value,i => {
                resultsHtml += `<div class="item" style="display: flex; align-items: center;"><div class="playStyle chemstyle${i}" style="font-size: 18px; margin-right: 6px;"></div><div>${services.Localization.localize(`playstyles.playstyle${i}`)}</div></div>`;
            })
            resultsHtml += `</div>`;
            acceleResultsHtml.push(resultsHtml);
        });
        const accelePopupText = `${fy(["accelerate.popupm",currentStyleText,currentResultText])}${acceleResultsHtml.join("<br>")}<br><br><span style="color:#a4a9b4">${fy("accelerate.popupm2")}</span>`;

        events.popup(
            fy("accelerate.popupt"),
            accelePopupText,
            (_t) => {
            }
        )
        gClickShield.hideShield(EAClickShieldView.Shield.LOADING);
    })
}
events.getBoostedAttribute = function (player, styleId, chem, attrId) {
    const sid = String(styleId);
    const aid = String(attrId);
    const chemKey = info.chemstyle?.[sid]?.[aid];
    const bonus = chemKey ? (info.chemMap?.[String(chem)]?.[chemKey] || 0) : 0;
    return Math.min(99, player.getSubAttribute(attrId).rating + bonus);
};
}

export function installUiUtilsPatches() {
const UTItemEntityGetPlusPlayStyles = UTItemEntity.prototype.getPlusPlayStyles;
UTItemEntity.prototype.getPlusPlayStyles = function () {
    const result = UTItemEntityGetPlusPlayStyles.call(this);
    return _.uniqWith(result, (a, b) => a.equals(b));
};
}