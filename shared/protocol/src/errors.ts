export const PROTOCOL_ERROR_CODES = Object.freeze({
  INVALID_ENVELOPE: "PROTOCOL_INVALID_ENVELOPE",
  UNKNOWN_TYPE: "PROTOCOL_UNKNOWN_TYPE",
  VERSION_MISMATCH: "PROTOCOL_VERSION_MISMATCH",
  MALFORMED_PAYLOAD: "PROTOCOL_MALFORMED_PAYLOAD",
  OVERSIZED_PAYLOAD: "PROTOCOL_OVERSIZED_PAYLOAD",
  FORBIDDEN_KEY: "PROTOCOL_FORBIDDEN_KEY",
  UNKNOWN_SETTING: "PROTOCOL_UNKNOWN_SETTING",
  INVALID_REQUEST_ID: "PROTOCOL_INVALID_REQUEST_ID",
  INVALID_TIMESTAMP: "PROTOCOL_INVALID_TIMESTAMP",
  DISCONNECTED: "PROTOCOL_DISCONNECTED",
  INTERNAL: "PROTOCOL_INTERNAL"
} as const);

export type ProtocolErrorCode =
  (typeof PROTOCOL_ERROR_CODES)[keyof typeof PROTOCOL_ERROR_CODES];

export type ProtocolError = {
  code: ProtocolErrorCode;
  message: string;
  issues?: string[];
};

export function protocolError(
  code: ProtocolErrorCode,
  message: string,
  issues?: string[]
): ProtocolError {
  const error: ProtocolError = { code, message };
  if (issues && issues.length > 0) {
    error.issues = issues.slice(0, 20);
  }
  return error;
}
