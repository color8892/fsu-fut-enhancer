export const STORE_PACK_OPEN_ERROR_CODES = Object.freeze({
  PRECONDITION: "STORE_PACK_OPEN_PRECONDITION_FAILED",
  DUPLICATE: "STORE_PACK_OPEN_IN_FLIGHT",
  REJECTED: "STORE_PACK_OPEN_REJECTED",
  TIMEOUT: "STORE_PACK_OPEN_TIMEOUT",
  INVENTORY: "STORE_PACK_OPEN_INVENTORY_INVALID"
});

/**
 * @param {string} code
 * @param {string[]} issues
 * @returns {{
 *   success: false,
 *   error: { code: string, issues: string[] }
 * }}
 */
export function storePackOpenFailure(code, issues) {
  return { success: false, error: { code, issues } };
}
