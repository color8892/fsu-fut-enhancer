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

export function responseText(response) {
  return response?.responseText ?? response?.response ?? "";
}
