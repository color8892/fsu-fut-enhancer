export const IN_PACKS_SEARCH_ERROR_CODES = Object.freeze({
  INVALID_INPUT: "IN_PACKS_SEARCH_INVALID_INPUT",
  INVALID_RESPONSE: "IN_PACKS_SEARCH_INVALID_RESPONSE",
  REJECTED: "IN_PACKS_SEARCH_REJECTED",
  CANCELLED: "IN_PACKS_SEARCH_CANCELLED",
  MAX_PAGES: "IN_PACKS_SEARCH_MAX_PAGES"
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
 * @param {{ items?: Record<string, unknown>[], pagesCompleted?: number }} [partial]
 * @returns {{
 *   success: false,
 *   error: { code: string, issues: string[] },
 *   partial: { items: Record<string, unknown>[], pagesCompleted: number }
 * }}
 */
export function inPacksSearchFailure(code, issues, partial = {}) {
  return {
    success: false,
    error: { code, issues },
    partial: {
      items: partial.items ? [...partial.items] : [],
      pagesCompleted: partial.pagesCompleted ?? 0
    }
  };
}

/**
 * @param {unknown} response
 * @returns {{
 *   success: true,
 *   data: { items: Record<string, unknown>[] }
 * } | {
 *   success: false,
 *   error: { code: string, issues: string[] },
 *   partial: { items: Record<string, unknown>[], pagesCompleted: number }
 * }}
 */
export function parseInPacksConceptPage(response) {
  if (!isRecord(response) || typeof response.success !== "boolean") {
    return inPacksSearchFailure(
      IN_PACKS_SEARCH_ERROR_CODES.INVALID_RESPONSE,
      ["response.success"]
    );
  }
  if (!response.success) {
    return inPacksSearchFailure(IN_PACKS_SEARCH_ERROR_CODES.REJECTED, [
      "response.success"
    ]);
  }
  if (
    !isRecord(response.response) ||
    !Array.isArray(response.response.items)
  ) {
    return inPacksSearchFailure(
      IN_PACKS_SEARCH_ERROR_CODES.INVALID_RESPONSE,
      ["response.response.items"]
    );
  }
  const items = [];
  for (const item of response.response.items) {
    if (
      !isRecord(item) ||
      !Number.isInteger(item.definitionId) ||
      Number(item.definitionId) <= 0
    ) {
      return inPacksSearchFailure(
        IN_PACKS_SEARCH_ERROR_CODES.INVALID_RESPONSE,
        ["response.response.items.definitionId"]
      );
    }
    items.push(item);
  }
  return { success: true, data: { items } };
}
