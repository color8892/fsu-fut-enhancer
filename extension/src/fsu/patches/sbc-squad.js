export function registerSbcSubPriceEvent(deps) {
  const { events, info, fy, isPhone, repositories } = deps;

  events.sbcSubPrice = async (id, e) => {
    e._fsu ??= {};
    const sbcStat = info.task.sbc.stat[id];
    if (sbcStat) {
      if (!_.has(sbcStat, "child")) {
        let subPrice;
        try {
          subPrice = await events.getFutbinUrl(
            `https://www.futbin.org/futbin/api/${info.base.year}/getChallengesBySetId?set_id=${id}`
          );
        } catch (error) {
          return;
        }
        if ("data" in subPrice) {
          sbcStat.child = {};
          for (let i of subPrice.data) {
            let j = { tv: i.price.ps, pc: i.price.pc };
            sbcStat.child[i.challengeId] = j;
          }
        }
      }

      if (_.has(sbcStat, "child")) {
        for (let i of e._challengeRows) {
          if (i?._fsu?.subSet) {
            const sId = i._fsu.subSet.id;
            const child = sbcStat.child[sId];
            let box = events.createElementWithConfig("div", {
              style: {
                display: "flex",
                flexDirection: "row",
                gap: "8px"
              }
            });
            child.price ??= Number(info.base.platform == "pc" ? child.pc : child.tv);
            box.appendChild(
              events.createElementWithConfig("span", {
                textContent: `${fy("sbc.price")}${child.price.toLocaleString()}`,
                classList: ["currency-coins"]
              })
            );

            if (!_.has(child, "award")) {
              child.award = 0;
              _.forOwn(i._fsu.subSet.awards, (item) => {
                if (
                  item.isPack ||
                  (item.isItem && item.item && item.item.isPlayerPickItem())
                ) {
                  let packCoinValue = events.getOddo(item.value);
                  if (packCoinValue) {
                    child.award += packCoinValue * item.count;
                  }
                }
              });
            }
            box.appendChild(
              events.createElementWithConfig("span", {
                textContent: `${fy("subsbcaward.title")}${child.award ? child.award.toLocaleString() : fy("subsbcaward.nope")}`,
                classList: [`${child.award ? "currency-coins" : "no"}`]
              })
            );

            if (isPhone()) {
              box.style.flexDirection = "column";
              box.style.fontSize = "14px";
            }
            i._fsu.priceBox = box;
            i.__rowTitle.insertAdjacentElement("afterend", box);

            const fast = info.base.fastsbc[`${sId}#${i._fsu.subSet.setId}`];
            if (fast) {
              const fastCount = events.fastSBCQuantity(
                true,
                _.filter(
                  repositories.Item.getUnassignedItems(),
                  (item) => item.isPlayer() && item.duplicateId !== 0
                ),
                fast
              );
              i._fsu.fastBtn = events.createButton(
                new UTCurrencyButtonControl(),
                fy(["fastsbc.sbcbtntext", fastCount]),
                () => {
                  if (info.base.fastsbctips) {
                    events.isSBCCache(i._fsu.subSet.setId, sId);
                  } else {
                    events.popup(fy("fastsbc.popupt"), fy("fastsbc.popupm"), (t) => {
                      if (t === 2) {
                        info.base.fastsbctips = true;
                        events.isSBCCache(i._fsu.subSet.setId, sId);
                      }
                    });
                  }
                },
                "call-to-action mini fsu-challengefastbtn"
              );
              i._fsu.fastBtn.__currencyLabel.innerHTML = events.getFastSbcSubText(fast);
              if (i._fsu.subSet.isCompleted()) {
                i._fsu.fastBtn.setInteractionState(0);
              }
              i._progressBar.getRootElement().after(i._fsu.fastBtn.getRootElement());
            }
          }
        }

        let targetElement = e._setInfo._watchBtn.getRootElement().nextElementSibling;
        if (targetElement) {
          if (!e._fsu.sumPrice) {
            sbcStat.childPrice ??= _.sumBy(_.values(sbcStat.child), "price");
            sbcStat.childAward ??= _.sumBy(_.values(sbcStat.child), "award");
            let sumBox = events.createElementWithConfig("div", {
              classList: ["fsu-sub-price"],
              style: {
                display: "flex",
                flexDirection: "row",
                lineHeight: "2em",
                width: "100%"
              }
            });
            sumBox.appendChild(
              events.createElementWithConfig("span", {
                textContent: `${fy("sbc.price")}${sbcStat.childPrice.toLocaleString()}`,
                classList: ["currency-coins"]
              })
            );
            sumBox.appendChild(
              events.createElementWithConfig("span", {
                textContent: `${fy("subsbcaward.title")}${sbcStat.childAward ? sbcStat.childAward.toLocaleString() : fy("subsbcaward.nope")}`,
                classList: [`${sbcStat.childAward ? "currency-coins" : "no"}`],
                style: {
                  marginLeft: ".5rem"
                }
              })
            );
            e._fsu.sumPrice = sumBox;
            targetElement.appendChild(sumBox);
          }
        }
      }
    }
  };
}

export function registerSbcHeaderEvents(deps) {
  const { events, info, services, cntlr, debug } = deps;

  events.changeHeaderSBCEntrance = () => {
    let completeId = _.filter(info.douagain.SBCList, (SBCId) =>
      services.SBC.repository.getSetById(SBCId).isComplete()
    );
    _.map(completeId, (SBCId) => {
      events.SBCListInsertToFront(SBCId, 2);
    });
  };
}

