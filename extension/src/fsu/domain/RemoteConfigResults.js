export const REMOTE_CONFIG_INVALID = "REMOTE_CONFIG_INVALID";

const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const MAX_OBJECT_KEYS = 5000;
const MAX_ARRAY_LENGTH = 5000;
const MAX_API_TOKEN_LENGTH = 128;
const API_TOKEN_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
const FUTBIN_PATH_PATTERN = /^[A-Za-z0-9/_?&=.%#:+-]{1,512}$/;
const EXTRA_CHEM_KEYS = Object.freeze([
  "full",
  "nation",
  "league",
  "club",
  "allNation",
  "allLeague"
]);
const KNOWN_API_KEYS = new Set([
  "meta",
  "fastsbc",
  "pack",
  "sbc",
  "ggrating",
  "evolutions",
  "inpacks",
  "other",
  "fgconfig",
  "playermeta",
  "lowprice"
]);

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {string} provider
 * @param {string[]} issues
 */
function invalid(provider, issues) {
  return {
    success: false,
    error: {
      code: REMOTE_CONFIG_INVALID,
      provider,
      issues: issues.slice(0, 20)
    }
  };
}

/**
 * @param {string} key
 */
function isForbiddenKey(key) {
  return FORBIDDEN_KEYS.has(key);
}

/**
 * @param {unknown} value
 * @param {number} [min]
 * @param {number} [max]
 */
function isFiniteInRange(value, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

/**
 * @param {unknown} value
 * @param {number} [min]
 * @param {number} [max]
 */
function isPositiveInt(value, min = 1, max = Number.MAX_SAFE_INTEGER) {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
  );
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
function isSafeFutbinPath(value) {
  return (
    typeof value === "string" &&
    FUTBIN_PATH_PATTERN.test(value) &&
    !value.startsWith("/") &&
    !value.includes("://") &&
    !value.includes("\\")
  );
}

/**
 * @param {unknown} value
 * @param {string} issuePath
 * @param {string[]} issues
 * @param {number} [depth]
 * @returns {unknown}
 */
function cloneSafeConfigValue(value, issuePath, issues, depth = 0) {
  if (depth > 12) {
    issues.push(`${issuePath}.depth`);
    return undefined;
  }
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    if (typeof value === "string" && value.length > 2048) {
      issues.push(`${issuePath}.string`);
      return undefined;
    }
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      issues.push(`${issuePath}.number`);
      return undefined;
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_LENGTH) {
      issues.push(`${issuePath}.size`);
      return undefined;
    }
    return value.map((item, index) =>
      cloneSafeConfigValue(item, `${issuePath}.${index}`, issues, depth + 1)
    );
  }
  if (isRecord(value)) {
    const entries = Object.entries(value);
    if (entries.length > MAX_OBJECT_KEYS) {
      issues.push(`${issuePath}.size`);
      return undefined;
    }
    /** @type {Record<string, unknown>} */
    const copy = Object.create(null);
    for (const [key, item] of entries) {
      if (isForbiddenKey(key)) {
        issues.push(`${issuePath}.${key}`);
        return undefined;
      }
      copy[key] = cloneSafeConfigValue(
        item,
        `${issuePath}.${key}`,
        issues,
        depth + 1
      );
    }
    return copy;
  }
  issues.push(`${issuePath}.type`);
  return undefined;
}

/**
 * @param {unknown} value
 */
export function parseUpdataConfig(value) {
  if (!isRecord(value)) {
    return invalid("updata", ["response must be an object"]);
  }

  const version = value.version;
  if (version !== undefined && !isFiniteInRange(version, 0, 1e9)) {
    return invalid("updata", ["version"]);
  }

  let updateURL = "";
  if (value.updateURL !== undefined) {
    if (typeof value.updateURL !== "string" || value.updateURL.length > 2048) {
      return invalid("updata", ["updateURL"]);
    }
    try {
      const parsed = new URL(value.updateURL);
      if (parsed.protocol !== "https:") {
        return invalid("updata", ["updateURL must be https"]);
      }
      updateURL = parsed.href;
    } catch {
      return invalid("updata", ["updateURL"]);
    }
  }

  /** @type {Record<string, string>} */
  const api = Object.create(null);
  if (value.api !== undefined) {
    if (!isRecord(value.api)) {
      return invalid("updata", ["api must be an object"]);
    }
    const entries = Object.entries(value.api);
    if (entries.length > 32) {
      return invalid("updata", ["api too large"]);
    }
    for (const [key, token] of entries) {
      if (isForbiddenKey(key) || !KNOWN_API_KEYS.has(key)) {
        return invalid("updata", [`api.${key}`]);
      }
      if (typeof token !== "string" || token.length > MAX_API_TOKEN_LENGTH) {
        return invalid("updata", [`api.${key}.token`]);
      }
      if (!API_TOKEN_PATTERN.test(token)) {
        return invalid("updata", [`api.${key}.charset`]);
      }
      api[key] = token;
    }
  }

  return {
    success: true,
    data: Object.freeze({
      version: version === undefined ? 0 : Number(version),
      updateURL,
      api: Object.freeze({ ...api })
    })
  };
}

