export class AcademyCalcService {
  academyAddAttr(awards, isGk, player, helpers) {
    const { getInfo } = helpers;
    const info = getInfo();
    // ---------- virtual player ----------
    const virtualPlayer = new UTItemEntity(player);

    virtualPlayer.upgrades = _.cloneDeep(player?.upgrades)
      ?? new UTItemAcademyStatEntity({});

    player?.definitionId &&
      virtualPlayer.setMetaData(
        repositories.PlayerMeta.get(player.definitionId)
      );

    // ---------- result containers ----------
    const faceDiffMap = new Map();
    const upgradeResult = {};

    // ---------- helpers ----------
    const addFaceDiff = (faceKey, diff) => {
      faceDiffMap.set(faceKey, (faceDiffMap.get(faceKey) || 0) + diff);
    };

    const pushUpgrade = (type, vo, faceKey, diff) => {
      if (diff <= 0) return;

      upgradeResult[type] ??= [];
      upgradeResult[type].push(vo);
      virtualPlayer.upgrades[type].push(vo);
      addFaceDiff(faceKey, diff);
    };

    // ---------- stat type guards ----------
    const isSubStat = type =>
      (type >= AcademyStatEnum.ACCELERATION && type <= AcademyStatEnum.PENALTIES) ||
      (type >= AcademyStatEnum.GK_SUB_DIVING && type <= AcademyStatEnum.GK_SUB_POSITIONING_SUB);

    const isFaceStat = type =>
      (type >= AcademyStatEnum.PACE && type <= AcademyStatEnum.PHYSICALITY) ||
      (type >= AcademyStatEnum.GK_DIVING && type <= AcademyStatEnum.GK_POSITIONING);

    // ---------- face config ----------
    const faceStatConfig = isGk ? info.attributesGK : info.attributes;

    // ---------- lookup tables (IMPORTANT) ----------
    const subKeyToFaceKey = {};
    const faceIdToFaceKey = {};

    _.forEach(faceStatConfig, (cfg, faceKey) => {
      faceIdToFaceKey[cfg.id] = faceKey;
      cfg.list?.forEach(subKey => {
        subKeyToFaceKey[subKey] = faceKey;
      });
    });

    // ---------- main loop ----------
    _.forEach(awards, award => {
      const { type, value, maxValue: max = 99 } = award;

      // ---------- sub attribute ----------
      if (isSubStat(type)) {
        const subKey = UTAcademyUtils.getSubAttributeByUpgradeId(type);
        const faceKey = subKeyToFaceKey[subKey];
        if (!faceKey) return;

        const current = virtualPlayer.getSubAttribute(subKey)?.rating || 0;
        const target = Math.min(current + value, max);
        const diff = target - current;

        pushUpgrade(
          'subattributes',
          new UTPlayerSubAttributeVO(subKey, target),
          faceKey,
          diff
        );
        return;
      }

      // ---------- face attribute ----------
      if (isFaceStat(type)) {
        const faceId = UTAcademyUtils.getAttributeByUpgradeId(type);
        const faceKey = faceIdToFaceKey[faceId];
        if (!faceKey) return;

        const stat = this.academyUpdataFaceAttr(
          virtualPlayer,
          isGk,
          faceId,
          value,
          max,
          helpers
        );

        const totalDiff = _.sumBy(_.values(stat.diffs), 'diff');

        pushUpgrade(
          'attributes',
          new UTPlayerAttributeVO(stat.faceKey, stat.targetFace),
          faceKey,
          totalDiff
        );
      }
    });
    //debug.log(player, virtualPlayer, awards, faceDiffMap, upgradeResult)

    const attrMap = new Map([
      ["ovr", 0], ["ps", 0], ["psplus", 0],
      ["wf", 0], ["sm", 0], ["post", 0], ["role", 0], ["rarity", 0], ["cu", 0]
    ]);

    const attrIds = isGk ? info.attributesGK : info.attributes;

    const baseKeys = new Set(attrMap.keys());
    const dynamicKeys = new Set();

    // 辅助更新函数
    const update = (key, val) => {
      if (!attrMap.has(key) && !baseKeys.has(key)) {
        dynamicKeys.add(key); // 记录运行时新增 key
      }
      attrMap.set(key, (attrMap.get(key) || 0) + val);
    };

    const isPlayer = player != null;

    const basicPlayStyles = isPlayer ? _.map(player.getBasicPlayStyles(), "traitId") : [];
    const plusPlayStyles = isPlayer ? _.map(player.getPlusPlayStyles(), "traitId") : [];
    const newAddBasicPlayStyles = [];

    _.forEach(awards, reward => {
      const value = reward.value;
      const type = reward.type;
      const playerValue = UTAcademyUtils.getPlayerFinalStatValue(player, reward);
      const max = reward.maxValue || 99;
      const delta = Math.max(
        0,
        isPlayer
          ? Math.min(playerValue + value, max) - playerValue
          : value
      );

      switch (true) {
        case (type >= AcademyStatEnum.ACCELERATION && type <= AcademyStatEnum.PENALTIES):
        case (type >= AcademyStatEnum.GK_SUB_DIVING && type <= AcademyStatEnum.GK_SUB_POSITIONING_SUB):
          const subKey = _.findKey(attrIds, v => _.includes(v.list, UTAcademyUtils.getSubAttributeByUpgradeId(type)))
          update(subKey, delta);
          break;
        case (type >= AcademyStatEnum.PACE && type <= AcademyStatEnum.PHYSICALITY):
        case (type >= AcademyStatEnum.GK_DIVING && type <= AcademyStatEnum.GK_POSITIONING):

          const mainKey = _.findKey(attrIds, v => v.id === UTAcademyUtils.getAttributeByUpgradeId(type))
          if (isPlayer) {
            const stat = this.academyUpdataFaceAttr(player, isGk, UTAcademyUtils.getAttributeByUpgradeId(type), value, max, helpers);
            const totalDiff = _.sumBy(_.values(stat.diffs), 'diff');
            update(`${mainKey}`, totalDiff);
          } else {
            update(`${mainKey}*`, delta * attrIds[mainKey].list.length);
          }
          break;
        case (type >= AcademyStatEnum.FINISHING_FINESSE_SHOT && type <= AcademyStatEnum.GOAL_KEEPER_DEFLECTOR):
          let traitId = UTAcademyUtils.getTraitByAcademyEnum(type);
          if (value === 2) {
            if (plusPlayStyles.length < max && !plusPlayStyles.includes(traitId)) {
              update("psplus", 1);
              plusPlayStyles.push(traitId)
              if (basicPlayStyles.includes(traitId)) {
                _.pull(basicPlayStyles, traitId)
                if (newAddBasicPlayStyles.includes(traitId)) {
                  _.pull(newAddBasicPlayStyles, traitId)
                  update("ps", -1);
                }
              }
            }
          } else {
            if (basicPlayStyles.length < max && !basicPlayStyles.includes(traitId)) {
              update("ps", 1);
              basicPlayStyles.push(traitId)
              newAddBasicPlayStyles.push(traitId);
            }
          }
          break;
        case type === AcademyStatEnum.OVR:
          update("ovr", delta);
          break;
        case type === AcademyStatEnum.RARITY:
          (!isPlayer || player.rareflag !== value) && attrMap.set("rarity", 1);
          break;
        case (type >= AcademyStatEnum.CB && type <= AcademyStatEnum.CF):
          (!isPlayer || !player.possiblePositions.includes(UTAcademyUtils.mapEvolutionStatToPlayerPosition(type))) && update("post", 1);
          break;
        case type === AcademyStatEnum.WEAK_FOOT:
          update("wf", delta);
          break;
        case type === AcademyStatEnum.SKILL_MOVES:
          update("sm", delta);
          break;
        case type === AcademyStatEnum.COSMETIC_UPGRADE:
          attrMap.set("cu", 1);
          break;
        case (type >= AcademyStatEnum.GK_GOALKEEPER && type <= AcademyStatEnum.LW_PLR4):
          let shouldUpdate = true;
          if (isPlayer) {
            const roleId = UTAcademyUtils.getPlayerRoleFromAcademyStatEnum(type);
            const posId = UTAcademyUtils.mapEvolutionStatToPlayerPosition(type);
            shouldUpdate =
              (value === AcademyTacticRoleBonusValue.PLUS_PLUS &&
                !player.getPlusPlusRoles().some(r => r.type === roleId && r.position === posId)) ||
              (value === AcademyTacticRoleBonusValue.PLUS &&
                !player.getPlusRoles().some(r => r.type === roleId && r.position === posId));
          }
          shouldUpdate && update("role", 1);
          break;
        default:
          break;
      }
    });
    const result = new Map();
    result.set("ovr", attrMap.get("ovr"));
    let statCount = 0;
    for (const key of dynamicKeys) {
      result.set(key, attrMap.get(key));
      statCount += attrMap.get(key);
    }
    for (const [key, val] of attrMap) {
      if (key !== "ovr" && !dynamicKeys.has(key)) {
        result.set(key, val);
      }
    }
    return {
      map: new Map([...result].filter(([_, v]) => v !== 0)),
      count: statCount
    };
  }

