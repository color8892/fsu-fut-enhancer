export class FgRatingService {
  fgCalc(player, first = true, shouldStore = true, styleId, helpers) {
    const { getInfo, getAcceleRate, getBoostedAttribute, debug, eafy } = helpers;
    const info = getInfo();
    if (player && _.has(info, "fgconfig")) {
      const hasMeta = repositories.PlayerMeta.has(player.definitionId);
      const storeKey = `${player.id}${hasMeta ? "" : "*"}`;
      if (shouldStore && _.has(info.fgList, storeKey)) {
        return first ? _.first(info.fgList[storeKey]) : info.fgList[storeKey];
      }
      let newPlayer = player;
      if (!hasMeta) {
        if (_.has(info.playerMetaData, player.definitionId)) {
          if (!_.has(newPlayer.getMetaData(), "isLocal")) {
            newPlayer.setMetaData(newPlayer.getMetaData());
            debug.log('没应用缓存，重新设置', newPlayer, newPlayer.getStaticData()?.name)
          }
        } else {
          newPlayer = this.fgCreateVirtualPlayers(player, helpers);
        }
      }
      const posList = newPlayer.possiblePositions;
      const weakFoot = newPlayer.getWeakFoot();
      const playStyles = styleId ? [styleId] : (newPlayer.isGK() ? _.range(269, 274) : _.range(250, 269))
      const skillMoves = newPlayer.getSkillMoves();
      const foot = newPlayer.isLeftFoot() ? 2 : 1;
      const basicPlayStyles = _.map(newPlayer.getBasicPlayStyles(), "traitId");
      const plusPlayStyles = _.map(newPlayer.getPlusPlayStyles(), "traitId");
      const height = newPlayer.getMetaData()?.height;
      const weight = info.playermeta?.[player.databaseId]?.weight ?? 0;
      const bodyType = info.playermeta?.[player.databaseId]?.badytype ?? 0;
      const curveConfig = info.fgconfig.attribute[34];
      const composureConfig = info.fgconfig.attribute[29];
      const basicHasTBLZ = basicPlayStyles.includes(PlayerTrait.TRAILBLAZING);
      const plusHasTBLZ = plusPlayStyles.includes(PlayerTrait.TRAILBLAZING);
      const plusRoles = _.map(newPlayer.getPlusRoles(), i => { return `${i.position}_${i.type}` });
      const plusPlusRoles = _.map(newPlayer.getPlusPlusRoles(), i => { return `${i.position}_${i.type}` });
      const isLegend = 2118 === newPlayer.leagueId;
      const isGK = 0 === newPlayer.preferredPosition;
      const acceleIds = { "C": 30, "E": 39, "L": 61 }
      let fgList = [];
      for (const styleId of playStyles) {
        const accele = getAcceleRate(newPlayer, 3, styleId);
        const curve = getBoostedAttribute(newPlayer, styleId, 3, curveConfig.id);
        const composure = getBoostedAttribute(newPlayer, styleId, 3, composureConfig.id);
        for (const role of info.fgconfig.roles) {
          if (_.includes(posList, role.posId)) {
            const factors = role.factors;
            let score = 0;

            //子属性计算
            _.forEach(info.fgconfig.attribute, (attr, attrId) => {
              if (_.has(factors, attrId)) {
                let attribute = getBoostedAttribute(newPlayer, styleId, 3, attr.id)
                score += Math.max(0, (attribute - attr.reduce) * ((factors[attrId] ?? 0) / attr.factor));
              }
            })

            //花逆计算
            score += factors[info.fgconfig.weakFoot[weakFoot]] ?? 0;
            score += factors[info.fgconfig.skillMoves[skillMoves]] ?? 0;

            //逆向效果计算
            const footEffectId = info.fgconfig.foot[foot][weakFoot];
            if (_.has(factors, footEffectId)) {
              score += factors[footEffectId] ?? 0;
            }

            //特技效果计算
            _.forEach(basicPlayStyles, (psId) => {
              if (_.has(factors, info.fgconfig.playStyle[psId])) {
                score += factors[info.fgconfig.playStyle[psId]] ?? 0;
              }
            })
            _.forEach(plusPlayStyles, (psId) => {
              if (_.has(factors, info.fgconfig.plusPlayStyle[psId])) {
                score += factors[info.fgconfig.plusPlayStyle[psId]] ?? 0;
              }
            })

            score += factors[acceleIds[accele]] ?? 0;

            if (height && height >= info.fgconfig.height.min.value && height <= info.fgconfig.height.max.value) {
              let heightId = info.fgconfig.height.min.id - (height - info.fgconfig.height.min.value);
              score += factors[heightId] ?? 0;
            }

            if (weight && weight >= info.fgconfig.weight.min.value && weight <= info.fgconfig.weight.max.value) {
              let weightId = info.fgconfig.weight.min.id - (weight - info.fgconfig.weight.min.value);
              score += factors[weightId] ?? 0;
            }

            if (foot === 2 || (!basicHasTBLZ && !plusHasTBLZ)) {
              let diff = 0;
              let footConfig = info.fgconfig.foot[1];
              diff += Math.max(0, (curve - curveConfig.reduce) * ((factors[footConfig.curve] ?? 0) / curveConfig.factor));
              diff += Math.max(0, (composure - composureConfig.reduce) * ((factors[footConfig.composure] ?? 0) / composureConfig.factor));
              if (basicHasTBLZ) {
                diff += factors[footConfig.gamechanger] ?? 0;
              }
              if (plusHasTBLZ) {
                diff += factors[footConfig.gamechangerPlus] ?? 0;
              }
              score -= diff;
            }

            if (foot === 1 || (!basicHasTBLZ && !plusHasTBLZ)) {
              let diff = 0;
              let footConfig = info.fgconfig.foot[2];
              diff += Math.max(0, (curve - curveConfig.reduce) * ((factors[footConfig.curve] ?? 0) / curveConfig.factor));
              diff += Math.max(0, (composure - composureConfig.reduce) * ((factors[footConfig.composure] ?? 0) / composureConfig.factor));
              if (basicHasTBLZ) {
                diff += factors[footConfig.gamechanger] ?? 0;
              }
              if (plusHasTBLZ) {
                diff += factors[footConfig.gamechangerPlus] ?? 0;
              }
              score -= diff;
            }

            let roleSuffix = "";
            if (plusRoles.includes(`${role.posId}_${role.role}`)) {
              score += factors[89] ?? 0;
              roleSuffix = " +";
            }

            if (plusPlusRoles.includes(`${role.posId}_${role.role}`)) {
              score += factors[90] ?? 0;
              roleSuffix = " ++";
            }
            score *= role.multiplier;
            if (bodyType >= 10) {
              score += info.fgconfig.special1;
            }
            if (isGK && isLegend) {
              score += info.fgconfig.special2;
            }
            if (score > 0) {
              score = this.fgScoreToTargetRange(score, helpers).toFixed(1);
              let gradesIndex = ((i) => i === -1 ? 5 : i)(
                _.findIndex(info.GGRRAR.rank[role.posId], (value) => value <= score)
              );;
              let suffix = hasMeta || _.has(info.playerMetaData, player.definitionId) ? (score < newPlayer.rating ? " ↓" : " ↑") : " *";
              plusRoles
              fgList.push({
                "score": score,
                "posId": role.posId,
                "role": role.role,
                "posText": eafy(`extendedPlayerInfo.positions.position${role.posId}`),
                "playStyle": styleId,
                "roleText": eafy(`tactics.roles.role${role.role}`) + roleSuffix,
                "grade": info.fgGrades.text[gradesIndex] + suffix,
                "gradeColor": info.fgGrades.color[gradesIndex],
              })
            }
          }
        }
      }

      if (_.size(fgList) > 0) {
        fgList = _.uniqBy(_.sortBy(fgList, ['score']).reverse(), (item) => `${item.posId},${item.role}`);
      }
      if (shouldStore) {
        info.fgList[storeKey] = fgList;
      }
      return first ? _.first(fgList) : fgList;
    } else {
      return [];
    }
  }

  fgScoreToTargetRange(rating, helpers) {
    const { getInfo } = helpers;
    const info = getInfo();
    if (rating <= 0) {
      return rating;
    }
    const {
      minExpectedScore: minExpected,
      maxExpectedScore: maxExpected,
      targetMin,
      targetMax,
      smoothnessFactor: smoothness
    } = info.fgconfig;

    const normalizedScore = Math.max(
      0,
      Math.min(
        1,
        (rating - minExpected) / (maxExpected - minExpected)
      )
    );
    const scaledScore =
      targetMin +
      Math.sqrt(normalizedScore) *
      (1 + smoothness * Math.log(1 + normalizedScore)) *
      (targetMax - targetMin);

    return Math.round(scaledScore * 100) / 100;
  }

  fgCreateVirtualPlayers(player, helpers) {
    const { getInfo } = helpers;
    const info = getInfo();
    let newPlayer = new UTItemEntity(player);
    newPlayer.setMetaData(player.getMetaData())
    newPlayer.upgrades = _.cloneDeep(player.upgrades)
      ?? new UTItemAcademyStatEntity({});
    const attrConfig = newPlayer.isGK() ? info.attributesGK : info.attributes;

    const calcFace = (subs, weight) => _.sum(_.map(subs, (v, i) => v.value * weight[i]));
    _.forEach(attrConfig, (value, _key) => {
      const { list, weight, id } = value;
      const targetFace = newPlayer.getAttribute(id);
      let subs = _.map(list, (i) => {
        return {
          value: newPlayer.getSubAttribute(i).rating,
          fixed: newPlayer.upgrades.getSubAttributeOverride(i) instanceof UTPlayerSubAttributeVO
        }
      });
      const currentFace = calcFace(subs, weight);
      if (currentFace < targetFace) {
        const ratio = (targetFace - currentFace) / currentFace;
        let newSubs = _.map(subs, (v) => {
          return {
            value: v.fixed ? v.value : _.min([99, Math.floor(v.value * (1 + ratio) + 0.501)]),
            fixed: v.fixed
          }
        })
        let currentCalcFace = calcFace(newSubs, weight);
        let safe = 0;
        while (Math.floor(currentCalcFace + 0.501) < targetFace && safe < 500) {
          safe++;
          for (let i = 0; i < newSubs.length; i++) {
            if (!newSubs[i].fixed && newSubs[i].value < 99) {
              newSubs[i].value++;
              currentCalcFace = calcFace(newSubs, weight);
              if (Math.floor(currentCalcFace + 0.501) >= targetFace) break;
            }
          }
        }
        _.forEach(newSubs, (v, i) => {
          if (!v.fixed) {
            newPlayer.upgrades.subattributes.push(new UTPlayerSubAttributeVO(list[i], v.value))
          }
        })
      }
    })
    return newPlayer;
  }

  fgCreateElment(element, playerFG, helpers) {
    const { getInfo, createElementWithConfig } = helpers;
    const info = getInfo();
    let metaGradeColor = info.set.card_style == 1 ? `rgb(0,64,166)` : playerFG.gradeColor;
    let metaTextColor = info.set.card_style == 1 ? "#fcfcf7" : "#0f1010";
    element.replaceChildren();
    element.style.borderColor = metaGradeColor;
    element.appendChild(createElementWithConfig("div", {
      textContent: playerFG.grade,
      style: {
        color: metaTextColor,
        backgroundColor: metaGradeColor,
        lineHeight: `1.1rem`,
      },
      classList: ["mrk"],
    }))
    element.appendChild(createElementWithConfig("div", {
      textContent: playerFG.score,
      classList: ["mpr"],
    }))
    element.appendChild(createElementWithConfig("div", {
      textContent: playerFG.posText,
      classList: ["mrp"],
    }))
  }

  fgPopup(player, helpers) {
    const {
      getInfo,
      getCurrentController,
      showLoader,
      hideLoader,
      createElementWithConfig,
      createDF,
      fy,
      eafy,
      notice,
    } = helpers;
    const info = getInfo();
    showLoader();
    const showPopup = (playerFG) => {
      hideLoader();
      let mp = new EADialogViewController({
        dialogOptions: [{ labelEnum: enums.UIDialogOptions.OK }],
        message: fy(`fgrating.popupm1`),
        title: fy("fgrating.popupt"),
        type: EADialogView.Type.MESSAGE
      });
      mp.init();
      mp.onExit.observe(mp, (e, _z) => {
        e.unobserve(mp);
      });
      gPopupClickShield.setActivePopup(mp);
      _.flatMap(mp.getView().dialogOptions, (v, i) => {
        if (v.__text.innerHTML == "*") {
          v.setText(fy(`popupButtonsText.${mp.options[i].labelEnum}`))
        }
      })
      mp.getView().__msg.style.padding = "1rem";
      mp.getView().__msg.style.fontSize = "100%";

      mp.getView()._fsu ??= {};

      let scrollWrapper = createElementWithConfig("div", {
        style: {
          maxHeight: "250px",
          overflowY: "auto",
          position: "relative",
          margin: "20px 0"
        }
      });
      let table = createElementWithConfig("table", {
        style: {
          width: "100%",
          borderCollapse: "collapse",
        },
      });
      let thead = document.createElement("thead");
      let theadTr = document.createElement("tr");

      _.range(1, 6).forEach(i => {
        theadTr.appendChild(
          createElementWithConfig("th", {
            textContent: fy(`fgrating.popup.title${i}`),
            style: {
              padding: "0.5rem",
              position: "sticky",
              top: "0",
              backgroundColor: "#30312f",
              zIndex: "20"
            }
          })
        );
      });

      thead.appendChild(theadTr);
      table.appendChild(thead);

      const columns = ['posText', 'roleText', 'grade', 'score'];
      let tbody = document.createElement("tbody");

      _.forEach(playerFG, (player, index) => {
        const bgColor = index % 2 === 0 ? "#212224" : "#18191b";
        let tr = createElementWithConfig("tr", {
          style: {
            backgroundColor: bgColor // 设置动态背景色
          }
        });
        _.forEach(columns, (key) => {
          tr.appendChild(
            createElementWithConfig("td", {
              textContent: player[key],
              style: {
                padding: "0.5rem",
              }
            })
          );
        });
        tr.appendChild(
          createDF(
            `<td style="padding: 0.5rem;"><div class="item" style="display: flex; align-items: center; padding: 0.5rem;"><div class="playStyle chemstyle${player.playStyle}" style="font-size: 18px; margin-right: 6px;"></div><div>${eafy(`playstyles.playstyle${player.playStyle}`)}</div></div></td>`
          )
        );
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      scrollWrapper.appendChild(table);
      mp.getView()._fsu.scrollWrapper = scrollWrapper;
      mp.getView().__msg.appendChild(scrollWrapper);
    }
    if (!repositories.PlayerMeta.get(player.definitionId)) {
      services.PlayerMetaData.updateItemPlayerMeta([player]).observe(getCurrentController(), function (q, w) {
        q.unobserve(getCurrentController());
        if (w.success) {
          player.setMetaData(repositories.PlayerMeta.get(player.definitionId));
          let fgList = this.fgCalc(player, false, true, undefined, helpers);
          let bigCard = document.querySelector(`.fsu-cards-meta[data-id='${player.id}']`);
          if (bigCard) {
            this.fgCreateElment(bigCard, _.first(fgList), helpers);
          }
          let smallCard = document.querySelector(`.fsu-cards-metarating[data-id='${player.id}']`);
          if (smallCard) {
            smallCard.textContent = _.first(fgList).grade;
          }
          showPopup(fgList);
        } else {
          notice("notice.loaderror", 2)
          hideLoader()
        }
      }.bind(this));
    } else {
      showPopup(info.fgList[player.id] || this.fgCalc(player, false, true, undefined, helpers))
    }
  }

  createFacade(helpers) {
    return {
      fgCalc: (player, first, shouldStore, styleId) =>
        this.fgCalc(player, first, shouldStore, styleId, helpers),
      fgScoreToTargetRange: (rating) => this.fgScoreToTargetRange(rating, helpers),
      fgCreateVirtualPlayers: (player) => this.fgCreateVirtualPlayers(player, helpers),
      fgCreateElment: (element, playerFG) => this.fgCreateElment(element, playerFG, helpers),
      fgPopup: (player) => this.fgPopup(player, helpers),
    };
  }
}