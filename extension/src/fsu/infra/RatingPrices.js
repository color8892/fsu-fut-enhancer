/**
 * Rating-tier low prices from api.fut.to.
 */

export const LOWPRICE_URL = "https://api.fut.to/26/lowprice.json";

/** @param {string} platform */
export function gamePlatformKey(platform) {
  return platform === "pc" ? "pc" : "ps";
}

/**
 * @param {Record<string, unknown> | null | undefined} data
 * @param {string} platform
 * @returns {Record<number, number>}
 */
export function parseLowpricePlatform(data, platform) {
  const entries = data?.[gamePlatformKey(platform)];
  if (!entries || typeof entries !== "object") {
    return {};
  }

  /** @type {Record<number, number>} */
  const prices = {};
  for (const [ratingKey, value] of Object.entries(entries)) {
    const rating = Number.parseInt(ratingKey, 10);
    if (!Number.isFinite(rating)) {
      continue;
    }
    prices[rating] = Number.parseInt(String(value), 10) || 0;
  }
  return prices;
}

/**
 * @param {{ base: { platform: string, price?: Record<number, number> } }} info
 * @param {Record<string, unknown> | null | undefined} data
 */
export function applyLowpriceToInfo(info, data) {
  info.base.price = parseLowpricePlatform(data, info.base.platform);
}

/**
 * @param {{ base: { price?: Record<number, unknown> } }} info
 * @param {number} rating
 */
export function resolvePriceByRating(info, rating) {
  return Number.parseInt(String(info.base.price?.[rating] ?? ""), 10) || 0;
}

/**
 * @param {{ base: { price?: Record<number, unknown> } }} info
 * @param {Iterable<number>} ratings
 * @returns {Record<number, number>}
 */
export function buildPriceByRating(info, ratings) {
  /** @type {Record<number, number>} */
  const priceByRating = {};
  for (const rating of ratings) {
    priceByRating[rating] = resolvePriceByRating(info, rating);
  }
  return priceByRating;
}
