function navigationAddCount(events, e, c) {
  if (e.className == "EAFilterBarItemView") {
    e.getRootElement().appendChild(
      events.createElementWithConfig("div", {
        textContent: c,
        classList: ["fsu-tab-count", Number(c) < 0 ? "expire" : "new"]
      })
    );
  }
}

function resolveSbcSetTiles(dropdown, cntlr) {
  const hubTiles = dropdown?._parent?.sbcSetTiles;
  if (hubTiles) {
    return hubTiles;
  }
  return cntlr.current()?.getView?.()?.sbcSetTiles;
}

function sbcFilter(deps, e) {
  const { info, cntlr } = deps;
  const tiles = resolveSbcSetTiles(e, cntlr);
  if (!tiles) {
    return;
  }

  const g = e.getIndex();
  _.forEach(tiles, (i) => {
    let y = true;
    const d = i.data.id;
    if (info.task.sbc.stat.hasOwnProperty(d)) {
      const s = info.task.sbc.stat[d];
      if (g == 1 && !_.includes(info.task.sbc.stat.new, d)) y = false;
      if (g == 2 && !_.includes(info.task.sbc.stat.expiry, d)) y = false;
      if (g == 3) {
        const n = parseFloat(s.u);
        if (!isNaN(n)) {
          if (n < 65) y = false;
        } else {
          y = false;
        }
      }
    } else {
      y = g == 0;
    }
    y ? i.show() : i.hide();
  });
}

