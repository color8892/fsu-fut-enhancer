/** Maximum serialized payload size (UTF-16 code units of JSON string). */
export const MAX_PAYLOAD_JSON_CHARS = 32_768;

/** Maximum full envelope JSON size. */
export const MAX_ENVELOPE_JSON_CHARS = 40_960;

export const REQUEST_ID_MIN = 8;
export const REQUEST_ID_MAX = 64;
export const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export const FORBIDDEN_KEYS = Object.freeze([
  "__proto__",
  "prototype",
  "constructor"
] as const);

export const FUT_WEB_APP_URL =
  "https://www.ea.com/ea-sports-fc/ultimate-team/web-app/" as const;
