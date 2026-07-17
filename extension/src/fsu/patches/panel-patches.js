export const PLAYER_DETAILS_PATCH_IDS = Object.freeze({
  QUICK_LIST_RENDER: "details.quick-list-render"
});

export function installPlayerDetailsEntryPatch(deps) {
  const { call, events, patchLifecycle } = deps;
  return patchLifecycle.install({
    id: PLAYER_DETAILS_PATCH_IDS.QUICK_LIST_RENDER,
    phase: "sbc-core",
    targetLabel: "UTQuickListPanelViewController.prototype.renderView",
    resolveTarget: () =>
      typeof UTQuickListPanelViewController === "undefined"
        ? null
        : {
            owner: UTQuickListPanelViewController.prototype,
            key: "renderView"
          },
    verify: ({ originalDescriptor, originalValue }) => ({
      ok:
        originalDescriptor !== undefined &&
        "value" in originalDescriptor &&
        originalDescriptor.writable === true &&
        typeof originalValue === "function" &&
        originalValue === call.panel.quickRender,
      missing: [
        "UTQuickListPanelViewController.prototype.renderView.original-mismatch"
      ]
    }),
    apply: ({ target, originalDescriptor, originalValue }) => {
      Object.defineProperty(target.owner, target.key, {
        ...originalDescriptor,
        value: function fsuPlayerDetailsEntry(...args) {
          const result = originalValue.call(this, ...args);
          events.detailsButtonSet(this);
          return result;
        }
      });
    }
  });
}

export function registerPlayerDetailsLifecycleEvents(deps) {
  const { call, events, patchLifecycle } = deps;
  events.setPlayerDetailsPatchEnabled = (enabled) =>
    enabled
      ? installPlayerDetailsEntryPatch({ call, events, patchLifecycle })
      : patchLifecycle.restore(PLAYER_DETAILS_PATCH_IDS.QUICK_LIST_RENDER);
}

export function installPanelPatches(deps) {
  const { call, events, info, fy, cntlr, isPhone, patchLifecycle } = deps;
  registerPlayerDetailsLifecycleEvents({ call, events, patchLifecycle });
  events.setPlayerDetailsPatchEnabled(true);

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
