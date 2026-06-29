/**
 * Rating-tier low prices from api.fut.to (shared with fsu-core rating_prices.rs).
 */

export const LOWPRICE_URL = "https://api.fut.to/26/lowprice.json";

export function gamePlatformKey(platform) {
  return platform === "pc" ? "pc" : "ps";
}

export function parseLowpricePlatform(data, platform) {
  const entries = data?.[gamePlatformKey(platform)];
  if (!entries || typeof entries !== "object") {
    return {};
  }

  const prices = {};
  for (const [ratingKey, value] of Object.entries(entries)) {
    const rating = Number.parseInt(ratingKey, 10);
    if (!Number.isFinite(rating)) {
      continue;
    }
    prices[rating] = Number.parseInt(value, 10) || 0;
  }
  return prices;
}

export function applyLowpriceToInfo(info, data) {
  info.base.price = parseLowpricePlatform(data, info.base.platform);
}

export function resolvePriceByRating(info, rating) {
  return Number.parseInt(info.base?.price?.[rating], 10) || 0;
}

export function buildPriceByRating(info, ratings) {
  const priceByRating = {};
  for (const rating of ratings) {
    priceByRating[rating] = resolvePriceByRating(info, rating);
  }
  return priceByRating;
}