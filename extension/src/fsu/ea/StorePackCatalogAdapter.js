export const STORE_PACK_ARTICLE_ERROR_CODES = Object.freeze({
  INVALID: "STORE_PACK_ARTICLE_INVALID",
  CAPABILITY: "STORE_PACK_ARTICLE_CAPABILITY_UNAVAILABLE"
});

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return value !== null && typeof value === "object";
}

/**
 * @param {string} code
 * @param {string[]} issues
 */
function failure(code, issues) {
  return { success: false, error: { code, issues } };
}

/**
 * EA has used both singular and plural values for player-only pack content.
 * @param {unknown} value
 */
export function isPlayerPackContentType(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  return ["player", "players", "playeritem", "playeritems"].includes(
    normalized
  );
}

export class StorePackCatalogAdapter {
  /**
   * @param {{
   *   coinsCurrency: unknown,
   *   pointsCurrency: unknown,
   *   localize: (key: string) => unknown,
   *   getPackValue: (id: number) => unknown,
   *   truncate: (text: string) => string
   * }} options
   */
  constructor({
    coinsCurrency,
    pointsCurrency,
    localize,
    getPackValue,
    truncate
  }) {
    this.coinsCurrency = coinsCurrency;
    this.pointsCurrency = pointsCurrency;
    this.localize = localize;
    this.getPackValue = getPackValue;
    this.truncate = truncate;
  }

  /**
   * @param {unknown} article
   * @param {{ categoryId: unknown, nowSeconds: number, isMyPacks: boolean }} options
   */
  snapshot(article, { categoryId, nowSeconds, isMyPacks }) {
    if (!isRecord(article)) {
      return failure(STORE_PACK_ARTICLE_ERROR_CODES.INVALID, ["article"]);
    }

    const id = article.id;
    const tradable = article.tradable;
    const packName = article.packName;
    const contentType = article.contentType;
    if (
      !Number.isInteger(id) ||
      Number(id) <= 0 ||
      typeof tradable !== "boolean" ||
      typeof packName !== "string" ||
      typeof contentType !== "string"
    ) {
      return failure(STORE_PACK_ARTICLE_ERROR_CODES.INVALID, [
        "article.id",
        "article.tradable",
        "article.packName",
        "article.contentType"
      ]);
    }

    let value;
    let localizedName;
    try {
      value = Number(this.getPackValue(Number(id)));
      localizedName = this.localize(packName);
    } catch {
      return failure(STORE_PACK_ARTICLE_ERROR_CODES.CAPABILITY, [
        "store.pack-value",
        "store.localization"
      ]);
    }
    if (typeof localizedName !== "string") {
      return failure(STORE_PACK_ARTICLE_ERROR_CODES.INVALID, [
        "article.localizedName"
      ]);
    }
    if (!Number.isFinite(value) || value < 0) {
      if (isMyPacks) {
        // Pack-return data is optional for owned packs. The original feature
        // still grouped and opened new/unknown packs before an estimate
        // became available.
        value = 0;
      } else {
        return failure(STORE_PACK_ARTICLE_ERROR_CODES.INVALID, [
          "article.value"
        ]);
      }
    }

    let coinsPrice = 0;
    let pointsPrice = 0;
    if (!isMyPacks) {
      if (
        this.coinsCurrency === undefined ||
        this.pointsCurrency === undefined ||
        typeof article.getPrice !== "function"
      ) {
        return failure(STORE_PACK_ARTICLE_ERROR_CODES.CAPABILITY, [
          "GameCurrency.COINS",
          "GameCurrency.POINTS",
          "article.getPrice"
        ]);
      }
      try {
        coinsPrice = Number(article.getPrice(this.coinsCurrency)) || 0;
        pointsPrice = Number(article.getPrice(this.pointsCurrency)) || 0;
      } catch {
        return failure(STORE_PACK_ARTICLE_ERROR_CODES.CAPABILITY, [
          "article.getPrice"
        ]);
      }
      if (
        !Number.isFinite(coinsPrice) ||
        coinsPrice < 0 ||
        !Number.isFinite(pointsPrice) ||
        pointsPrice < 0
      ) {
        return failure(STORE_PACK_ARTICLE_ERROR_CODES.INVALID, [
          "article.price"
        ]);
      }
    }

    const start = Number(article.start);
    const isNew =
      Number.isFinite(start) &&
      start > 0 &&
      nowSeconds - start <= 86_400 &&
      Number(categoryId) !== 3;
    const fullName = tradable ? `*${localizedName}` : localizedName;
    let name;
    try {
      name = this.truncate(fullName);
    } catch {
      return failure(STORE_PACK_ARTICLE_ERROR_CODES.CAPABILITY, [
        "store.pack-name-truncate"
      ]);
    }
    if (typeof name !== "string") {
      return failure(STORE_PACK_ARTICLE_ERROR_CODES.INVALID, [
        "article.displayName"
      ]);
    }

    return {
      success: true,
      data: {
        article,
        id: Number(id),
        tradable,
        isPlayers: isPlayerPackContentType(contentType),
        name,
        fullName,
        value,
        coinsPrice,
        pointsPrice,
        isNew,
        hasPreview: Object.prototype.hasOwnProperty.call(
          article,
          "previewCreateTime"
        )
      }
    };
  }
}
