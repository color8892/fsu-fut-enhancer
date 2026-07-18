/**
 * High-level request dispatch validation used by Companion and tests.
 */

import { parseHelloPayload, parseOpenFutPayload, parseProtocolRequest, parseUpdateSettingsPayload, type ParseResult } from "./schemas.js";
import type { MessageType } from "./message-types.js";
import type { ProtocolRequest } from "./types.js";
import { PROTOCOL_ERROR_CODES, protocolError } from "./errors.js";
import { PROTOCOL_VERSION } from "./protocol-version.js";

export type ValidatedRequest =
  | { type: "hello"; request: ProtocolRequest; payload: ReturnType<typeof parseHelloPayload> extends ParseResult<infer T> ? T : never }
  | { type: "get_status"; request: ProtocolRequest; payload: Record<string, never> }
  | { type: "get_settings"; request: ProtocolRequest; payload: Record<string, never> }
  | { type: "update_settings"; request: ProtocolRequest; payload: { settings: Partial<import("./settings.js").CompanionSettings> } }
  | { type: "open_fut"; request: ProtocolRequest; payload: { url?: string } }
  | { type: "get_diagnostics"; request: ProtocolRequest; payload: Record<string, never> }
  | { type: "check_update"; request: ProtocolRequest; payload: Record<string, never> };

function emptyObjectPayload(payload: unknown, label: string): ParseResult<Record<string, never>> {
  if (payload === undefined || payload === null) {
    return { ok: true, value: {} };
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return {
      ok: false,
      error: protocolError(
        PROTOCOL_ERROR_CODES.MALFORMED_PAYLOAD,
        `${label} payload must be an object`
      )
    };
  }
  const keys = Object.keys(payload as object);
  if (keys.length > 0) {
    return {
      ok: false,
      error: protocolError(
        PROTOCOL_ERROR_CODES.MALFORMED_PAYLOAD,
        `${label} payload must be empty object`,
        keys.slice(0, 10)
      )
    };
  }
  return { ok: true, value: {} };
}

export function validateAndParseRequest(input: unknown): ParseResult<ValidatedRequest> {
  const envelope = parseProtocolRequest(input);
  if (!envelope.ok) return envelope;

  const request = envelope.value;
  const type = request.type as MessageType;

  switch (type) {
    case "hello": {
      const payload = parseHelloPayload(request.payload);
      if (!payload.ok) return payload;
      return { ok: true, value: { type, request, payload: payload.value } };
    }
    case "get_status": {
      const payload = emptyObjectPayload(request.payload, "get_status");
      if (!payload.ok) return payload;
      return { ok: true, value: { type, request, payload: payload.value } };
    }
    case "get_settings": {
      const payload = emptyObjectPayload(request.payload, "get_settings");
      if (!payload.ok) return payload;
      return { ok: true, value: { type, request, payload: payload.value } };
    }
    case "update_settings": {
      const payload = parseUpdateSettingsPayload(request.payload);
      if (!payload.ok) return payload;
      return { ok: true, value: { type, request, payload: payload.value } };
    }
    case "open_fut": {
      const payload = parseOpenFutPayload(request.payload);
      if (!payload.ok) return payload;
      return { ok: true, value: { type, request, payload: payload.value } };
    }
    case "get_diagnostics": {
      const payload = emptyObjectPayload(request.payload, "get_diagnostics");
      if (!payload.ok) return payload;
      return { ok: true, value: { type, request, payload: payload.value } };
    }
    case "check_update": {
      const payload = emptyObjectPayload(request.payload, "check_update");
      if (!payload.ok) return payload;
      return { ok: true, value: { type, request, payload: payload.value } };
    }
    default: {
      // Exhaustiveness — isMessageType already filtered
      return {
        ok: false,
        error: protocolError(
          PROTOCOL_ERROR_CODES.UNKNOWN_TYPE,
          "Unknown message type"
        )
      };
    }
  }
}

export function createRequest(
  type: MessageType,
  payload: unknown,
  requestId: string,
  timestamp: number = Date.now()
): ProtocolRequest {
  return {
    protocolVersion: PROTOCOL_VERSION,
    requestId,
    type,
    payload,
    timestamp
  };
}
