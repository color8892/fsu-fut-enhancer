import { PlayerMetaCacheService } from "../domain/PlayerMetaCacheService.js";

export const PLAYER_META_CACHE_PATCH_IDS = Object.freeze({
  XHR_CAPTURE: "player-meta.xhr-capture",
  FACTORY_HYDRATE: "player-meta.factory-hydrate",
  ENTITY_HYDRATE: "player-meta.entity-hydrate",
  ACADEMY_GK_SUB_ATTRIBUTE: "academy.gk-sub-attribute"
});

function installMethodPatch(patchLifecycle, descriptor) {
  return patchLifecycle.install({
    ...descriptor,
    verify: ({ originalDescriptor, originalValue }) => ({
      ok:
        originalDescriptor !== undefined &&
        "value" in originalDescriptor &&
        originalDescriptor.writable === true &&
        typeof originalValue === "function",
      missing: [`${descriptor.targetLabel}.method`]
    })
  });
}

export function installPlayerMetaCachePatches(deps) {
  const {
    info,
    services,
    repositories,
    GM_setValue,
    patchLifecycle,
    debug
  } = deps;
  const service = new PlayerMetaCacheService({
    info,
    persist: GM_setValue,
    getYear: () => info.base.year,
    debug
  });
  const capabilities = {
    createSubAttribute: (key, value) => new UTPlayerSubAttributeVO(key, value),
    createRole: (value) =>
      services.PlayerMetaData.metaDAO.generatePlayerRoleVO(value)
  };
  const shouldHydrate = (player) =>
    Number.isInteger(Number(player?.definitionId)) &&
    player?.type === ItemType.PLAYER &&
    Object.prototype.hasOwnProperty.call(
      info.playerMetaData || {},
      Number(player.definitionId)
    ) &&
    !repositories.PlayerMeta.has(Number(player.definitionId));

  installMethodPatch(patchLifecycle, {
    id: PLAYER_META_CACHE_PATCH_IDS.XHR_CAPTURE,
    phase: "late",
    targetLabel: "XMLHttpRequest.prototype.open",
    resolveTarget: () =>
      typeof XMLHttpRequest === "undefined"
        ? null
        : { owner: XMLHttpRequest.prototype, key: "open" },
    apply: ({ target, originalDescriptor, originalValue }) => {
      Object.defineProperty(target.owner, target.key, {
        ...originalDescriptor,
        value: function fsuPlayerMetaOpen(method, url, ...rest) {
          if (
            typeof url === "string" &&
            url.includes("/attributes/metadata")
          ) {
            this.addEventListener("load", () => {
              try {
                service.capture(JSON.parse(this.responseText));
              } catch (error) {
                debug.log("Player metadata response rejected", error);
              }
            });
          }
          return originalValue.call(this, method, url, ...rest);
        }
      });
    }
  });

  installMethodPatch(patchLifecycle, {
    id: PLAYER_META_CACHE_PATCH_IDS.FACTORY_HYDRATE,
    phase: "late",
    targetLabel:
      "UTItemEntityFactory.prototype.generateItemConstructorOptions",
    resolveTarget: () =>
      typeof UTItemEntityFactory === "undefined"
        ? null
        : {
            owner: UTItemEntityFactory.prototype,
            key: "generateItemConstructorOptions"
          },
    apply: ({ target, originalDescriptor, originalValue }) => {
      Object.defineProperty(target.owner, target.key, {
        ...originalDescriptor,
        value: function fsuGenerateItemConstructorOptions(...args) {
          const options = originalValue.apply(this, args);
          if (shouldHydrate(options)) {
            options.metaData = service.hydrate(
              options,
              options.metaData,
              capabilities
            );
          }
          return options;
        }
      });
    }
  });

  installMethodPatch(patchLifecycle, {
    id: PLAYER_META_CACHE_PATCH_IDS.ENTITY_HYDRATE,
    phase: "late",
    targetLabel: "UTItemEntity.prototype.setMetaData",
    resolveTarget: () =>
      typeof UTItemEntity === "undefined"
        ? null
        : { owner: UTItemEntity.prototype, key: "setMetaData" },
    apply: ({ target, originalDescriptor, originalValue }) => {
      Object.defineProperty(target.owner, target.key, {
        ...originalDescriptor,
        value: function fsuSetMetaData(metaData) {
          const result = originalValue.call(this, metaData);
          if (shouldHydrate(this)) {
            this._metaData = service.hydrate(
              this,
              metaData,
              capabilities
            );
          }
          return result;
        }
      });
    }
  });

  const academyMap =
    typeof AcademyStatEnum === "undefined" ||
    typeof ItemSubAttribute === "undefined"
      ? null
      : new Map([
          [AcademyStatEnum.GK_SUB_DIVING, ItemSubAttribute.gkdiving],
          [AcademyStatEnum.GK_SUB_HANDLING, ItemSubAttribute.gkhandling],
          [AcademyStatEnum.GK_SUB_KICKING, ItemSubAttribute.gkkicking],
          [AcademyStatEnum.GK_SUB_REFLEXES, ItemSubAttribute.gkreflexes],
          [
            AcademyStatEnum.GK_SUB_POSITIONING_SUB,
            ItemSubAttribute.gkpositioning
          ]
        ]);
  installMethodPatch(patchLifecycle, {
    id: PLAYER_META_CACHE_PATCH_IDS.ACADEMY_GK_SUB_ATTRIBUTE,
    phase: "late",
    targetLabel: "UTAcademyUtils.getSubAttributeByUpgradeId",
    resolveTarget: () =>
      typeof UTAcademyUtils === "undefined" || academyMap === null
        ? null
        : { owner: UTAcademyUtils, key: "getSubAttributeByUpgradeId" },
    apply: ({ target, originalDescriptor, originalValue }) => {
      Object.defineProperty(target.owner, target.key, {
        ...originalDescriptor,
        value: function fsuGetSubAttributeByUpgradeId(type) {
          return academyMap?.has(type)
            ? academyMap.get(type)
            : originalValue.call(this, type);
        }
      });
    }
  });

  return service;
}