export function installSbcHubPatches(deps) {
  const { info, events, services, fy, cntlr } = deps;

  const originalPopulateNavigation = UTSBCHubView.prototype.populateNavigation;
  const originalPopulateTiles = UTSBCHubView.prototype.populateTiles;
  const originalSetData = UTSBCSetTileView.prototype.setData;
  const originalRender = UTSBCChallengeTableRowView.prototype.render;
  const originalSetRewards = UTSBCGroupRewardListView.prototype.setRewards;
  const originalGetCategories = UTSBCSetsViewModel.prototype.getCategories;

  events.navigationAddCount = (e, c) => navigationAddCount(events, e, c);
  events.sbcFilter = (e) => sbcFilter({ info, cntlr }, e);

  UTSBCGroupRewardListView.prototype.setRewards = function (e, o) {
    originalSetRewards.call(this, e, o);
    _.map(e, (item, index) => {
      if (item.isPack || (item.isItem && item.item && item.item.isPlayerPickItem())) {
        const packCoinValue = events.getOddo(item.value);
        if (packCoinValue) {
          const packBox = events.createElementWithConfig("div", {
            textContent: `${fy("returns.text")}${(packCoinValue * item.count).toLocaleString()}`,
            classList: ["currency-coins"]
          });
          this.__rewardList
            .querySelector(`li:nth-child(${index + 1})`)
            ?.querySelector(".rowContent")
            ?.appendChild(packBox);
        }
      }
    });
  };

  UTSBCChallengeTableRowView.prototype.render = function (e) {
    originalRender.call(this, e);
    this._fsu ??= {};
    this._fsu.subSet = e;
  };

  UTSBCSetTileView.prototype.setData = function (e) {
    originalSetData.call(this, e);
  };

  UTSBCSetsViewModel.prototype.getCategories = function () {
    let original = this.categoriesIterator.values();
    if (!_.some(original, { id: 996 }) && _.size(info.base.fastsbc)) {
      const sbcIds = _.chain(info.base.fastsbc)
        .keys()
        .map((k) => {
          const part = k.split("#").pop().trim();
          return _.toInteger(part);
        })
        .filter((n) => _.isInteger(n) && n !== 0)
        .uniq()
        .value();
      const fastNav = new UTSBCCategoryDTO(
        996,
        996,
        `${fy("fastsbc.tab.text")}(${sbcIds.length})`,
        SBCCategoryType.SERVER
      );
      fastNav.setIds = sbcIds;
      fastNav.displayable = true;
      this.categoriesIterator.add(fastNav, 2);
      original = this.categoriesIterator.values();
    }
    return original;
  };

  UTSBCHubView.prototype.populateNavigation = function (e, t) {
    originalPopulateNavigation.call(this, e, t);
    setTimeout(() => {
      if (info.set.info_sbc) {
        _.map(e, (i, k) => {
          const catNewIds = _.intersection(info.task.sbc.stat.new, i.setIds);
          const catExpiryIds = _.intersection(info.task.sbc.stat.expiry, i.setIds);
          if (catNewIds.length || catExpiryIds.length) {
            const realNewCount = _.filter(
              catNewIds,
              (id) => !services.SBC.repository.getSetById(id).isComplete()
            ).length;
            const realExpiryCount = _.filter(
              catExpiryIds,
              (id) => !services.SBC.repository.getSetById(id).isComplete()
            ).length;
            const tap = this._SBCCategoriesTM.items[k];
            if (realNewCount) {
              events.navigationAddCount(tap, realNewCount);
            }
            if (realExpiryCount) {
              events.navigationAddCount(tap, -realExpiryCount);
            }
          }
        });
      }
    }, 10);
  };

  UTSBCHubView.prototype.populateTiles = function (e, t) {
    const newList = _.orderBy(
      e,
      [
        (item) => item.isComplete(),
        (item) =>
          _.includes(info.task.sbc.stat.new, item.id) ||
          (!_.has(info.task.sbc.stat, item.id) && item.id !== 1),
        (item) => info?.task?.sbc?.stat?.[item.id]?.u ?? -Infinity
      ],
      ["asc", "desc", "desc"]
    );
    originalPopulateTiles.call(this, newList, t);

    if (info.set.info_sbc) {
      _.forEach(this.sbcSetTiles, (i) => {
        events.sbcInfoFill(i.data.id, i);
      });
      if (!t) {
        events.notice("notice.basesbc", 0);
      }
    }

    const playerArray = _.map(
      _.filter(this.sbcSetTiles, (set) => set.data.awards.length && set.data.awards[0].isItem),
      (set) => set.data.awards[0].item
    );
    if (playerArray.length) {
      events.loadPlayerInfo(playerArray);
    }

    if (Object.keys(info.task.sbc.stat).length && info.set.info_sbcf && t) {
      if (!this.hasOwnProperty("_fsuSbcFilter")) {
        this._fsuSbcFilter = new UTDropDownControl();
        const fa = [];
        for (let i = 0; i < 4; i++) {
          fa.push(new UTDataProviderEntryDTO(i, i, fy(`sbc.filter${i}`)));
        }
        this._fsuSbcFilter.init();
        this._fsuSbcFilter.setOptions(fa);
        this._fsuSbcFilter._parent = this;
        this._fsuSbcFilter.addTarget(
          this._fsuSbcFilter,
          (dropdown) => {
            events.sbcFilter(dropdown);
            dropdown._parent._fsuSbcFilterId = dropdown.getId();
          },
          EventType.CHANGE
        );
        const b = document.createElement("div");
        b.classList.add("fsu-sbcfilter-box");
        const o = document.createElement("div");
        o.classList.add("fsu-sbcfilter-option");
        const s = document.createElement("div");
        s.innerText = fy("sbc.filtert");
        o.appendChild(s);
        o.appendChild(this._fsuSbcFilter.__root);
        b.appendChild(o);
        this._SBCCategoriesTM.__root.after(b);
        this._fsuSbcFilterType = t.id;
        this._fsuSbcFilterId = 0;
      } else {
        if (t.id !== this._fsuSbcFilterType) {
          this._fsuSbcFilterType = t.id;
          this._fsuSbcFilterId = 0;
        }
        setTimeout(() => {
          this._fsuSbcFilter.setIndexById(this._fsuSbcFilterId);
          events.sbcFilter(this._fsuSbcFilter);
        }, 200);
      }
    }
  };
}

