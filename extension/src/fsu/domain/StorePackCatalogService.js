export const STORE_PACK_CATALOG_ERROR_CODES = Object.freeze({
  INVALID_INPUT: "STORE_PACK_CATALOG_INVALID_INPUT"
});

/**
 * @typedef {{
 *   article: Record<string, unknown>,
 *   id: number,
 *   tradable: boolean,
 *   isPlayers: boolean,
 *   name: string,
 *   fullName: string,
 *   value: number,
 *   coinsPrice: number,
 *   pointsPrice: number,
 *   isNew: boolean,
 *   hasPreview: boolean
 * }} StorePackSnapshot
 */

/**
 * @typedef {{
 *   packId: number,
 *   tradable: boolean,
 *   count: number,
 *   isPlayers: boolean,
 *   name: string,
 *   fullName: string,
 *   value: number
 * }} StorePackSummary
 */

/**
 * @param {boolean} left
 * @param {boolean} right
 */
function compareBooleanDesc(left, right) {
  return Number(right) - Number(left);
}

/**
 * @param {StorePackSnapshot} left
 * @param {StorePackSnapshot} right
 */
function compareStoreArticles(left, right) {
  const coinOnlyOrder = compareBooleanDesc(
    left.pointsPrice === 0 && left.coinsPrice > 0 && left.id !== 101,
    right.pointsPrice === 0 && right.coinsPrice > 0 && right.id !== 101
  );
  if (coinOnlyOrder !== 0) return coinOnlyOrder;

  const newOrder = compareBooleanDesc(left.isNew, right.isNew);
  if (newOrder !== 0) return newOrder;

  const previewOrder = compareBooleanDesc(
    left.hasPreview,
    right.hasPreview
  );
  if (previewOrder !== 0) return previewOrder;

  const leftRatio = left.value / (left.coinsPrice || 1);
  const rightRatio = right.value / (right.coinsPrice || 1);
  return rightRatio - leftRatio;
}

export class StorePackCatalogService {
  /**
   * @param {{
   *   snapshot: (
   *     article: unknown,
   *     options: {
   *       categoryId: unknown,
   *       nowSeconds: number,
   *       isMyPacks: boolean
   *     }
   *   ) => (
   *     { success: true, data: StorePackSnapshot } |
   *     { success: false, error: { code: string, issues: string[] } }
   *   )
   * }} adapter
   */
  constructor(adapter) {
    this.adapter = adapter;
  }

  /**
   * @param {unknown} articles
   * @param {{
   *   categoryId: unknown,
   *   isMyPacks: boolean,
   *   nowSeconds: number,
   *   sortDirection: unknown
   * }} options
   */
  createCatalog(
    articles,
    { categoryId, isMyPacks, nowSeconds, sortDirection }
  ) {
    if (!Array.isArray(articles)) {
      return {
        success: false,
        error: {
          code: STORE_PACK_CATALOG_ERROR_CODES.INVALID_INPUT,
          issues: ["articles"]
        }
      };
    }

    /** @type {{ snapshot: StorePackSnapshot, index: number }[]} */
    const valid = [];
    /** @type {{ article: unknown, index: number, code: string }[]} */
    const invalid = [];

    articles.forEach((article, index) => {
      let result;
      try {
        result = this.adapter.snapshot(article, {
          categoryId,
          nowSeconds,
          isMyPacks
        });
      } catch {
        invalid.push({
          article,
          index,
          code: "STORE_PACK_ARTICLE_ADAPTER_FAILED"
        });
        return;
      }
      if (result.success) {
        valid.push({ snapshot: result.data, index });
      } else {
        invalid.push({ article, index, code: result.error.code });
      }
    });

    /** @type {Record<string, StorePackSummary>} */
    const summaries = {};
    /** @type {{ snapshot: StorePackSnapshot, index: number }[]} */
    let enhanced;
    if (isMyPacks) {
      const unique = new Map();
      for (const entry of valid) {
        const snapshot = entry.snapshot;
        const key = `${snapshot.id}-${snapshot.tradable}`;
        const summary = summaries[key];
        if (summary) {
          summary.count++;
        } else {
          summaries[key] = {
            packId: snapshot.id,
            tradable: snapshot.tradable,
            count: 1,
            isPlayers: snapshot.isPlayers,
            name: snapshot.name,
            fullName: snapshot.fullName,
            value: snapshot.value
          };
          unique.set(key, entry);
        }
      }
      const direction = sortDirection === "asc" ? 1 : -1;
      enhanced = [...unique.values()].sort(
        (left, right) =>
          (left.snapshot.value - right.snapshot.value) * direction ||
          left.index - right.index
      );
    } else {
      enhanced = [...valid].sort(
        (left, right) =>
          compareStoreArticles(left.snapshot, right.snapshot) ||
          left.index - right.index
      );
    }

    return {
      success: true,
      data: {
        articles: [
          ...enhanced.map((entry) => entry.snapshot.article),
          ...invalid
            .sort((left, right) => left.index - right.index)
            .map((entry) => entry.article)
        ],
        summaries,
        articleStates: valid.map((entry) => ({
          article: entry.snapshot.article,
          isNew: entry.snapshot.isNew
        })),
        warnings: invalid.map(({ index, code }) => ({ index, code }))
      }
    };
  }
}
