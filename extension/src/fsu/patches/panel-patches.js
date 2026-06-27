export function installPanelPatches(deps) {
  const { call, events, info, fy, cntlr, isPhone } = deps;
  UTQuickListPanelViewController.prototype.renderView = function () {
    call.panel.quickRender.call(this);
    events.detailsButtonSet(this)
};

UTRewardSelectionChoiceView.prototype.expandRewardSet = function(e,t) {
    call.panel.reward.call(this,e,t);
    let reward = t.rewards.find(i => i.count),tn = this._rewardsCarousel._tnsCarousel.__root;
    if(reward.isItem && reward.item.isPlayer() && info.set.player_futbin && tn.classList.length === 2 && tn.classList.contains("slider") && tn.classList.contains("rewards-slider-container")){
        let player = reward.item;
        this._fsuPlayer = events.createButton(
            new UTStandardButtonControl(),
            fy("quicklist.gotofutbin"),
            (e) => {events.openFutbinPlayerUrl(e, player);},
            "call-to-action mini fsu-reward-but"
        )
        if(!isPhone()){
            this._fsuPlayer.__root.classList.add("pcr")
        }
        tn.querySelector(".reward").appendChild(this._fsuPlayer.__root);
    }
}
events.conceptBuyBack = (w) =>{
    let a = w.panelView || w.panel;
    a._sendClubButton._tapDetected(this);
    if(isPhone()){
        let p = w._parentViewController,cv,cn;
        for (let [n,v] of p._childViewControllers.entries()) {
            if(v.className == "UTSBCSquadOverviewViewController"){
                cv = v;
                cn = n;
            }
        }
        p.popToViewController(cv,cn)
    }else{
        cntlr.current()._ePitchTapped()
    }
}
}