  academyAddAttrOutput(attrMap, helpers) {
    const { createElementWithConfig, fy } = helpers;
    let notShowNumber = ["rartiy", "cos"];
    let box = createElementWithConfig("div", {
      className: "academyBoostsBox"
    });
    if (attrMap.size > 0) {
      let hasMain = false;
      for (const [key, value] of attrMap) {
        let keyText = key;
        let textSuffix = notShowNumber.includes(key) ? "" : `<span>${value}</span>`;
        if (key.endsWith("*")) {
          keyText = key.replace("*", "");
          hasMain = true;
          textSuffix = "*" + textSuffix;
        }
        box.appendChild(createElementWithConfig("div", {
          innerHTML: `${fy(`academy.attr.${keyText}`)}${textSuffix}`,
          className: "academyBoostsItem"
        }));
      }
      if (hasMain) {
        box.appendChild(createElementWithConfig("div", {
          textContent: fy("academy.attr.maintips"),
          className: "academyBoostsTips"
        }));
      }
    } else {
      box.appendChild(createElementWithConfig("div", {
        textContent: fy("academy.attr.not"),
        className: "academyBoostsItem"
      }));
    }
    return box;
  }

  academyAttrToList(attrMap) {
    const excludeKeys = new Set([
      "ovr", "ps", "psplus", "wf", "sm",
      "post", "role", "rarity", "cu"
    ]);

    let main = 0;
    let sub = 0;
    const reordered = new Map();

    // 先统计 + 记录需要删除的 key
    for (const [key, value] of attrMap) {
      if (excludeKeys.has(key)) {
        reordered.set(key, value);
      } else {
        if (key.includes("*")) {
          main += value;
        } else {
          sub += value;
        }
      }
    }
    // main* 一定在最前
    if (main !== 0) reordered.set("main*", main);
    if (sub !== 0) reordered.set("sub", sub);
    return reordered;
  }

