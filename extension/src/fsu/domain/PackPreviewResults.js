export const PACK_PREVIEW_INVALID = "PACK_PREVIEW_INVALID";

/**
 * @param {string} provider
 * @param {string[]} issues
 */
function invalid(provider, issues) {
  return {
    success: false,
    error: {
      code: PACK_PREVIEW_INVALID,
      provider,
      issues
    }
  };
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** @param {unknown} text */
export function parsePlayerPickPreview(text) {
  if (typeof text !== "string" || text.length > 5 * 1024 * 1024) {
    return invalid("futnext-playerpick", ["response"]);
  }
  const ids = [
    ...text.matchAll(/https:\/\/cdn\.futnext\.com\/player\/(\d+)\.png/g)
  ].map((match) => Number(match[1]));
  const unique = [...new Set(ids)].filter(
    (id) => Number.isInteger(id) && id > 0
  );
  return unique.length
    ? { success: true, data: unique }
    : invalid("futnext-playerpick", ["player ids"]);
}

/** @param {unknown} text */
export function parsePackPreview(text) {
  if (typeof text !== "string" || text.length > 5 * 1024 * 1024) {
    return invalid("futnext-pack", ["response"]);
  }
  const start = text.indexOf("packItem");
  const end = text.indexOf('"renderItemByDefault', start);
  if (start < 0 || end <= start) {
    return invalid("futnext-pack", ["packItem markers"]);
  }
  try {
    const raw = `{"${text
      .slice(start, end)
      .replace(/\\/g, "")}}`.replace(/,\}/g, "}");
    const parsed = JSON.parse(raw);
    if (
      !isRecord(parsed.packItem) ||
      !Array.isArray(parsed.packItem.items) ||
      parsed.packItem.items.length > 200 ||
      !isRecord(parsed.packItem.pack)
    ) {
      return invalid("futnext-pack", ["packItem shape"]);
    }
    return { success: true, data: parsed };
  } catch {
    return invalid("futnext-pack", ["json"]);
  }
}

/** @param {unknown} text */
export function parsePackProbability(text) {
  if (typeof text !== "string" || text.length > 5 * 1024 * 1024) {
    return invalid("futnext-probability", ["response"]);
  }
  const start = text.indexOf('"rarityOdds');
  const end = text.indexOf('},\\"returns', start);
  if (start < 0 || end <= start) {
    return invalid("futnext-probability", ["probability markers"]);
  }
  try {
    const parsed = JSON.parse(
      `{${text.slice(start, end).replace(/\\/g, "")}}`
    );
    if (
      !Array.isArray(parsed.rarityOdds) ||
      !Array.isArray(parsed.ratingOdds) ||
      parsed.rarityOdds.length > 200 ||
      parsed.ratingOdds.length > 200
    ) {
      return invalid("futnext-probability", ["probability shape"]);
    }
    const rarity = /** @type {unknown[]} */ (parsed.rarityOdds).map(
      (entry, index) => {
        if (
          !isRecord(entry) ||
          !isRecord(entry.rarity) ||
          !Number.isInteger(entry.rarity.id) ||
          typeof entry.odds !== "number" ||
          !Number.isFinite(entry.odds) ||
          entry.odds <= 0 ||
          entry.odds > 1
        ) {
          throw new Error(`rarityOdds.${index}`);
        }
        return { id: entry.rarity.id, odds: entry.odds };
      }
    );
    const rating = /** @type {unknown[]} */ (parsed.ratingOdds).map(
      (entry, index) => {
        if (
          !isRecord(entry) ||
          !Number.isInteger(entry.rating) ||
          typeof entry.odds !== "number" ||
          !Number.isFinite(entry.odds) ||
          entry.odds <= 0 ||
          entry.odds > 1
        ) {
          throw new Error(`ratingOdds.${index}`);
        }
        return { rating: entry.rating, odds: entry.odds };
      }
    );
    return { success: true, data: { rarity, rating } };
  } catch {
    return invalid("futnext-probability", ["probability entries"]);
  }
}