/**
 * Fast SBC plans: { [challengeKey]: { t: number, g: Array<{ c, t }> } }
 * @param {unknown} value
 * @param {number} nowSeconds
 */
export function parseFastSbcConfig(value, nowSeconds) {
  if (!isRecord(value)) {
    return invalid("fastsbc", ["response must be an object"]);
  }
  const entries = Object.entries(value);
  if (entries.length > MAX_OBJECT_KEYS) {
    return invalid("fastsbc", ["too many keys"]);
  }
  /** @type {Record<string, unknown>} */
  const active = Object.create(null);
  for (const [key, item] of entries) {
    if (isForbiddenKey(key)) {
      return invalid("fastsbc", [`forbidden key ${key}`]);
    }
    if (!isRecord(item)) {
      return invalid("fastsbc", [`${key} must be object`]);
    }
    if (!isFiniteInRange(item.t, 0, 1e12)) {
      return invalid("fastsbc", [`${key}.t`]);
    }
    if (!Array.isArray(item.g) || item.g.length > 100) {
      return invalid("fastsbc", [`${key}.g`]);
    }
    const plan = [];
    for (let index = 0; index < item.g.length; index++) {
      const group = item.g[index];
      if (!isRecord(group) || !isPositiveInt(group.c, 1, 100) || !isRecord(group.t)) {
        return invalid("fastsbc", [`${key}.g.${index}`]);
      }
      const target = Object.create(null);
      if (group.t.rating !== undefined) {
        if (!isPositiveInt(group.t.rating, 0, 99)) {
          return invalid("fastsbc", [`${key}.g.${index}.t.rating`]);
        }
        target.rating = group.t.rating;
      } else {
        if (
          group.t.gs !== undefined &&
          !isPositiveInt(group.t.gs, 0, 1)
        ) {
          return invalid("fastsbc", [`${key}.g.${index}.t.gs`]);
        }
        if (
          group.t.rs !== undefined &&
          !isPositiveInt(group.t.rs, 0, 20)
        ) {
          return invalid("fastsbc", [`${key}.g.${index}.t.rs`]);
        }
        if (group.t.gs === undefined && group.t.rs === undefined) {
          return invalid("fastsbc", [`${key}.g.${index}.t`]);
        }
        if (group.t.gs !== undefined) target.gs = group.t.gs;
        if (group.t.rs !== undefined) target.rs = group.t.rs;
      }
      plan.push({ c: group.c, t: target });
    }
    if (Number(item.t) > nowSeconds) {
      active[key] = plan;
    }
  }
  return { success: true, data: active };
}

/**
 * Pack coin lookup table — record of positive pack ids to finite prices.
 * @param {unknown} value
 */
export function parsePackConfig(value) {
  if (!isRecord(value)) {
    return invalid("pack", ["response must be an object"]);
  }
  const entries = Object.entries(value);
  if (entries.length > MAX_OBJECT_KEYS) {
    return invalid("pack", ["too many keys"]);
  }
  /** @type {Record<string, number>} */
  const oddo = Object.create(null);
  for (const [key, price] of entries) {
    if (isForbiddenKey(key)) {
      return invalid("pack", ["forbidden key"]);
    }
    if (!isFiniteInRange(price, 0, 1e12)) {
      return invalid("pack", [`${key}.price`]);
    }
    oddo[key] = Number(price);
  }
  return { success: true, data: oddo };
}

/**
 * @param {unknown} value
 */
