export function addRewardFutbinButton({ events, fy, isPhone }, view, rewardSet) {
  const reward = rewardSet.rewards.find((item) => item.count);
  const carousel = view._rewardsCarousel?._tnsCarousel?.__root;
  if (
    reward?.isItem &&
    reward.item.isPlayer() &&
    carousel?.classList.length === 2 &&
    carousel.classList.contains("slider") &&
    carousel.classList.contains("rewards-slider-container")
  ) {
    const player = reward.item;
    view._fsuPlayer = events.createButton(
      new UTStandardButtonControl(),
      fy("quicklist.gotofutbin"),
      (event) => {
        events.openFutbinPlayerUrl(event, player);
      },
      "call-to-action mini fsu-reward-but"
    );
    if (!isPhone()) view._fsuPlayer.__root.classList.add("pcr");
    carousel.querySelector(".reward")?.appendChild(view._fsuPlayer.__root);
  }
}

export function installPanelPatches(deps) {
  const { call, events, info, fy, cntlr, isPhone } = deps;
  UTQuickListPanelViewController.prototype.renderView = function () {
    call.panel.quickRender.call(this);
    events.detailsButtonSet(this)
};

UTRewardSelectionChoiceView.prototype.expandRewardSet = function(e,t) {
    call.panel.reward.call(this,e,t);
    if (info.set.player_futbin) addRewardFutbinButton({ events, fy, isPhone }, this, t);
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
