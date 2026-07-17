export const SBC_SAVE_ERROR_CODES = Object.freeze({
  PRECONDITION: "SBC_SAVE_PRECONDITION_FAILED",
  REJECTED: "SBC_SAVE_REJECTED",
  INVALID_RESPONSE: "SBC_SAVE_INVALID_RESPONSE"
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
 * @param {"precondition" | "save" | "load"} stage
 * @param {string[]} issues
 */
export function sbcSaveFailure(code, stage, issues) {
  return {
    success: false,
    error: { code, stage, issues }
  };
}

/**
 * @param {unknown} response
 */
export function parseSbcSaveResponse(response) {
  if (!isRecord(response) || typeof response.success !== "boolean") {
    return sbcSaveFailure(
      SBC_SAVE_ERROR_CODES.INVALID_RESPONSE,
      "save",
      ["response.success"]
    );
  }
  return response.success
    ? { success: true, data: response }
    : sbcSaveFailure(SBC_SAVE_ERROR_CODES.REJECTED, "save", [
        "response.success"
      ]);
}

/**
 * @param {unknown} response
 */
export function parseSbcLoadedSquad(response) {
  if (
    !isRecord(response) ||
    !isRecord(response.response) ||
    !isRecord(response.response.squad) ||
    !Array.isArray(response.response.squad._players)
  ) {
    return sbcSaveFailure(
      SBC_SAVE_ERROR_CODES.INVALID_RESPONSE,
      "load",
      ["response.squad.players"]
    );
  }
  const loadedSquad = response.response.squad;
  const loadedSlots = loadedSquad._players;
  if (!Array.isArray(loadedSlots)) {
    return sbcSaveFailure(
      SBC_SAVE_ERROR_CODES.INVALID_RESPONSE,
      "load",
      ["response.squad.players"]
    );
  }
  const players = [];
  for (const [index, slot] of loadedSlots.entries()) {
    if (!isRecord(slot) || !("_item" in slot)) {
      return sbcSaveFailure(
        SBC_SAVE_ERROR_CODES.INVALID_RESPONSE,
        "load",
        [`response.squad.players[${index}]`]
      );
    }
    players.push(slot._item);
  }
  return {
    success: true,
    data: { loadedSquad, players }
  };
}