export function registerSbcInfoFillEvent(deps) {
  const { events, info, fy, html, repositories } = deps;

  events.sbcInfoFill = (d, e) => {
    if (!info.task.sbc.stat.hasOwnProperty(d)) return;
    let s = info.task.sbc.stat[d];
    if (_.has()) {
    }
    if (s !== undefined) {
      if (e.hasOwnProperty("__tileTitle") && _.includes(info.task.sbc.stat.new, d)) {
        e.getRootElement().style.position = "relative";
        e.getRootElement().prepend(events.createDF(`<div class='fsu-newtips'>${fy("task.new")}</div>`));
      }
      if (!e.__root.querySelector(".task-expire") && "data" in e && !e.data.isComplete()) {
        let expireTime = e.data.endTime - Math.round(new Date() / 1000);
        if (expireTime < 86400 && !e.data.notExpirable) {
          if (!_.has(info.task.sbc.stat, "expiry")) {
            info.task.sbc.stat.expiry = [];
          }
          if (!_.includes(info.task.sbc.stat.expiry, d)) {
            info.task.sbc.stat.expiry.push(d);
          }
          e.__root.prepend(events.createDF(`<div class='task-expire'>${fy("task.expire")}</div>`));
        }
      }
    }
    if ("data" in e && e.data.repeatabilityMode !== "NON_REPEATABLE") {
      let countBox = events.createElementWithConfig("div", {
        classList: ["ut-squad-building-set-status-label-view", "refresh", "sbccount"]
      });
      let count = e.data.timesCompleted;
      let countText = events.createElementWithConfig("span", {
        classList: ["text"],
        textContent: fy(["sbc.infocount", count])
      });
      if (count !== 0) {
        countBox.style.opacity = "1";
      }
      countBox.appendChild(countText);
      e.getRootElement().querySelector("div.challenge").appendChild(countBox);
    }
    if (!e.data.isComplete()) {
      let fastInfo = _.pickBy(info.base.fastsbc, (value, key) =>
        _.includes(key + "#", `#${e.data.id}#`)
      );
      if (_.size(fastInfo)) {
        if (e.data.challengesCount == 1) {
          let fastCount = events.fastSBCQuantity(
            true,
            _.filter(
              repositories.Item.getUnassignedItems(),
              (item) => item.isPlayer() && item.duplicateId !== 0
            ),
            _.values(fastInfo)[0]
          );
          let fastIds = _.map(_.split(_.keys(fastInfo)[0], "#"), (s) => parseInt(s));
          let fastSid = fastIds[1];
          let fastCid = fastIds[0];
          fastCount--;

          e._fsufastsbcbtn = events.createButton(
            new UTCurrencyButtonControl(),
            fy(["fastsbc.sbcbtntext", fastCount]),
            () => {
              if (info.base.fastsbctips) {
                events.isSBCCache(fastSid, fastCid);
              } else {
                events.popup(fy("fastsbc.popupt"), fy("fastsbc.popupm"), (t) => {
                  if (t === 2) {
                    info.base.fastsbctips = true;
                    events.isSBCCache(fastSid, fastCid);
                  }
                });
              }
            },
            "call-to-action mini fsu-challengefastbtn"
          );

          e._fsufastsbcbtn.__currencyLabel.innerHTML = events.getFastSbcSubText(
            info.base.fastsbc[`${fastCid}#${fastSid}`]
          );

          if (fastCount == 0) {
            e._fsufastsbcbtn.setInteractionState(0);
          }
        } else {
          e._fsufastsbcbtn = events.createButton(
            new UTCurrencyButtonControl(),
            fy(`fastsbc.entertips`),
            () => {
              e._tapDetected();
            },
            "call-to-action mini fsu-challengefastbtn"
          );
        }
        e._fsufastsbcbtn.getRootElement().style.width = "100%";

        e.getRootElement().querySelector(".challenge").appendChild(e._fsufastsbcbtn.getRootElement());
      }
    }
    if (e._interactionState && !e.__root.querySelector(".fsu-sbc-info")) {
      let p = s[info.base.platform];
      e.__root.lastChild.before(
        events.createDF(
          fy(html.sbcInfo)
            .replace("{price}", Number(p).toLocaleString())
            .replace("{up}", `${s.u}%`)
            .replace("{down}", `${s.d}%`)
        )
      );
    }
    if ("data" in e && e.data.awards && e.data.awards.length == 1) {
      if (e.data.awards[0].isPack) {
        let reward = e.data.awards[0];
        let packCoinValue = events.getOddo(reward.value);
        if (packCoinValue) {
          let packBox = events.createElementWithConfig("div", {
            style: {
              position: "absolute",
              bottom: "0",
              backgroundColor: "rgb(0 0 0 / 60%)",
              width: "100%",
              textAlign: "center",
              padding: ".2rem 0"
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

          e.__mainReward.querySelector(".ut-pack-graphic-view").appendChild(packBox);
        }
      }
      if (
        e._infoBtn.getRootElement().style.display != "none" &&
        e.data.awards[0]?.item?.isPlayerPickItem()
      ) {
        e._infoBtn.removeTarget(e, e._eCheckMoreInfo, EventType.TAP);
        e._infoBtn.addTarget(e, () => events.fixedPickPopup(e.data.awards[0].item), EventType.TAP);
      }
    }
  };
}