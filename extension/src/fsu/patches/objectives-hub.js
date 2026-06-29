export function installObjectivesHubPatches(deps) {
  const { call, events, info, fy, isPhone } = deps;

  UTObjectivesHubView.prototype.setupNavigation = function (e) {
    call.task.objN.call(this, e);
    const stat = info.task?.obj?.stat;
    if (!stat || !Object.keys(stat).length || !info.set.info_obj) {
      return;
    }

    const items = this._objectivesTM?.items;
    if (!items) {
      return;
    }

    stat.catNew ??= {};
    stat.catExpiry ??= {};
    stat.catReward = 0;
    _.forEach(items, (i) => {
      if (_.has(i, "notifBubble")) {
        stat.catReward += _.toInteger(i.notifBubble.getRootElement().textContent);
      }

      if (_.has(stat.catNew, i.id) && stat.catNew[i.id] !== 0) {
        events.navigationAddCount(i, stat.catNew[i.id]);
      }
      if (_.has(stat.catExpiry, i.id) && stat.catExpiry[i.id] !== 0) {
        events.navigationAddCount(i, -stat.catExpiry[i.id]);
      }
    });
  };

  FCObjectiveSeasonView.prototype.setCampaign = function (n) {
    call.task.seasonSet.call(this, n);
    let playersList = [];
    _.forEach(this.levels, (i) => {
      const rewards = _.flatMap(i.levelRewards, "rewards");
      const views = i.fcRewardViews;
      if (rewards.length == views.length) {
        _.forEach(rewards, (reward, index) => {
          if (reward.isPack || (reward.isUtItem && reward.utItem.isPlayerPickItem())) {
            events.setRewardOddo(views[index].getRootElement(), reward);
          } else if (reward.isPlayer) {
            playersList.push(reward.utItem);
          }
        });
      }
    });
    events.loadPlayerInfo(playersList);
  };

  UTObjectiveCategoryView.prototype.setCategoryGroups = function (i, e, o, n) {
    call.task.objG.call(this, i, e, o, n);
    const groups = this.groups;
    if (!groups) {
      return;
    }
    for (const i of groups) {
      if (!info.task?.obj?.stat || !Object.keys(info.task.obj.stat).length) {
        return;
      }
      if (_.includes(info.task.obj.stat.new, i.id)) {
        i.getRootElement().insertBefore(
          events.createDF(`<div class="fsu-newtips">${fy("task.new")}</div>`),
          i.getRootElement().firstChild
        );
      }
      if (_.includes(info.task.obj.stat.expiry, i.id)) {
        i.__title.parentNode.after(events.createDF(`<div class="task-expire">${fy("task.expire")}</div>`));
      }
      let item = e.find((z) => z.compositeId == i.id);
      if (item && item.rewards.rewards.length && item.rewards.rewards.length == 1) {
        let reward = item.rewards.rewards[0];
        if (reward.isPack || (reward.isItem && reward.item && reward.item.isPlayerPickItem())) {
          let packCoinValue = events.getOddo(reward.value);
          if (packCoinValue) {
            let packBox = events.createElementWithConfig("div", {
              style: {
                position: "absolute",
                bottom: "0",
                backgroundColor: "rgb(0 0 0 / 60%)",
                width: "100%",
                textAlign: "center",
                padding: ".2rem 0",
                fontSize: "0.8rem"
              }
            });
            let packTitle = events.createElementWithConfig("div", {
              textContent: _.replace(_.replace(fy("returns.text"), ":", ""), "：", "")
            });
            packBox.appendChild(packTitle);
            let packCoin = events.createElementWithConfig("div", {
              classList: ["currency-coins"],
              textContent: (packCoinValue * reward.count).toLocaleString()
            });
            packBox.appendChild(packCoin);
            i._rewardView.__asset.style.position = "relative";
            i._rewardView.__asset.appendChild(packBox);
          }
        }
      }
    }
  };

  UTObjectivesHubTileView.prototype.setSubtitle = function (e) {
    call.task.objSetTitle.call(this, e);
    let objCountElement = this.getRootElement().querySelector(".fsu-obj-count");
    if (!objCountElement) {
      let rCountStyle;
      if (isPhone()) {
        rCountStyle = [".5rem", ".6rem", "1.2rem", "1.2rem", "1rem", "1.2rem"];
      } else {
        rCountStyle = [".7rem", ".7rem", "1.4rem", "1.4rem", "1.2rem", "1.4rem"];
      }
      let rCount = events.createElementWithConfig("div", {
        textContent: info.task.obj.stat.catReward,
        classList: ["ut-tab-bar-item-notif", "fsu-obj-count"],
        style: {
          position: "absolute",
          right: rCountStyle[0],
          top: rCountStyle[1],
          width: rCountStyle[2],
          height: rCountStyle[3],
          fontSize: rCountStyle[4],
          lineHeight: rCountStyle[5]
        }
      });
      if (!info.task.obj.stat.catReward) {
        rCount.style.display = "none";
      }
      this.getRootElement().prepend(rCount);
    } else {
      if (info.task.obj.stat.catReward) {
        objCountElement.style.display = "block";
        objCountElement.textContent = info.task.obj.stat.catReward;
      } else {
        objCountElement.style.display = "none";
      }
    }
  };
}