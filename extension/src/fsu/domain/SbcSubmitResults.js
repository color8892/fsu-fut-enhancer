export const SBC_SUBMIT_ERROR_CODES = Object.freeze({
  PRECONDITION: "SBC_SUBMIT_PRECONDITION_FAILED",
  IN_FLIGHT: "SBC_SUBMIT_IN_FLIGHT",
  REJECTED: "SBC_SUBMIT_REJECTED",
  INVALID_RESPONSE: "SBC_SUBMIT_INVALID_RESPONSE"
});

/**
 * @typedef {{
 *   success: false,
 *   error: { code: string, issues: string[] }
 * }} SbcSubmitFailure
 */

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
 * @returns {SbcSubmitFailure}
 */
export function sbcSubmitFailure(code, issues) {
  return {
    success: false,
    error: { code, issues }
  };
}

/**
 * @param {unknown} response
 * @returns {{
 *   success: true,
 *   data: Record<string, unknown>
 * } | SbcSubmitFailure}
 */
export function parseSbcSubmitResponse(response) {
  if (!isRecord(response) || typeof response.success !== "boolean") {
    return sbcSubmitFailure(SBC_SUBMIT_ERROR_CODES.INVALID_RESPONSE, [
      "response.success"
    ]);
  }
  if (!response.success) {
    return sbcSubmitFailure(SBC_SUBMIT_ERROR_CODES.REJECTED, [
      "response.success"
    ]);
  }
  return { success: true, data: response };
}

/**
 * @param {unknown} response
 * @returns {{
 *   success: true,
 *   data: {
 *     response: Record<string, unknown>,
 *     setId: number,
 *     setCompleted: boolean
 *   }
 * } | SbcSubmitFailure}
 */
export function parseSbcCompletionResponse(response) {
  const submit = parseSbcSubmitResponse(response);
  if (!submit.success) return submit;
  const data = submit.data.data;
  if (
    !isRecord(data) ||
    !Number.isInteger(Number(data.setId)) ||
    Number(data.setId) <= 0
  ) {
    return sbcSubmitFailure(SBC_SUBMIT_ERROR_CODES.INVALID_RESPONSE, [
      "response.data.setId"
    ]);
  }
  return {
    success: true,
    data: {
      response: submit.data,
      setId: Number(data.setId),
      setCompleted: data.setCompleted === true
    }
  };
}
