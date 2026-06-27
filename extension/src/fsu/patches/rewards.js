export function registerRewardEvents(deps) {
  const { events, fy } = deps;

  events.setRewardOddo = (target, reward, type) => {
    let results = 0;
    if (
      reward.isPack ||
      (reward.isUtItem && reward.utItem && reward.utItem.isPlayerPickItem())
    ) {
      let oddo = events.getOddo(reward.value);
      if (oddo) {
        results = oddo * reward.count;
        if (target) {
          let targetItem = target.querySelector(".ut-pack-graphic-view"),
            targetType = 1;
          if (targetItem == null) {
            targetItem = target.querySelector(".player-pick");
            targetType = 2;
          }
          if (targetItem == null) {
            targetItem = target.querySelector(".reward-info .type");
            targetType = 3;
          }
          if (targetItem) {
            let oddoBox;
            if (targetType == 3) {
              targetItem.appendChild(document.createElement("br"));
              oddoBox = events.createElementWithConfig("span", {
                classList: ["currency-coins"],
                textContent: fy("returns.text") + results.toLocaleString()
              });
            } else {
              oddoBox = events.createElementWithConfig("div", {
                style: {
                  position: "absolute",
                  bottom: "0",
                  backgroundColor: "rgb(0 0 0 / 60%)",
                  width: "100%",
                  textAlign: "center",
                  padding: ".2rem 0",
                  color: "#ffffff",
                  fontSize: ".8rem"
                }
              });
              let oddoTitle = events.createElementWithConfig("div", {
                textContent: _.replace(_.replace(fy("returns.text"), ":", ""), "：", "")
              });
              oddoBox.appendChild(oddoTitle);
              let oddoCoin = events.createElementWithConfig("div", {
                classList: ["currency-coins"],
                textContent: results.toLocaleString()
              });
              oddoBox.appendChild(oddoCoin);
              if (targetType == 2) {
                oddoBox.style.paddingBottom = ".5rem";
              }
              if (type == 2) {
                oddoBox.style.fontSize = "1rem";
              }
            }
            targetItem.appendChild(oddoBox);
          }
        }
      }
    } else if (reward.isCoin) {
      results = reward.value;
    }
    return results;
  };
}

export function installRewardPatches(deps) {
  const { call, events, info, fy, cntlr, repositories, debug } = deps;

  registerRewardEvents({ events, fy });

  FCObjectiveDetailsView.prototype.render = function (e) {
    call.other.rewards.objectiveDetail.call(this, e);
    let sum = 0;
    if (e.rewards.rewards[0].isPack) {
      sum = events.setRewardOddo(
        this._rewardsCarousel.getRootElement().querySelector(".reward"),
        e.rewards.rewards[0]
      );
    }
    _.map(this.taskViews, (sView, sIndex) => {
      let sAttr = _.nth(e.objectives.values(), sIndex);
      if (sAttr.rewards.rewards.length == 1 && sAttr.rewards.rewards[0].isPack) {
        sum += events.setRewardOddo(
          sView._rewardsCarousel.getRootElement().querySelector(".reward"),
          sAttr.rewards.rewards[0],
          2
        );
      }
    });
    if (sum) {
      let sumBox = events.createElementWithConfig("span", {
        textContent: "(",
        style: {
          marginLeft: ".5rem",
          fontSize: "1.2rem",
          color: "#666"
        }
      });
      let sumText = events.createElementWithConfig("span", {
        textContent: sum.toLocaleString(),
        classList: ["currency-coins"]
      });
      sumBox.appendChild(sumText);
      sumBox.appendChild(document.createTextNode(")"));
      this.__title.appendChild(sumBox);
    }
  };

  UTRewardSelectionChoiceViewController.prototype.viewDidAppear = function () {
    call.other.rewards.choice.call(this);
    let target = this.getView().__rewardTiles.querySelectorAll(".ut-reward-selection");
    _.map(this.rewardSets, (s, i) => {
      let sum = 0;
      _.map(s.rewards, (r, z) => {
        sum += events.setRewardOddo(z == 0 ? target[i] : false, r, 2);
      });

      if (s.rewards.length > 1) {
        let sumBox = events.createElementWithConfig("span", {
          textContent: "(",
          style: {
            marginLeft: ".5rem",
            fontSize: "1.2rem",
            color: "#666"
          }
        });
        let sumText = events.createElementWithConfig("span", {
          textContent: sum.toLocaleString(),
          classList: ["currency-coins"]
        });
        sumBox.appendChild(sumText);
        sumBox.appendChild(document.createTextNode(")"));
        target[i].querySelector(".selection-title-landscape").appendChild(sumBox);
      }
    });
  };

  UTRewardSelectionChoiceView.prototype.expandRewardSet = function (e, t) {
    call.other.rewards.choiceSet.call(this, e, t);
    let target = this.__expandedReward.querySelectorAll(".reward");
    let sum = 0;
    _.map(t.rewards, (r, i) => {
      sum += events.setRewardOddo(target[i], r, 2);
    });
    if (t.rewards.length > 1) {
      let sumBox = events.createElementWithConfig("span", {
        textContent: "(",
        style: {
          marginLeft: ".5rem",
          fontSize: "1.2rem",
          color: "#666"
        }
      });
      let sumText = events.createElementWithConfig("span", {
        textContent: sum.toLocaleString(),
        classList: ["currency-coins"]
      });
      sumBox.appendChild(sumText);
      sumBox.appendChild(document.createTextNode(")"));
      this.__title.appendChild(sumBox);
    }
  };

  UTGameRewardsViewController.prototype.onButtonTapped = function (e, t, i) {
    call.other.rewards.popupTapped.call(this, e, t, i);
    if (this.hasPackReward && cntlr.current().className == "UTStorePackViewController") {
      cntlr.current().getStorePacks();
      if (repositories.Store.myPacks.length == 0) {
        events.waitForClickShieldToHide(() => {
          debug.log("加载完成，继续执行");
          if (repositories.Store.myPacks.length) {
            cntlr
              .current()
              .getView()
              ._navigation.onItemTapped(cntlr.current().getView()._navigation.items[0]);
          }
        });
      }
    }
    if (cntlr.current().className == "UTObjectivesHubViewController") {
      let rewardCount = 0;
      let barElement = cntlr
        .current()
        .getView()
        ._objectivesTM.getRootElement()
        .querySelectorAll(".ut-tab-bar-item-notif");
      _.map(barElement, (el) => {
        debug.log(_.toInteger(el.textContent));
        rewardCount += _.toInteger(el.textContent);
      });
      info.task.obj.stat.catReward = rewardCount;
    }
  };
}