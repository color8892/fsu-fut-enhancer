export function installPicksRewardsPatches(deps) {
  const { call, events, info, fy, isPhone, debug } = deps;
  //25.09 新挑选包界面
UTPlayerPicksView.prototype.setCarouselItems = function(e) {
    call.other.picks.setItems.call(this,e)
    events.loadPlayerInfo(e,this);

    _.forEach(this._carouselItemsContainer.__carouselItemsContainer.children, (child) => {
        child.style.margin = '1.8rem 1.2rem';
    });


    let futbinBtn = events.createButton(
        new UTStandardButtonControl(),
        fy("quicklist.gotofutbin"),
        (e) => {
            let index = Number(e._view.__carouselIndicatorDots.querySelector(".active").getAttribute("data-index"))
            let player = e._player[index];
            events.openFutbinPlayerUrl(e, player);
        },
        "mini select-btn call-to-action"
    );
    futbinBtn._view = this;
    futbinBtn._player = e;

    let btnBox = events.createElementWithConfig("div",{
        style: {
            display:"flex"
        }
    })
    btnBox.appendChild(this._selectBtn.getRootElement())
    btnBox.appendChild(futbinBtn.getRootElement())
    this.__chooseContainer.appendChild(btnBox)

    //25.12 手机端缩小以适配
    if(isPhone()){
        this._carouselItemsContainer.getRootElement().style.margin = "-1.5rem 0";
    }else{
        this.getRootElement().style.height  = "auto";
    }

    if(info.set.player_pickbest && e.length){
        events.playerSelectionSort(this,e)
    }


    /** 25.18 firefox浏览器无法挑选最后一个临时解决办法 */
    if(navigator.userAgent.toLowerCase().includes('firefox')){
        let lastDiv = events.createElementWithConfig("div",{
            classList:["ut-companion-carousel-item-view"],
            style:{
                width:"200px",
                pointerEvents:"none"
            }
        })
        this._carouselItemsContainer.__carouselItemsContainer.appendChild(lastDiv);
    }
}

//25.09 获奖弹窗展示开包概率
FCGameRewardsViewController.prototype.checkRewards = function(e) {
    call.other.rewards.check.FC.call(this,e);
    debug.log(this,e)
}
UTGameRewardsViewController.prototype.checkRewards = function(e) {
    call.other.rewards.check.UT.call(this,e);
    _.map(e,(t,i) => {
        if(t.isPack){
            events.setRewardOddo(this.getView()._rewardsCarousel.getRootElement().querySelectorAll(".reward")[i],t);
        }
    })
}
}
