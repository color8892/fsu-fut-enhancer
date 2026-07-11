/**
 * @template T
 * @param {unknown} rawValue
 * @param {T} fallback
 * @param {{ label?: string, onError?: (error: unknown, context: { label: string, rawValue: unknown }) => void }} [options]
 * @returns {T}
 */
export function safeParseJson(rawValue, fallback, options = {}) {
  const { label = "JSON", onError } = options;

  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return fallback;
  }

  try {
    return JSON.parse(String(rawValue));
  } catch (error) {
    if (typeof onError === "function") {
      onError(error, { label, rawValue });
    }
    return fallback;
  }
}

/**
 * @param {{ responseText?: unknown, response?: unknown } | null | undefined} response
 * @returns {unknown}
 */
export function responseText(response) {
  return response?.responseText ?? response?.response ?? "";
}

/**
 * @template T
 * @param {T} value
 * @returns {T | undefined}
 */
export function cloneJson(value) {
  const serialized = JSON.stringify(value);
  return serialized === undefined ? undefined : JSON.parse(serialized);
}