  academyUpdataFaceAttr(
    player,
    isGK,
    faceKey,
    increment,
    maxValue,
    helpers
  ) {
    const { getInfo } = helpers;
    const info = getInfo();
    const attrConfig = isGK ? info.attributesGK : info.attributes;
    const config = _.find(attrConfig, { id: faceKey });
    if (!config) return {};

    const currentFace = player.getAttribute(faceKey);
    if (currentFace >= maxValue) return {};

    const { list, weight } = config;
    const targetFace = _.min([99, maxValue, currentFace + increment]);
    const ratio = currentFace > 0 ? (targetFace - currentFace) / currentFace : 0;

    // 初始缩放
    let updatedSubs = _.map(list, id => {
      const base = player.getSubAttribute(id)?.rating || 0;
      return _.min([99, Math.floor(base * (1 + ratio) + 0.501)]);
    });

    const calcFace = (subs) => _.sum(_.map(subs, (v, i) => v * weight[i]));
    let currentCalcFace = calcFace(updatedSubs);
    let safe = 0;

    // 补偿循环
    while (Math.floor(currentCalcFace + 0.501) < targetFace && safe < 500) {
      safe++;
      for (let i = 0; i < updatedSubs.length; i++) {
        if (updatedSubs[i] < 99) {
          updatedSubs[i]++;
          currentCalcFace = calcFace(updatedSubs);
          if (Math.floor(currentCalcFace + 0.501) >= targetFace) break;
        }
      }
    }

    // 构造返回对象
    const diffs = _.reduce(list, (res, id, idx) => {
      const oldVal = player.getSubAttribute(id)?.rating || 0;
      const newVal = updatedSubs[idx];
      if (newVal !== oldVal) {
        res[id] = { old: oldVal, new: newVal, diff: newVal - oldVal };
      }
      return res;
    }, {});

    return {
      faceKey,
      targetFace,
      diffs
    };
  }

  academyPreviewEvolutionAttr(id, controller, player, helpers) {
    const { notice } = helpers;
    const academy = new UTAcademyViewModel(services.Academy);
    academy.setSlots(repositories.Academy.getSlots());
    academy.setSelectedSlot(id);
    services.PlayerMetaData.updateItemPlayerMeta([player]).observe(controller, function (q, _w) {
      q.unobserve(controller);
      player.setMetaData(repositories.PlayerMeta.get(player.definitionId));
      academy.getSlotPreview(id, player.id).observe(controller, function (e, t) {
        if (e.unobserve(controller), t.success && JSUtils.isObject(t.data)) {

          const selectedAcademy = t.data.updatedSlot;
          const academyBio = new UTPlayerBioViewController;
          const boostPlayer = selectedAcademy.levels[selectedAcademy.levels.length - 1].boostedPlayer;
          selectedAcademy.nowPlayer = player;
          academyBio.initWithItem(boostPlayer);
          controller.getNavigationController().pushViewController(academyBio);
          academyBio.getView().fsuAcademy = selectedAcademy;
          controller.getNavigationController().setNavigationTitle(selectedAcademy.slotName);

        } else if (!t.success) {
          notice("eroor!", 0)
        }
      })
    });

  }

  createFacade(helpers) {
    return {
      academyAddAttr: (awards, isGk, player) => this.academyAddAttr(awards, isGk, player, helpers),
      academyAddAttrOutput: (attrMap) => this.academyAddAttrOutput(attrMap, helpers),
      academyAttrToList: (attrMap) => this.academyAttrToList(attrMap),
      academyUpdataFaceAttr: (player, isGK, faceKey, increment, maxValue) =>
        this.academyUpdataFaceAttr(player, isGK, faceKey, increment, maxValue, helpers),
      academyPreviewEvolutionAttr: (id, controller, player) =>
        this.academyPreviewEvolutionAttr(id, controller, player, helpers),
    };
  }
}