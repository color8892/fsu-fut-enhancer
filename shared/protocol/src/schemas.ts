/**
 * Structural schema helpers for protocol payloads.
 * Validation is explicit field checking — not ad hoc free-text matching of full messages.
 */

import { isMessageType, type MessageType } from "./message-types.js";
import {
  FORBIDDEN_KEYS,
  MAX_ENVELOPE_JSON_CHARS,
  MAX_PAYLOAD_JSON_CHARS,
  REQUEST_ID_MAX,
  REQUEST_ID_MIN,
  REQUEST_ID_PATTERN
} from "./limits.js";
import {
  isCompatibleProtocolVersion,
  PROTOCOL_VERSION
} from "./protocol-version.js";
import {
  PROTOCOL_ERROR_CODES,
  protocolError,
  type ProtocolError
} from "./errors.js";
import {
  defaultSettings,
  isSettingsKey,
  SETTINGS_ALLOWLIST,
  type CompanionSettings,
  type SettingsKey
} from "./settings.js";
import type {
  CheckUpdateResult,
  DiagnosticsResult,
  HelloPayload,
  HelloResult,
  OpenFutPayload,
  OpenFutResult,
  ProtocolRequest,
  ProtocolResponse,
  SettingsResult,
  StatusResult,
  UpdateSettingsPayload
} from "./types.js";

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ProtocolError };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasForbiddenKey(record: Record<string, unknown>): string | null {
  for (const key of Object.keys(record)) {
    if ((FORBIDDEN_KEYS as readonly string[]).includes(key)) {
      return key;
    }
  }
  return null;
}

function assertSafeKeys(
  record: Record<string, unknown>,
  path: string
): ParseResult<true> {
  const forbidden = hasForbiddenKey(record);
  if (forbidden) {
    return {
      ok: false,
      error: protocolError(
        PROTOCOL_ERROR_CODES.FORBIDDEN_KEY,
        `Forbidden key at ${path}`,
        [`${path}.${forbidden}`]
      )
    };
  }
  return { ok: true, value: true };
}

function assertExactKeys(
  record: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  code: ProtocolError["code"]
): ParseResult<true> {
  const unknown = Object.keys(record).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    return {
      ok: false,
      error: protocolError(
        code,
        `Unknown field at ${path}`,
        unknown.slice(0, 10).map((key) => `${path}.${key}`)
      )
    };
  }
  return { ok: true, value: true };
}