export function parseSbcConfig(value) {
  if (!isRecord(value)) {
    return invalid("sbc", ["response must be an object"]);
  }
  const reward = value.reward;
  const newest = value.new;
  if (reward !== undefined) {
    if (
      !Array.isArray(reward) ||
      reward.length > 100 ||
      !reward.every((item) => isPositiveInt(item, 0, 10))
    ) {
      return invalid("sbc", ["reward"]);
    }
  }
  if (newest !== undefined) {
    if (
      !Array.isArray(newest) ||
      newest.length > MAX_ARRAY_LENGTH ||
      !newest.every((item) => isPositiveInt(item))
    ) {
      return invalid("sbc", ["new"]);
    }
  }
  return {
    success: true,
    data: {
      reward: Array.isArray(reward) ? [...reward] : [],
      new: Array.isArray(newest) ? [...newest] : []
    }
  };
}

/**
 * @param {unknown} value
 */
export function parseInpacksConfig(value) {
  if (!isRecord(value)) {
    return invalid("inpacks", ["response must be an object"]);
  }
  const defIds = value.defIds;
  const rarityIds = value.rarityIds;
  if (defIds !== undefined) {
    if (
      !Array.isArray(defIds) ||
      defIds.length > MAX_ARRAY_LENGTH ||
      !defIds.every((id) => isPositiveInt(id))
    ) {
      return invalid("inpacks", ["defIds"]);
    }
  }
  if (rarityIds !== undefined) {
    if (
      !Array.isArray(rarityIds) ||
      rarityIds.length > MAX_ARRAY_LENGTH ||
      !rarityIds.every((id) => isPositiveInt(id, 0))
    ) {
      return invalid("inpacks", ["rarityIds"]);
    }
  }
  return {
    success: true,
    data: {
      defIds: Array.isArray(defIds) ? [...defIds] : [],
      rarityIds: Array.isArray(rarityIds) ? [...rarityIds] : []
    }
  };
}

/**
 * @param {unknown} value
 */
export function parseOtherConfig(value) {
  if (!isRecord(value)) {
    return invalid("other", ["response must be an object"]);
  }
  const dynamic = value.dynamic ?? {};
  const chem = value.chem ?? {};
  if (!isRecord(dynamic) || !isRecord(chem)) {
    return invalid("other", ["dynamic/chem must be objects"]);
  }
  const dynamicEntries = Object.entries(dynamic);
  const chemEntries = Object.entries(chem);
  if (dynamicEntries.length > MAX_OBJECT_KEYS || chemEntries.length > MAX_OBJECT_KEYS) {
    return invalid("other", ["too many keys"]);
  }

  /** @type {Record<string, { exp?: number, change: number[], url: string }>} */
  const normalizedDynamic = Object.create(null);
  for (const [key, entry] of dynamicEntries) {
    if (isForbiddenKey(key) || !isPositiveInt(Number(key), 0)) {
      return invalid("other", [`dynamic.${key}`]);
    }
    if (!isRecord(entry)) {
      return invalid("other", [`dynamic.${key}.shape`]);
    }
    if (!isFiniteInRange(entry.exp, 0, 1e12)) {
      return invalid("other", [`dynamic.${key}.exp`]);
    }
    if (
      !Array.isArray(entry.change) ||
      entry.change.length > 20 ||
      !entry.change.every((id) => isPositiveInt(id, 1, 100))
    ) {
      return invalid("other", [`dynamic.${key}.change`]);
    }
    if (
      !isSafeFutbinPath(entry.url)
    ) {
      return invalid("other", [`dynamic.${key}.url`]);
    }
    normalizedDynamic[key] = {
      exp: Number(entry.exp),
      change: [...entry.change],
      url: entry.url
    };
  }

  /** @type {Record<string, Record<string, number | string>>} */
  const normalizedChem = Object.create(null);
  for (const [key, entry] of chemEntries) {
    if (isForbiddenKey(key) || !isPositiveInt(Number(key), 0)) {
      return invalid("other", [`chem.${key}`]);
    }
    if (!isRecord(entry)) {
      return invalid("other", [`chem.${key}.shape`]);
    }
    const normalizedEntry = Object.create(null);
    for (const chemKey of EXTRA_CHEM_KEYS) {
      const amount = entry[chemKey] ?? 0;
      if (!isPositiveInt(amount, 0, 100)) {
        return invalid("other", [`chem.${key}.${chemKey}`]);
      }
      normalizedEntry[chemKey] = amount;
    }
    if (
      !isSafeFutbinPath(entry.url)
    ) {
      return invalid("other", [`chem.${key}.url`]);
    }
    normalizedEntry.url = entry.url;
    normalizedChem[key] = normalizedEntry;
  }

  return {
    success: true,
    data: {
      dynamic: normalizedDynamic,
      chem: normalizedChem
    }
  };
}

