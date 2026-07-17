export const SBC_READ_CAPABILITIES = Object.freeze({
  REQUIREMENT: "sbc.requirement-read",
  SET_REPOSITORY: "sbc.set-repository",
  LOCALIZATION: "sbc.localization"
});

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return value !== null && typeof value === "object";
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown> | null}
 */
function asPropertyBag(value) {
  if (isRecord(value)) return value;
  return typeof value === "function"
    ? /** @type {Record<string, unknown>} */ (
        /** @type {unknown} */ (value)
      )
    : null;
}

/**
 * @param {string} capability
 * @param {string[]} missing
 */
function unavailable(capability, missing) {
  return {
    success: false,
    error: {
      code: "EA_CAPABILITY_UNAVAILABLE",
      capability,
      missing
    }
  };
}

/**
 * Read-only boundary for dynamic EA SBC models.
 */
export class SbcReadAdapter {
  /**
   * @param {{
   *   getSbcRepository?: () => unknown,
   *   getLocalization?: () => unknown,
   *   getLocalizationUtil?: () => unknown
   * }} [options]
   */
  constructor({
    getSbcRepository = () => undefined,
    getLocalization = () => undefined,
    getLocalizationUtil = () => undefined
  } = {}) {
    this.getSbcRepository = getSbcRepository;
    this.getLocalization = getLocalization;
    this.getLocalizationUtil = getLocalizationUtil;
  }

  /**
   * @param {unknown} requirement
   */
  readRequirement(requirement) {
    if (!isRecord(requirement)) {
      return unavailable(SBC_READ_CAPABILITIES.REQUIREMENT, [
        "requirement"
      ]);
    }
    const getFirstKey = requirement.getFirstKey;
    const getValue = requirement.getValue;
    if (typeof getFirstKey !== "function" || typeof getValue !== "function") {
      return unavailable(SBC_READ_CAPABILITIES.REQUIREMENT, [
        "requirement.getFirstKey",
        "requirement.getValue"
      ]);
    }

    try {
      const key = getFirstKey.call(requirement);
      const values = getValue.call(requirement, key);
      if (
        (typeof key !== "number" && typeof key !== "string") ||
        !Array.isArray(values)
      ) {
        return unavailable(SBC_READ_CAPABILITIES.REQUIREMENT, [
          "requirement.key",
          "requirement.values"
        ]);
      }
      return {
        success: true,
        data: {
          key,
          values: [...values]
        }
      };
    } catch {
      return unavailable(SBC_READ_CAPABILITIES.REQUIREMENT, [
        "requirement.read"
      ]);
    }
  }

  /**
   * @param {unknown} setId
   */
  getSetName(setId) {
    let repository;
    try {
      repository = this.getSbcRepository();
    } catch {
      return unavailable(SBC_READ_CAPABILITIES.SET_REPOSITORY, [
        "services.SBC.repository"
      ]);
    }
    if (!isRecord(repository) || !isRecord(repository.sets)) {
      return unavailable(SBC_READ_CAPABILITIES.SET_REPOSITORY, [
        "services.SBC.repository.sets"
      ]);
    }
    const get = repository.sets.get;
    if (typeof get !== "function") {
      return unavailable(SBC_READ_CAPABILITIES.SET_REPOSITORY, [
        "services.SBC.repository.sets.get"
      ]);
    }

    try {
      const set = get.call(repository.sets, setId);
      if (!isRecord(set) || typeof set.name !== "string") {
        return unavailable(SBC_READ_CAPABILITIES.SET_REPOSITORY, [
          "services.SBC.repository.sets.name"
        ]);
      }
      return { success: true, data: set.name };
    } catch {
      return unavailable(SBC_READ_CAPABILITIES.SET_REPOSITORY, [
        "services.SBC.repository.sets.read"
      ]);
    }
  }

  /**
   * @param {"club" | "league" | "nation"} kind
   * @param {unknown} id
   */
  getEntityName(kind, id) {
    let util;
    let localization;
    try {
      util = this.getLocalizationUtil();
      localization = this.getLocalization();
    } catch {
      return unavailable(SBC_READ_CAPABILITIES.LOCALIZATION, [
        "localization.runtime"
      ]);
    }
    const utility = asPropertyBag(util);
    if (!utility || !localization) {
      return unavailable(SBC_READ_CAPABILITIES.LOCALIZATION, [
        "UTLocalizationUtil",
        "services.Localization"
      ]);
    }

    const methodName = {
      club: "teamIdToAbbr15",
      league: "leagueIdToName",
      nation: "nationIdToName"
    }[kind];
    const method = utility[methodName];
    if (typeof method !== "function") {
      return unavailable(SBC_READ_CAPABILITIES.LOCALIZATION, [
        `UTLocalizationUtil.${methodName}`
      ]);
    }

    try {
      const name = method.call(utility, id, localization);
      return typeof name === "string"
        ? { success: true, data: name }
        : unavailable(SBC_READ_CAPABILITIES.LOCALIZATION, [
            `UTLocalizationUtil.${methodName}.result`
          ]);
    } catch {
      return unavailable(SBC_READ_CAPABILITIES.LOCALIZATION, [
        `UTLocalizationUtil.${methodName}.read`
      ]);
    }
  }
}
