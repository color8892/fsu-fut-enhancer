export function installAcademyDetailsPatches(deps) {
  const { info, events, repositories, services, cntlr, isPhone } = deps;

  const UTAcademySlotItemDetailsViewController_renderPopulatedSlot =
    UTAcademySlotItemDetailsViewController.prototype.renderPopulatedSlot;

  UTAcademySlotItemDetailsViewController.prototype.renderPopulatedSlot = function (e) {
    UTAcademySlotItemDetailsViewController_renderPopulatedSlot.call(this, e);

    const playerId = e.player.id || e.realPlayerId;
    if (playerId <= 0) {
      return;
    }
    const index = this.viewmodel.getSelectedLevelIndex();
    const award = _.orderBy(
      index == 0 ? e.getAllSlotRewards() : e.levels[index - 1].awards,
      "type"
    );
    const player =
      index == 0 ? _.last(e.levels).boostedPlayer : e.levels[index - 1].boostedPlayer;
    const boost =
      index == 0 || index == 1
        ? repositories.Item.club.getItem(ItemType.PLAYER, false, playerId)
        : e.levels[index - 2].boostedPlayer;
    const controller = this;
    this._fsu ??= {};

    const renderUI = () => {
      _.forEach(award, (a) => {
        if (a.type >= AcademyStatEnum.PACE && a.type <= AcademyStatEnum.GK_SUB_POSITIONING_SUB) {
          const titleText = UTAcademyUtils.mapAttributeIdToLocString(a.type);
          const value = UTAcademyUtils.getPlayerFinalStatValue(player, a);
          const state = e.levels[a.level - 1].status;
          let addedText = "no";

          const sub = _.find(this.panel.upgradeList, (i) => {
            return i.__title?.innerText == titleText && !i.__deltaValue.hasAttribute("data-up");
          });
          if (sub) {
            let subText;
            if (state === AcademySlotLevelState.COMPLETED) {
              subText = "√";
            } else {
              const boostValue = UTAcademyUtils.getPlayerFinalStatValue(boost, a);
              const plusValue = value - boostValue;
              if (plusValue > 0) {
                subText = `${boostValue}+<span>${plusValue}</span>`;
              } else {
                subText = "+0";
              }
              plusValue > 0 && (addedText = "added") && a.type <= AcademyStatEnum.PHYSICALITY && (addedText += "Main");
            }
            let addValue = events.createElementWithConfig("div", {
              classList: "fsu-academyAttribute"
            });
            addValue.appendChild(
              events.createElementWithConfig("span", {
                innerHTML: `(${subText})`,
                classList: "fsu-academyAttributeIncrease"
              })
            );
            addValue.appendChild(
              events.createElementWithConfig("span", {
                textContent: value,
                classList: ["fsu-academyAttributeValue", addedText]
              })
            );

            sub.__deltaValue.appendChild(addValue);
            this._fsu["add_" + a.type] = addValue;
            sub.__deltaValue.setAttribute("data-up", 1);
          }
        }
      });
    };

    if (!repositories.PlayerMeta.get(boost.definitionId)) {
      services.PlayerMetaData.updateItemPlayerMeta([boost]).observe(controller, function (t, _e) {
        t.unobserve(controller);
        boost.setMetaData(repositories.PlayerMeta.get(boost.definitionId));
        renderUI();

        if (!isPhone()) {
          const rightFsu = cntlr.right()?.getView()?._list?._fsu;
          if (rightFsu) {
            const attrBox = rightFsu[`attrBox_${boost.id}`];
            if (attrBox) {
              const academyAttr = _.find(info.academy, { id: controller.viewmodel.selectedSlotId });
              const attrMap = events.academyAttrToList(
                events.academyAddAttr(academyAttr.attr, academyAttr.isGK, boost).map
              );
              attrBox.innerHTML = "";
              attrBox.appendChild(events.academyAddAttrOutput(attrMap));
              if (attrMap.size === 0) {
                attrBox.querySelector(".academyBoostsBox").style.opacity = "0.5";
              }
            }
          }
        }
      });
    } else {
      renderUI();
    }
  };

  const UTItemAcademyStatEntity_getSubAttributeOverride =
    UTItemAcademyStatEntity.prototype.getSubAttributeOverride;
  UTItemAcademyStatEntity.prototype.getSubAttributeOverride = function (e) {
    const matches = _.filter(this.subattributes, { type: e });
    if (matches.length === 1) {
      return UTItemAcademyStatEntity_getSubAttributeOverride.call(this, e);
    } else if (matches.length > 1) {
      const maxItem = _.maxBy(matches, "rating");
      return maxItem;
    }
  };

  const UTItemAcademyStatEntity_getAttributeOverride =
    UTItemAcademyStatEntity.prototype.getAttributeOverride;
  UTItemAcademyStatEntity.prototype.getAttributeOverride = function (e) {
    const matches = _.filter(this.attributes, { type: e });
    if (matches.length === 1) {
      return UTItemAcademyStatEntity_getAttributeOverride.call(this, e);
    } else if (matches.length > 1) {
      const maxItem = _.maxBy(matches, "rating");
      return maxItem;
    }
  };
}