export function installSbcSquadSubmitPatches(deps) {
  const { call, events, info, repositories, services, cntlr, debug, fy } = deps;

  registerSbcHeaderEvents({ events, info, services, cntlr, debug });

  UTSBCSquadOverviewViewController.prototype._submitChallenge = function _submitChallenge(e) {
    function valuablePlayerTips(left, controller, ev) {
      const preciousCount = left
        .getView()
        .slotViews.slice(0, 11)
        .reduce((acc, view) => {
          return acc + (view?.getItemView()?._fsu?.priceItem.classList.contains("precious") ? 1 : 0);
        }, 0);

      if (preciousCount > 0) {
        events.popup(
          fy("valuableplayer.popupt"),
          fy(["valuableplayer.popupm", preciousCount]),
          (t) => {
            if (t == 44408) {
              call.squad.submit.call(controller, ev);
            }
          },
          [{ labelEnum: 44408 }, { labelEnum: 44409 }]
        );
      } else {
        call.squad.submit.call(controller, ev);
      }
    }

    let controller = this;
    let pIds = _(this._squad.getFieldPlayers())
      .filter((p) => p._item.untradeableCount === 0 && p._item.definitionId !== 0)
      .map((p) => p._item.definitionId)
      .value();
    let filteredItems = _.filter(
      repositories.Item.getUnassignedItems(),
      (item) => item.isPlayer() && item.untradeableCount && _.includes(pIds, item.definitionId)
    );
    if (filteredItems.length) {
      services.Item.move(filteredItems, ItemPile.CLUB).observe(controller, async (obs, t) => {
        if (obs.unobserve(controller), t.success) {
          let oldIds = _.map(t.data.clubDuplicates, "id");
          let newPlayers = _.map(controller._squad.getPlayers(), (p) => {
            let oldIdIndex = _.indexOf(oldIds, p._item.id);
            if (oldIdIndex === -1) {
              return p._item;
            } else {
              let tItemId = t.data.itemIds[oldIdIndex];
              let eventResult = events.getItemBy(2, { id: tItemId });
              if (eventResult.length) {
                return eventResult[0];
              } else {
                return p._item;
              }
            }
          });
          events.showLoader();
          events.notice("notice.submitrepeat", 1);
          await events.saveSquad(controller._challenge, controller._challenge.squad, newPlayers, []);
          valuablePlayerTips(this, controller, e);
        } else {
          services.Notification.queue([
            services.Localization.localize("notification.item.moveFailed"),
            UINotificationType.NEGATIVE
          ]);
        }
      });
    } else {
      valuablePlayerTips(this, controller, e);
    }
  };

  UTSBCSquadOverviewViewController.prototype._onChallengeSubmitted = function _onChallengeSubmitted(
    e,
    t
  ) {
    call.squad.submitted.call(this, e, t);
    if (t.success && t.data.setId) {
      let s = services.SBC.repository.getSetById(t.data.setId);
      if (s && Object.keys(s).length) {
        info.douagain.sbc = t.data.setId;
      }

      if (services.SBC.repository.isCacheExpired()) {
        services.SBC.requestSets().observe(cntlr.current(), (obs, res) => {
          if ((obs.unobserve(cntlr.current()), res.success)) {
            if (cntlr.current().className == "UTSBCHubViewController") {
              cntlr.current()._requestSBCData();
            }
            events.changeHeaderSBCEntrance();
          }
        });
      } else {
        events.changeHeaderSBCEntrance();
      }
    }
  };
}

export function installSbcRequirementsPatch(deps) {
  const { events, info, fy, repositories } = deps;

  const UTSBCRequirementsView_render = UTSBCRequirementsView.prototype.render;
  UTSBCRequirementsView.prototype.render = function (e, t, i, o) {
    UTSBCRequirementsView_render.call(this, e, t, i, o);
    const sName = `${e.id}#${e.setId}`;
    this._fsu ??= {};
    if (_.has(info.base.fastsbc, sName)) {
      const fastInfo = info.base.fastsbc[sName];
      const fastCount = events.fastSBCQuantity(
        true,
        _.filter(
          repositories.Item.getUnassignedItems(),
          (item) => item.isPlayer() && item.duplicateId !== 0
        ),
        fastInfo
      );
      let fastSbcBtn = this._fsu.fastSbcBtn;
      if (!fastSbcBtn) {
        fastSbcBtn = events.createButton(
          new UTCurrencyButtonControl(),
          fy(["fastsbc.sbcbtntext", fastCount]),
          (z) => {
            if (info.base.fastsbctips) {
              events.isSBCCache(z.setId, z.id);
            } else {
              events.popup(fy("fastsbc.popupt"), fy("fastsbc.popupm"), (t) => {
                if (t === 2) {
                  info.base.fastsbctips = true;
                  events.isSBCCache(z.setId, z.id);
                }
              });
            }
          },
          "call-to-action mini fsu-challengefastbtn",
          {
            marginTop: "1rem"
          }
        );
        this._fsu.fastSbcBtn = fastSbcBtn;
      }
      fastSbcBtn.show();
      fastSbcBtn.setId = e.setId;
      fastSbcBtn.id = e.id;
      fastSbcBtn.setTitle = fy(["fastsbc.sbcbtntext", fastCount]);
      fastSbcBtn.__currencyLabel.innerHTML = events.getFastSbcSubText(fastInfo);
      if (e.isCompleted() || fastCount === 0) {
        fastSbcBtn.setInteractionState(0);
      }
      this._btnConfirm.getRootElement().after(fastSbcBtn.getRootElement());
    } else {
      this._fsu?.fastSbcBtn?.hide();
    }
  };
}