/**
 * FG rating config is large and changes independently. Preserve its shape through
 * a bounded safe clone, then validate the fields consumed by FgRatingService.
 * @param {unknown} value
 */
export function parseFgConfig(value) {
  if (!isRecord(value)) {
    return invalid("fgconfig", ["response must be an object"]);
  }
  const attribute = value.attribute;
  const roles = value.roles;
  const height = value.height;
  const weight = value.weight;
  if (
    !isRecord(attribute) ||
    !Array.isArray(roles) ||
    !isRecord(value.weakFoot) ||
    !isRecord(value.skillMoves) ||
    !isRecord(value.foot) ||
    !isRecord(value.playStyle) ||
    !isRecord(value.plusPlayStyle) ||
    !isRecord(height) ||
    !isRecord(weight)
  ) {
    return invalid("fgconfig", ["attribute/roles"]);
  }
  if (
    Object.keys(attribute).length > MAX_OBJECT_KEYS ||
    roles.length > 200 ||
    !roles.every(
      (role) =>
        isRecord(role) &&
        isPositiveInt(role.posId, 0, 100) &&
        isPositiveInt(role.role, 0, 100) &&
        isRecord(role.factors) &&
        isFiniteInRange(role.multiplier, 0, 100)
    )
  ) {
    return invalid("fgconfig", ["size"]);
  }
  for (const key of [
    "minExpectedScore",
    "maxExpectedScore",
    "targetMin",
    "targetMax",
    "smoothnessFactor",
    "special1",
    "special2"
  ]) {
    if (!isFiniteInRange(value[key], -1e9, 1e9)) {
      return invalid("fgconfig", [key]);
    }
  }
  /** @type {Array<[string, Record<string, unknown>]>} */
  const ranges = [["height", height], ["weight", weight]];
  for (const [rangeKey, range] of ranges) {
    if (
      !isRecord(range) ||
      !isRecord(range.min) ||
      !isRecord(range.max) ||
      !isFiniteInRange(range.min.value, 0, 1000) ||
      !isFiniteInRange(range.max.value, 0, 1000) ||
      !isFiniteInRange(range.min.id, -1e6, 1e6) ||
      !isFiniteInRange(range.max.id, -1e6, 1e6)
    ) {
      return invalid("fgconfig", [rangeKey]);
    }
  }
  /** @type {string[]} */
  const issues = [];
  const cloned = cloneSafeConfigValue(value, "fgconfig", issues);
  if (issues.length || !isRecord(cloned)) {
    return invalid("fgconfig", issues.length ? issues : ["clone"]);
  }
  return {
    success: true,
    data: Object.freeze(cloned)
  };
}

/**
 * @param {unknown} value
 */
export function parseLowpriceConfig(value) {
  if (!isRecord(value)) {
    return invalid("lowprice", ["response must be an object"]);
  }
  /** @type {Record<string, Record<string, number>>} */
  const platforms = Object.create(null);
  for (const [platform, entries] of Object.entries(value)) {
    if (isForbiddenKey(platform)) {
      return invalid("lowprice", ["forbidden key"]);
    }
    if (!isRecord(entries)) {
      return invalid("lowprice", [`${platform} must be object`]);
    }
    const platformEntries = Object.entries(entries);
    if (platformEntries.length > 200) {
      return invalid("lowprice", [`${platform} too large`]);
    }
    /** @type {Record<string, number>} */
    const prices = Object.create(null);
    for (const [ratingKey, price] of platformEntries) {
      if (isForbiddenKey(ratingKey)) {
        return invalid("lowprice", [`${platform}.forbidden`]);
      }
      const rating = Number(ratingKey);
      if (!Number.isInteger(rating) || rating < 0 || rating > 99) {
        return invalid("lowprice", [`${platform}.${ratingKey}`]);
      }
      if (!isFiniteInRange(Number(price), 0, 1e12)) {
        return invalid("lowprice", [`${platform}.${ratingKey}.price`]);
      }
      prices[String(rating)] = Number(price);
    }
    platforms[platform] = prices;
  }
  return { success: true, data: platforms };
}