function measureJsonSize(value: unknown): number {
  try {
    return JSON.stringify(value)?.length ?? Number.POSITIVE_INFINITY;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export function parseRequestId(value: unknown): ParseResult<string> {
  if (typeof value !== "string") {
    return {
      ok: false,
      error: protocolError(
        PROTOCOL_ERROR_CODES.INVALID_REQUEST_ID,
        "requestId must be a string"
      )
    };
  }
  if (value.length < REQUEST_ID_MIN || value.length > REQUEST_ID_MAX) {
    return {
      ok: false,
      error: protocolError(
        PROTOCOL_ERROR_CODES.INVALID_REQUEST_ID,
        "requestId length out of range"
      )
    };
  }
  if (!REQUEST_ID_PATTERN.test(value)) {
    return {
      ok: false,
      error: protocolError(
        PROTOCOL_ERROR_CODES.INVALID_REQUEST_ID,
        "requestId has invalid characters"
      )
    };
  }
  return { ok: true, value };
}

export function parseTimestamp(value: unknown): ParseResult<number> {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return {
      ok: false,
      error: protocolError(
        PROTOCOL_ERROR_CODES.INVALID_TIMESTAMP,
        "timestamp must be a finite number"
      )
    };
  }
  // Reasonable bounds: 2000-01-01 .. 2100-01-01 in ms
  if (value < 946_684_800_000 || value > 4_102_444_800_000) {
    return {
      ok: false,
      error: protocolError(
        PROTOCOL_ERROR_CODES.INVALID_TIMESTAMP,
        "timestamp out of accepted range"
      )
    };
  }
  return { ok: true, value };
}

export function parseProtocolRequest(input: unknown): ParseResult<ProtocolRequest> {
  if (input === null || input === undefined) {
    return {
      ok: false,
      error: protocolError(
        PROTOCOL_ERROR_CODES.INVALID_ENVELOPE,
        "request must be an object"
      )
    };
  }

  const envelopeSize = measureJsonSize(input);
  if (envelopeSize > MAX_ENVELOPE_JSON_CHARS) {
    return {
      ok: false,
      error: protocolError(
        PROTOCOL_ERROR_CODES.OVERSIZED_PAYLOAD,
        "envelope exceeds size limit"
      )
    };
  }

  if (!isRecord(input)) {
    return {
      ok: false,
      error: protocolError(
        PROTOCOL_ERROR_CODES.INVALID_ENVELOPE,
        "request must be an object"
      )
    };
  }

  const keysOk = assertSafeKeys(input, "request");
  if (!keysOk.ok) return keysOk;
  const exactKeys = assertExactKeys(
    input,
    ["protocolVersion", "requestId", "type", "payload", "timestamp"],
    "request",
    PROTOCOL_ERROR_CODES.INVALID_ENVELOPE
  );
  if (!exactKeys.ok) return exactKeys;

  const version = input.protocolVersion;
  if (typeof version !== "string") {
    return {
      ok: false,
      error: protocolError(
        PROTOCOL_ERROR_CODES.INVALID_ENVELOPE,
        "protocolVersion required"
      )
    };
  }
  if (!isCompatibleProtocolVersion(version)) {
    return {
      ok: false,
      error: protocolError(
        PROTOCOL_ERROR_CODES.VERSION_MISMATCH,
        `Incompatible protocolVersion: ${version}`,
        [version]
      )
    };
  }

  const requestId = parseRequestId(input.requestId);
  if (!requestId.ok) return requestId;

  const typeRaw = input.type;
  if (typeof typeRaw !== "string") {
    return {
      ok: false,
      error: protocolError(
        PROTOCOL_ERROR_CODES.INVALID_ENVELOPE,
        "type must be a string"
      )
    };
  }
  if (!isMessageType(typeRaw)) {
    return {
      ok: false,
      error: protocolError(
        PROTOCOL_ERROR_CODES.UNKNOWN_TYPE,
        `Unknown message type: ${typeRaw}`,
        [typeRaw]
      )
    };
  }

  const timestamp = parseTimestamp(input.timestamp);
  if (!timestamp.ok) return timestamp;

  if (!("payload" in input)) {
    return {
      ok: false,
      error: protocolError(
        PROTOCOL_ERROR_CODES.MALFORMED_PAYLOAD,
        "payload is required"
      )
    };
  }

  const payloadSize = measureJsonSize(input.payload);
  if (payloadSize > MAX_PAYLOAD_JSON_CHARS) {
    return {
      ok: false,
      error: protocolError(
        PROTOCOL_ERROR_CODES.OVERSIZED_PAYLOAD,
        "payload exceeds size limit"
      )
    };
  }

  if (isRecord(input.payload)) {
    const payloadKeys = assertSafeKeys(input.payload, "payload");
    if (!payloadKeys.ok) return payloadKeys;
  }

  return {
    ok: true,
    value: {
      protocolVersion: version,
      requestId: requestId.value,
      type: typeRaw,
      payload: input.payload,
      timestamp: timestamp.value
    }
  };
}

export function parseHelloPayload(payload: unknown): ParseResult<HelloPayload> {
  if (!isRecord(payload)) {
    return {
      ok: false,
      error: protocolError(
        PROTOCOL_ERROR_CODES.MALFORMED_PAYLOAD,
        "hello payload must be an object"
      )
    };
  }
  const keysOk = assertSafeKeys(payload, "hello");
  if (!keysOk.ok) return keysOk;
  const exactKeys = assertExactKeys(
    payload,
    ["client", "clientVersion"],
    "hello",
    PROTOCOL_ERROR_CODES.MALFORMED_PAYLOAD
  );
  if (!exactKeys.ok) return exactKeys;

  const client = payload.client;
  const clientVersion = payload.clientVersion;
  if (
    client !== "companion" &&
    client !== "extension" &&
    client !== "test"
  ) {
    return {
      ok: false,
      error: protocolError(
        PROTOCOL_ERROR_CODES.MALFORMED_PAYLOAD,
        "hello.client invalid"
      )
    };
  }
  if (
    typeof clientVersion !== "string" ||
    clientVersion.length < 1 ||
    clientVersion.length > 64 ||
    !/^[A-Za-z0-9._+-]+$/.test(clientVersion)
  ) {
    return {
      ok: false,
      error: protocolError(
        PROTOCOL_ERROR_CODES.MALFORMED_PAYLOAD,
        "hello.clientVersion invalid"
      )
    };
  }
  return { ok: true, value: { client, clientVersion } };
}

export function parseOpenFutPayload(payload: unknown): ParseResult<OpenFutPayload> {
  if (payload === undefined || payload === null) {
    return { ok: true, value: {} };
  }
  if (!isRecord(payload)) {
    return {
      ok: false,
      error: protocolError(
        PROTOCOL_ERROR_CODES.MALFORMED_PAYLOAD,
        "open_fut payload must be an object"
      )
    };
  }
  const keysOk = assertSafeKeys(payload, "open_fut");
  if (!keysOk.ok) return keysOk;
  const exactKeys = assertExactKeys(
    payload,
    ["url"],
    "open_fut",
    PROTOCOL_ERROR_CODES.MALFORMED_PAYLOAD
  );
  if (!exactKeys.ok) return exactKeys;

  if (payload.url === undefined) {
    return { ok: true, value: {} };
  }
  if (typeof payload.url !== "string" || payload.url.length > 512) {
    return {
      ok: false,
      error: protocolError(
        PROTOCOL_ERROR_CODES.MALFORMED_PAYLOAD,
        "open_fut.url invalid"
      )
    };
  }
  let parsed: URL;
  try {
    parsed = new URL(payload.url);
  } catch {
    return {
      ok: false,
      error: protocolError(
        PROTOCOL_ERROR_CODES.MALFORMED_PAYLOAD,
        "open_fut.url not a URL"
      )
    };
  }
  if (parsed.protocol !== "https:") {
    return {
      ok: false,
      error: protocolError(
        PROTOCOL_ERROR_CODES.MALFORMED_PAYLOAD,
        "open_fut.url must be https"
      )
    };
  }
  if (
    parsed.hostname !== "www.ea.com" &&
    parsed.hostname !== "www.easports.com"
  ) {
    return {
      ok: false,
      error: protocolError(
        PROTOCOL_ERROR_CODES.MALFORMED_PAYLOAD,
        "open_fut.url host not allowlisted"
      )
    };
  }
  if (!isFutWebAppPath(parsed.pathname)) {
    return {
      ok: false,
      error: protocolError(
        PROTOCOL_ERROR_CODES.MALFORMED_PAYLOAD,
        "open_fut.url path must be FUT web app"
      )
    };
  }
  return { ok: true, value: { url: parsed.href } };
}

function isFutWebAppPath(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  const appSegments = ["ea-sports-fc", "ultimate-team", "web-app"];
  const startsWithApp = appSegments.every(
    (segment, index) => segments[index] === segment
  );
  if (startsWithApp) return true;

  const locale = segments[0];
  return (
    typeof locale === "string" &&
    locale.length <= 16 &&
    /^[A-Za-z0-9-]+$/.test(locale) &&
    appSegments.every((segment, index) => segments[index + 1] === segment)
  );
}

function parseSettingValue(
  key: SettingsKey,
  value: unknown
): ParseResult<CompanionSettings[SettingsKey]> {
  const spec = SETTINGS_ALLOWLIST[key];
  if (spec.type === "boolean") {
    if (typeof value !== "boolean") {
      return {
        ok: false,
        error: protocolError(
          PROTOCOL_ERROR_CODES.MALFORMED_PAYLOAD,
          `settings.${key} must be boolean`
        )
      };
    }
    return { ok: true, value };
  }
  if (spec.type === "enum") {
    if (typeof value !== "string" || !(spec.values as readonly string[]).includes(value)) {
      return {
        ok: false,
        error: protocolError(
          PROTOCOL_ERROR_CODES.MALFORMED_PAYLOAD,
          `settings.${key} invalid enum`
        )
      };
    }
    return { ok: true, value: value as CompanionSettings[SettingsKey] };
  }
  // string
  if (typeof value !== "string" || value.length > spec.maxLength) {
    return {
      ok: false,
      error: protocolError(
        PROTOCOL_ERROR_CODES.MALFORMED_PAYLOAD,
        `settings.${key} invalid string`
      )
    };
  }
  if (!spec.pattern.test(value)) {
    return {
      ok: false,
      error: protocolError(
        PROTOCOL_ERROR_CODES.MALFORMED_PAYLOAD,
        `settings.${key} charset`
      )
    };
  }
  return { ok: true, value };
}

/**
 * Atomic settings update: every key must be allowlisted and valid,
 * or the entire update is rejected.
 */
export function parseUpdateSettingsPayload(
  payload: unknown
): ParseResult<UpdateSettingsPayload> {
  if (!isRecord(payload)) {
    return {
      ok: false,
      error: protocolError(
        PROTOCOL_ERROR_CODES.MALFORMED_PAYLOAD,
        "update_settings payload must be an object"
      )
    };
  }
  const keysOk = assertSafeKeys(payload, "update_settings");
  if (!keysOk.ok) return keysOk;
  const exactKeys = assertExactKeys(
    payload,
    ["settings"],
    "update_settings",
    PROTOCOL_ERROR_CODES.MALFORMED_PAYLOAD
  );
  if (!exactKeys.ok) return exactKeys;

  if (!isRecord(payload.settings)) {
    return {
      ok: false,
      error: protocolError(
        PROTOCOL_ERROR_CODES.MALFORMED_PAYLOAD,
        "settings must be an object"
      )
    };
  }
  const settingsKeysOk = assertSafeKeys(payload.settings, "settings");
  if (!settingsKeysOk.ok) return settingsKeysOk;

  const entries = Object.entries(payload.settings);
  if (entries.length === 0) {
    return {
      ok: false,
      error: protocolError(
        PROTOCOL_ERROR_CODES.MALFORMED_PAYLOAD,
        "settings update must include at least one key"
      )
    };
  }

  /** @type {Partial<CompanionSettings>} */
  const next: Partial<CompanionSettings> = {};
  for (const [key, value] of entries) {
    if (!isSettingsKey(key)) {
      return {
        ok: false,
        error: protocolError(
          PROTOCOL_ERROR_CODES.UNKNOWN_SETTING,
          `Unknown setting key: ${key}`,
          [key]
        )
      };
    }
    const parsed = parseSettingValue(key, value);
    if (!parsed.ok) return parsed;
    (next as Record<string, unknown>)[key] = parsed.value;
  }

  return { ok: true, value: { settings: next } };
}

export function applySettingsUpdate(
  current: CompanionSettings,
  patch: Partial<CompanionSettings>
): CompanionSettings {
  // Atomic: build full object then freeze-ish return
  return {
    ...current,
    ...patch
  };
}

export function successResponse<T>(
  requestId: string,
  data: T,
  protocolVersion: string = PROTOCOL_VERSION
): ProtocolResponse<T> {
  return {
    protocolVersion,
    requestId,
    success: true,
    data
  };
}

export function failureResponse(
  requestId: string,
  error: ProtocolError,
  protocolVersion: string = PROTOCOL_VERSION
): ProtocolResponse<never> {
  return {
    protocolVersion,
    requestId,
    success: false,
    error
  };
}

export type {
  MessageType,
  CompanionSettings,
  HelloPayload,
  HelloResult,
  StatusResult,
  SettingsResult,
  OpenFutPayload,
  OpenFutResult,
  DiagnosticsResult,
  CheckUpdateResult,
  ProtocolRequest,
  ProtocolResponse
};

export { defaultSettings, PROTOCOL_VERSION };
