export const MARKET_RESULT_INVALID = "MARKET_RESULT_INVALID";

/**
 * @typedef {{
 *   code: typeof MARKET_RESULT_INVALID,
 *   operation: string,
 *   issues: string[]
 * }} MarketContractError
 */

/**
 * @typedef {{
 *   success: boolean,
 *   data: { auctions: Record<string, unknown>[] },
 *   error?: Record<string, unknown> | MarketContractError
 * }} AuctionLookupResult
 */

/**
 * @typedef {{
 *   success: boolean,
 *   data: { items: unknown[] },
 *   error?: Record<string, unknown> | MarketContractError
 * }} MarketSearchResult
 */

/**
 * @typedef {{
 *   success: boolean,
 *   purchased: boolean,
 *   price: number | null,
 *   reason: string | null,
 *   permissionDenied: boolean,
 *   error?: Record<string, unknown> | MarketContractError
 * }} MarketPurchaseResult
 */

/**
 * @typedef {{
 *   success: boolean,
 *   error?: Record<string, unknown> | MarketContractError
 * }} MarketListingResult
 */

/**
 * @typedef {{ price: number, count: number }} AuctionPriceRow
 */

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {string} operation
 * @param {string[]} issues
 * @returns {MarketContractError}
 */
function invalidError(operation, issues) {
  return {
    code: MARKET_RESULT_INVALID,
    operation,
    issues
  };
}

/**
 * @param {unknown} value
 * @returns {AuctionLookupResult}
 */
export function normalizeAuctionLookupResult(value) {
  if (!isRecord(value) || !Array.isArray(value.auctionInfo)) {
    return {
      success: false,
      data: { auctions: [] },
      error: invalidError("auction-lookup", ["auctionInfo must be an array"])
    };
  }

  const auctions = [];
  for (const auction of value.auctionInfo) {
    if (
      !isRecord(auction) ||
      !Number.isFinite(auction.buyNowPrice) ||
      Number(auction.buyNowPrice) < 0
    ) {
      return {
        success: false,
        data: { auctions: [] },
        error: invalidError("auction-lookup", [
          "every auction must have a non-negative numeric buyNowPrice"
        ])
      };
    }
    auctions.push(auction);
  }

  return { success: true, data: { auctions } };
}

/**
 * @param {unknown} value
 * @returns {MarketSearchResult}
 */
export function normalizeMarketSearchResult(value) {
  if (!isRecord(value) || typeof value.success !== "boolean") {
    return {
      success: false,
      data: { items: [] },
      error: invalidError("market-search", ["success must be a boolean"])
    };
  }

  if (!value.success) {
    if (!isRecord(value.error)) {
      return {
        success: false,
        data: { items: [] },
        error: invalidError("market-search", ["failed result must include an error object"])
      };
    }
    return { success: false, data: { items: [] }, error: value.error };
  }

  if (!isRecord(value.data) || !Array.isArray(value.data.items)) {
    return {
      success: false,
      data: { items: [] },
      error: invalidError("market-search", ["successful result data.items must be an array"])
    };
  }

  return { success: true, data: { items: value.data.items } };
}

/**
 * @param {unknown} value
 * @returns {MarketPurchaseResult}
 */
export function normalizeMarketPurchaseResult(value) {
  if (!isRecord(value) || typeof value.success !== "boolean") {
    return {
      success: false,
      purchased: false,
      price: null,
      reason: "invalid-result",
      permissionDenied: false,
      error: invalidError("market-purchase", ["success must be a boolean"])
    };
  }

  const purchased = value.purchased === true || value.success;
  const price = Number.isFinite(value.price) ? Number(value.price) : null;
  const reason = typeof value.reason === "string" ? value.reason : null;
  const permissionDenied = value.permissionDenied === true;
  const error = isRecord(value.error) ? value.error : undefined;

  if (!value.success && reason === null && !error) {
    return {
      success: false,
      purchased,
      price,
      reason: "invalid-result",
      permissionDenied,
      error: invalidError("market-purchase", [
        "failed result must include a reason or error object"
      ])
    };
  }

  return {
    success: value.success,
    purchased,
    price,
    reason,
    permissionDenied,
    ...(error ? { error } : {})
  };
}

/**
 * @param {unknown} value
 * @returns {MarketListingResult}
 */
export function normalizeMarketListingResult(value) {
  if (!isRecord(value) || typeof value.success !== "boolean") {
    return {
      success: false,
      error: invalidError("market-listing", ["success must be a boolean"])
    };
  }

  const isKnownEaFailure =
    typeof value.critical === "boolean" &&
    (typeof value.code === "string" || typeof value.code === "number");
  if (!value.success && !isRecord(value.error) && !isKnownEaFailure) {
    return {
      success: false,
      error: invalidError("market-listing", ["failed result must include an error object"])
    };
  }

  return {
    success: value.success,
    ...(isRecord(value.error) ? { error: value.error } : {})
  };
}

/**
 * Preserve the former Lodash/object-key ordering: numeric prices are displayed
 * from lowest to highest, with at most three rows.
 *
 * @param {number[]} prices
 * @param {number} [limit]
 * @returns {AuctionPriceRow[]}
 */
export function summarizeAuctionPrices(prices, limit = 3) {
  const counts = new Map();
  for (const price of prices) {
    if (!Number.isFinite(price)) continue;
    counts.set(price, (counts.get(price) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([left], [right]) => left - right)
    .slice(0, Math.max(0, limit))
    .map(([price, count]) => ({ price, count }));
}
