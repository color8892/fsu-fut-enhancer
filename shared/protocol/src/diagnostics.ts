import type { CompanionSettings } from "./settings.js";
import type { DiagnosticsResult } from "./types.js";
import { PROTOCOL_VERSION } from "./protocol-version.js";

const SENSITIVE_PATTERN =
  /(cookie|session|x-ut-sid|authorization|password|token|home\/|users\/|\\users\\|env\b)/i;

/**
 * Build a diagnostics object that is safe to display or export.
 * Never include paths under the user home directory, env dumps, or session material.
 */
export function buildSanitizedDiagnostics(input: {
  companionVersion: string;
  platform?: string;
  arch?: string;
  settings: CompanionSettings;
  includePlatform: boolean;
  connection?: "offline" | "connected";
  now?: number;
}): DiagnosticsResult {
  const notes = [
    "Extension IPC is not connected in Phase 0–2.",
    "Export excludes secrets, account material, filesystem paths, and process env dumps."
  ];

  const result: DiagnosticsResult = {
    generatedAt: input.now ?? Date.now(),
    companionVersion: String(input.companionVersion).slice(0, 64),
    protocolVersion: PROTOCOL_VERSION,
    connection: input.connection ?? "offline",
    settingsKeys: Object.keys(input.settings).sort(),
    notes
  };

  if (input.includePlatform) {
    if (input.platform) {
      result.platform = sanitizeLabel(input.platform);
    }
    if (input.arch) {
      result.arch = sanitizeLabel(input.arch);
    }
  }

  // Belt-and-suspenders redaction of any accidental sensitive strings
  return redactDeep(result) as DiagnosticsResult;
}

function sanitizeLabel(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9._+-]/g, "").slice(0, 64);
  return cleaned || "unknown";
}

function redactDeep(value: unknown): unknown {
  if (typeof value === "string") {
    if (SENSITIVE_PATTERN.test(value)) {
      return "[redacted]";
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(redactDeep);
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_PATTERN.test(k)) {
        out[k] = "[redacted]";
      } else {
        out[k] = redactDeep(v);
      }
    }
    return out;
  }
  return value;
}

export function assertDiagnosticsSafe(diagnostics: DiagnosticsResult): void {
  const text = JSON.stringify(diagnostics);
  if (SENSITIVE_PATTERN.test(text)) {
    throw new Error("Diagnostics export failed redaction check");
  }
}
