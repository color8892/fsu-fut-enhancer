import assert from "node:assert/strict";
import {
  MARKET_RESULT_INVALID,
  normalizeAuctionLookupResult,
  normalizeMarketListingResult,
  normalizeMarketPurchaseResult,
  normalizeMarketSearchResult,
  summarizeAuctionPrices
} from "../src/fsu/domain/MarketResults.js";

export function runMarketResultTests() {
  assert.deepEqual(
    normalizeAuctionLookupResult({
      auctionInfo: [{ buyNowPrice: 1200, tradeId: 1 }]
    }),
    {
      success: true,
      data: { auctions: [{ buyNowPrice: 1200, tradeId: 1 }] }
    }
  );

  const malformedAuction = normalizeAuctionLookupResult({
    auctionInfo: [{ buyNowPrice: "1200" }]
  });
  assert.equal(malformedAuction.success, false);
  assert.equal(malformedAuction.error?.code, MARKET_RESULT_INVALID);
  assert.deepEqual(malformedAuction.data.auctions, []);

  assert.deepEqual(
    normalizeMarketSearchResult({
      success: true,
      data: { items: [{ id: 7 }] }
    }),
    {
      success: true,
      data: { items: [{ id: 7 }] }
    }
  );

  const malformedSearch = normalizeMarketSearchResult({
    success: true,
    data: { items: "not-an-array" }
  });
  assert.equal(malformedSearch.success, false);
  assert.equal(malformedSearch.error?.code, MARKET_RESULT_INVALID);

  assert.deepEqual(
    normalizeMarketPurchaseResult({
      success: false,
      purchased: true,
      price: 1500,
      reason: "move-failed"
    }),
    {
      success: false,
      purchased: true,
      price: 1500,
      reason: "move-failed",
      permissionDenied: false
    }
  );

  const malformedPurchase = normalizeMarketPurchaseResult({ purchased: true });
  assert.equal(malformedPurchase.success, false);
  assert.equal(malformedPurchase.purchased, false);
  assert.equal(malformedPurchase.error?.code, MARKET_RESULT_INVALID);

  assert.deepEqual(
    normalizeMarketListingResult({
      success: false,
      critical: false,
      code: 403,
      messageKey: "popup.error.list.forbidden.message"
    }),
    { success: false }
  );

  const malformedListing = normalizeMarketListingResult({ success: false });
  assert.equal(malformedListing.success, false);
  assert.equal(malformedListing.error?.code, MARKET_RESULT_INVALID);

  assert.deepEqual(summarizeAuctionPrices([1300, 1100, 1300, 1200, 1400]), [
    { price: 1100, count: 1 },
    { price: 1200, count: 1 },
    { price: 1300, count: 2 }
  ]);
}
