export class SchemaValidationError extends Error {
  /**
   * @param {string} message
   */
  constructor(message) {
    super(message);
    this.name = "SchemaValidationError";
  }
}

/**
 * @param {unknown} v
 * @returns {v is number}
 */
export const isNumber = (v) => typeof v === "number";

/**
 * @param {unknown} v
 * @returns {v is string}
 */
export const isString = (v) => typeof v === "string";

/**
 * @param {unknown} v
 * @returns {v is boolean}
 */
export const isBoolean = (v) => typeof v === "boolean";

/**
 * @param {unknown} v
 * @returns {v is Record<string, any>}
 */
export const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * @param {unknown} v
 * @returns {v is any[]}
 */
export const isArray = (v) => Array.isArray(v);

/**
 * @template T
 * @param {(v: unknown) => v is T} guard
 * @returns {(v: unknown) => v is T[]}
 */
export const isArrayOf = (guard) => {
  /** @type {(v: unknown) => v is T[]} */
  const check = (v) => isArray(v) && v.every(guard);
  return check;
};

/**
 * @template T
 * @param {(v: unknown) => v is T} guard
 * @returns {(v: unknown) => v is T | null | undefined}
 */
export const isOptional = (guard) => {
  /** @type {(v: unknown) => v is T | null | undefined} */
  const check = (v) => v === undefined || v === null || guard(v);
  return check;
};

/**
 * @param {unknown} v
 * @returns {v is Record<string, any>}
 */
export function isUpdataConfig(v) {
  return (
    isObject(v) &&
    typeof v.version === "number" &&
    isOptional(isString)(v.updateURL) &&
    isObject(v.api)
  );
}

/**
 * @param {unknown} v
 * @returns {v is Record<string, any>}
 */
export function isMetaConfig(v) {
  return (
    isObject(v) &&
    isOptional(isObject)(v.bodyType) &&
    isOptional((val) => isNumber(val) || isObject(val))(v.baseBodyType) &&
    isOptional(isArrayOf(isNumber))(v.realFace)
  );
}

/**
 * @param {unknown} v
 * @returns {v is Record<string, any>}
 */
export function isFastSbcConfig(v) {
  return (
    isObject(v) &&
    Object.values(v).every(
      (item) => isObject(item) && isNumber(item.t)
    )
  );
}

/**
 * @param {unknown} v
 * @returns {v is Record<string, any>}
 */
export function isPackConfig(v) {
  return isObject(v);
}

/**
 * @param {unknown} v
 * @returns {v is Record<string, any>}
 */
export function isSbcConfig(v) {
  return (
    isObject(v) &&
    isOptional(isArrayOf(isNumber))(v.reward) &&
    isOptional(isArray)(v.new)
  );
}

/**
 * @param {unknown} v
 * @returns {v is Record<string, any>}
 */
export function isGgRatingConfig(v) {
  return isObject(v);
}

/**
 * @param {unknown} v
 * @returns {v is Record<string, any>}
 */
export function isEvolutionsConfig(v) {
  return isObject(v) && isOptional(isArray)(v.new);
}

/**
 * @param {unknown} v
 * @returns {v is Record<string, any>}
 */
export function isInpacksConfig(v) {
  return (
    isObject(v) &&
    isOptional(isArrayOf(isNumber))(v.defIds) &&
    isOptional(isArrayOf(isNumber))(v.rarityIds)
  );
}

/**
 * @param {unknown} v
 * @returns {v is Record<string, any>}
 */
export function isOtherConfig(v) {
  return (
    isObject(v) &&
    isOptional(isObject)(v.dynamic) &&
    isOptional(isObject)(v.chem)
  );
}

/**
 * @param {unknown} v
 * @returns {v is Record<string, any>}
 */
export function isFgConfig(v) {
  return isObject(v);
}

/**
 * @param {unknown} v
 * @returns {v is any[][]}
 */
export function isPlayerMetaConfig(v) {
  return isArray(v) && v.every(item => isArray(item));
}

/**
 * @param {unknown} v
 * @returns {v is Record<string, any>}
 */
export function isLowpriceConfig(v) {
  return isObject(v);
}

/**
 * @param {unknown} v
 * @returns {v is Record<string, any>}
 */
export function isFutGgPrices(v) {
  return isObject(v) && isOptional(isArray)(v.data);
}

/**
 * @param {unknown} v
 * @returns {v is Record<string, any>[]}
 */
export function isFutNextPrices(v) {
  return isArray(v) && v.every((item) => isObject(item) && isArray(item.prices));
}

/**
 * @param {unknown} v
 * @returns {v is Record<string, any>}
 */
export function isFutbinPriceInfo(v) {
  return isObject(v);
}

/**
 * @param {unknown} v
 * @returns {v is Record<string, any>}
 */
export function isFutbinFilteredPlayers(v) {
  return isObject(v) && isOptional(isArray)(v.data);
}

/**
 * @param {unknown} v
 * @returns {v is Record<string, any>}
 */
export function isFutbinMinimalInfo(v) {
  return isObject(v) && isOptional(isArray)(v.data);
}
