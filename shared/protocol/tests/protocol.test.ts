import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  PROTOCOL_VERSION,
  PROTOCOL_ERROR_CODES,
  MAX_PAYLOAD_JSON_CHARS,
  defaultSettings,
  applySettingsUpdate,
  parseProtocolRequest,
  parseUpdateSettingsPayload,
  validateAndParseRequest,
  buildSanitizedDiagnostics,
  assertDiagnosticsSafe,
  createRequest
} from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function fixturesDir(): string {
  const candidates = [
    join(__dirname, "..", "fixtures"),
    join(__dirname, "..", "..", "fixtures")
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, "valid-hello.json"))) return dir;
  }
  throw new Error("fixtures directory not found");
}

describe("protocol valid requests", () => {
  it("matches the cross-language contract snapshot", () => {
    const contract = JSON.parse(
      readFileSync(join(fixturesDir(), "..", "contract.json"), "utf8")
    ) as {
      protocolVersion: string;
      settings: { keys: string[]; defaults: Record<string, unknown> };
    };
    assert.equal(PROTOCOL_VERSION, contract.protocolVersion);
    assert.deepEqual(defaultSettings(), contract.settings.defaults);
    assert.deepEqual(Object.keys(defaultSettings()), contract.settings.keys);
  });

  it("parses valid hello fixture", () => {
    const raw = JSON.parse(
      readFileSync(join(fixturesDir(), "valid-hello.json"), "utf8")
    );
    const result = validateAndParseRequest(raw);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.type, "hello");
      if (result.value.type === "hello") {
        assert.equal(result.value.payload.client, "companion");
      }
    }
  });

  it("parses valid update_settings fixture", () => {
    const raw = JSON.parse(
      readFileSync(join(fixturesDir(), "valid-update-settings.json"), "utf8")
    );
    const result = validateAndParseRequest(raw);
    assert.equal(result.ok, true);
    if (result.ok && result.value.type === "update_settings") {
      assert.equal(result.value.payload.settings.theme, "dark");
    }
  });

  it("createRequest builds envelope", () => {
    const req = createRequest("get_status", {}, "req_status_01", 1700000000000);
    assert.equal(req.protocolVersion, PROTOCOL_VERSION);
    assert.equal(parseProtocolRequest(req).ok, true);
  });
});

describe("malformed and unknown", () => {
  it("rejects non-object", () => {
    const result = parseProtocolRequest(null);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, PROTOCOL_ERROR_CODES.INVALID_ENVELOPE);
    }
  });

  it("rejects unknown type", () => {
    const result = parseProtocolRequest({
      protocolVersion: "1.0",
      requestId: "req_unknown_1",
      type: "drop_table",
      payload: {},
      timestamp: 1700000000000
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, PROTOCOL_ERROR_CODES.UNKNOWN_TYPE);
    }
  });

  it("rejects version mismatch", () => {
    const result = parseProtocolRequest({
      protocolVersion: "9.0",
      requestId: "req_version_1",
      type: "hello",
      payload: { client: "test", clientVersion: "1" },
      timestamp: 1700000000000
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, PROTOCOL_ERROR_CODES.VERSION_MISMATCH);
    }
  });

  it("rejects invalid requestId", () => {
    const result = parseProtocolRequest({
      protocolVersion: "1.0",
      requestId: "short",
      type: "get_status",
      payload: {},
      timestamp: 1700000000000
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, PROTOCOL_ERROR_CODES.INVALID_REQUEST_ID);
    }
  });

  it("rejects non-finite timestamp", () => {
    const result = parseProtocolRequest({
      protocolVersion: "1.0",
      requestId: "req_time_001",
      type: "get_status",
      payload: {},
      timestamp: Number.NaN
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, PROTOCOL_ERROR_CODES.INVALID_TIMESTAMP);
    }
  });

  it("rejects unknown envelope field", () => {
    const result = parseProtocolRequest({
      protocolVersion: "1.0",
      requestId: "req_extra_001",
      type: "get_status",
      payload: {},
      timestamp: 1700000000000,
      extra: true
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, PROTOCOL_ERROR_CODES.INVALID_ENVELOPE);
    }
  });

  it("rejects unknown payload field", () => {
    const result = validateAndParseRequest({
      protocolVersion: "1.0",
      requestId: "req_extra_002",
      type: "hello",
      payload: { client: "test", clientVersion: "1", extra: true },
      timestamp: 1700000000000
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, PROTOCOL_ERROR_CODES.MALFORMED_PAYLOAD);
    }
  });
});

describe("oversized payload", () => {
  it("rejects oversized payload", () => {
    const huge = "x".repeat(MAX_PAYLOAD_JSON_CHARS + 10);
    const result = parseProtocolRequest({
      protocolVersion: "1.0",
      requestId: "req_oversize_1",
      type: "hello",
      payload: { client: "test", clientVersion: "1", pad: huge },
      timestamp: 1700000000000
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, PROTOCOL_ERROR_CODES.OVERSIZED_PAYLOAD);
    }
  });
});

describe("forbidden keys / pollution", () => {
  it("rejects __proto__ in payload via JSON", () => {
    const polluted = JSON.parse(
      '{"protocolVersion":"1.0","requestId":"req_proto_01","type":"hello","payload":{"__proto__":{"x":1},"client":"test","clientVersion":"1"},"timestamp":1700000000000}'
    );
    const result = parseProtocolRequest(polluted);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, PROTOCOL_ERROR_CODES.FORBIDDEN_KEY);
    }
  });
});

describe("settings allowlist and atomic update", () => {
  it("rejects unknown setting key", () => {
    const result = parseUpdateSettingsPayload({
      settings: { theme: "dark", evilKey: true }
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, PROTOCOL_ERROR_CODES.UNKNOWN_SETTING);
    }
  });

  it("rejects unknown update_settings sibling field", () => {
    const result = parseUpdateSettingsPayload({
      settings: { theme: "dark" },
      extra: true
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, PROTOCOL_ERROR_CODES.MALFORMED_PAYLOAD);
    }
  });

  it("applies atomic patch only when fully valid", () => {
    const current = defaultSettings();
    const parsed = parseUpdateSettingsPayload({
      settings: { theme: "light", localeHint: "zh-TW" }
    });
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      const next = applySettingsUpdate(current, parsed.value.settings);
      assert.equal(next.theme, "light");
      assert.equal(next.localeHint, "zh-TW");
      assert.equal(next.openFutOnLaunch, false);
      assert.notEqual(next, current);
    }
  });

  it("rejects invalid enum without partial apply", () => {
    const result = parseUpdateSettingsPayload({
      settings: { theme: "neon" }
    });
    assert.equal(result.ok, false);
  });
});

describe("diagnostics redaction", () => {
  it("builds sanitized diagnostics without sensitive material", () => {
    const diag = buildSanitizedDiagnostics({
      companionVersion: "0.1.0",
      platform: "macos",
      arch: "aarch64",
      settings: defaultSettings(),
      includePlatform: true,
      connection: "offline",
      now: 1700000000000
    });
    assert.equal(diag.connection, "offline");
    assert.equal(diag.platform, "macos");
    assertDiagnosticsSafe(diag);
    const text = JSON.stringify(diag);
    assert.equal(/cookie|session|X-UT-SID|Users\//i.test(text), false);
  });

  it("redacts sensitive strings if injected", () => {
    const diag = buildSanitizedDiagnostics({
      companionVersion: "cookie-session-token",
      settings: defaultSettings(),
      includePlatform: false,
      connection: "offline"
    });
    assert.equal(diag.companionVersion, "[redacted]");
  });
});
