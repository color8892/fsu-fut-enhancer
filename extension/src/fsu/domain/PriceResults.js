export const PRICE_RESULT_INVALID = "PRICE_RESULT_INVALID";
export const PRICE_PROVIDER_FAILED = "PRICE_PROVIDER_FAILED";

/**
 * @typedef {{ n: number, y: number, _ts: number }} PriceEntry
 * @typedef {{
 *   code: typeof PRICE_RESULT_INVALID | typeof PRICE_PROVIDER_FAILED,
 *   provider: string,
 *   issues: string[]
 * }} PriceResultError
 * @typedef {{
 *   success: boolean,
 *   data: { prices: Record<string, PriceEntry> },
 *   stale: boolean,
 *   error?: PriceResultError
 * }} PriceBatchResult
 */

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
 * @returns {PriceBatchResult}
 */
function invalid(provider, issues) {
  return {
    success: false,
    data: { prices: {} },
    stale: false,
    error: { code: PRICE_RESULT_INVALID, provider, issues }
  };
}

/**
 * @param {unknown} value
 * @param {number} now
 * @returns {PriceBatchResult}
 */
export function parseFutGgPrices(value, now) {
  if (!isRecord(value) || !Array.isArray(value.data)) {
    return invalid("futgg", ["data must be an array"]);
  }

  /** @type {Record<string, PriceEntry>} */
  const prices = {};
  for (const [index, item] of value.data.entries()) {
    if (!isRecord(item) || !Number.isInteger(item.eaId) || Number(item.eaId) <= 0) {
      return invalid("futgg", [`data[${index}].eaId`]);
    }
    if (
      item.price !== null &&
      (typeof item.price !== "number" || !Number.isFinite(item.price))
    ) {
      return invalid("futgg", [`data[${index}].price`]);
    }

    const booleanKeys = ["isExtinct", "isSbc", "isObjective"];
    for (const key of booleanKeys) {
      if (item[key] !== undefined && typeof item[key] !== "boolean") {
        return invalid("futgg", [`data[${index}].${key}`]);
      }
    }

    const hasSeasonReward =
      item.premiumSeasonPassLevel !== null &&
      item.premiumSeasonPassLevel !== undefined ||
      item.standardSeasonPassLevel !== null &&
      item.standardSeasonPassLevel !== undefined;
    if (
      item.price === null &&
      item.isExtinct !== true &&
      item.isSbc !== true &&
      item.isObjective !== true &&
      !hasSeasonReward
    ) {
      continue;
    }

    let type = 0;
    if (item.isSbc === true) {
      type = 1;
    } else if (item.isObjective === true) {
      type = hasSeasonReward ? 3 : 2;
    }
    const price =
      typeof item.price === "number" && item.price > 0 ? item.price : 0;
    prices[String(item.eaId)] = { n: price, y: type, _ts: now };
  }

  return { success: true, data: { prices }, stale: false };
}

/**
 * @param {unknown} value
 * @param {number} now
 * @returns {PriceBatchResult}
 */
export function parseFutNextPrices(value, now) {
  if (!Array.isArray(value)) {
    return invalid("futnext", ["response must be an array"]);
  }

  /** @type {Record<string, PriceEntry>} */
  const prices = {};
  for (const [index, item] of value.entries()) {
    if (
      !isRecord(item) ||
      !Number.isInteger(item.definitionId) ||
      Number(item.definitionId) <= 0 ||
      !Array.isArray(item.prices)
    ) {
      return invalid("futnext", [`response[${index}]`]);
    }
    if (item.prices.length === 0) continue;
    const firstPrice = item.prices[0];
    if (
      typeof firstPrice !== "number" ||
      !Number.isFinite(firstPrice) ||
      firstPrice < 0
    ) {
      return invalid("futnext", [`response[${index}].prices[0]`]);
    }
    prices[String(item.definitionId)] = { n: firstPrice, y: 0, _ts: now };
  }

  return { success: true, data: { prices }, stale: false };
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

/**
 * @param {unknown} value
 * @param {{
 *   definitionIdKey: string,
 *   platform: "pc" | "ps",
 *   now: number
 * }} options
 * @returns {PriceBatchResult}
 */
export function parseFutbinPrices(value, options) {
  if (!isRecord(value) || !Array.isArray(value.data)) {
    return invalid("futbin", ["data must be an array"]);
  }

  /** @type {Record<string, PriceEntry>} */
  const prices = {};
  for (const [index, item] of value.data.entries()) {
    if (!isRecord(item)) {
      return invalid("futbin", [`data[${index}]`]);
    }
    const definitionId = Number(item[options.definitionIdKey]);
    if (!Number.isInteger(definitionId) || definitionId <= 0) {
      return invalid("futbin", [
        `data[${index}].${options.definitionIdKey}`
      ]);
    }

    const platformPrefix = `${options.platform}_`;
    const rawPrice =
      item.LCPrice ?? item[`${platformPrefix}LCPrice`] ?? item.price ?? 0;
    const rawMin =
      item.MinPrice ?? item[`${platformPrefix}MinPrice`] ?? 1;
    const rawMax =
      item.MaxPrice ?? item[`${platformPrefix}MaxPrice`] ?? 1;
    const price = finiteNumber(rawPrice);
    const min = finiteNumber(rawMin);
    const max = finiteNumber(rawMax);
    if (price === null || min === null || max === null) {
      return invalid("futbin", [`data[${index}].price-range`]);
    }

    const type = min === 0 && max === 0 ? (price === 0 ? 2 : 1) : 0;
    prices[String(definitionId)] = {
      n: Math.max(0, price),
      y: type,
      _ts: options.now
    };
  }

  return { success: true, data: { prices }, stale: false };
}

/**
 * @param {string} provider
 * @param {Record<string, PriceEntry>} prices
 * @param {string[]} [issues]
 * @returns {PriceBatchResult}
 */
export function priceProviderFailure(provider, prices, issues = []) {
  return {
    success: false,
    data: { prices },
    stale: Object.keys(prices).length > 0,
    error: { code: PRICE_PROVIDER_FAILED, provider, issues }
  };
}

/**
 * @param {unknown} value
 * @returns {value is PriceEntry}
 */
export function isPriceEntry(value) {
  return (
    isRecord(value) &&
    typeof value.n === "number" &&
    Number.isFinite(value.n) &&
    typeof value.y === "number" &&
    Number.isFinite(value.y) &&
    typeof value._ts === "number" &&
    Number.isFinite(value._ts)
  );
}
