/**
 * Tauri invoke wrappers with browser-safe mocks for unit tests / offline HTML.
 */

import {
  PROTOCOL_VERSION,
  applySettingsUpdate,
  defaultSettings,
  parseUpdateSettingsPayload,
  type CompanionSettings,
  type DiagnosticsResult,
  type StatusResult
} from "@fsu/protocol";

export type CompanionStatus = StatusResult;
export type DiagnosticsExport = DiagnosticsResult;
export type { CompanionSettings };
export { defaultSettings };

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
    return await tauriInvoke<T>(cmd, args);
  } catch (error) {
    // Running under plain Vite / unit tests without Tauri runtime.
    if (isTauriAvailable()) {
      throw error;
    }
    return mockInvoke<T>(cmd, args);
  }
}

function isTauriAvailable(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** In-memory mock for non-Tauri environments (tests / static preview). */
const mockState = {
  settings: defaultSettings()
};

function mockInvoke<T>(cmd: string, args?: Record<string, unknown>): T {
  switch (cmd) {
    case "get_companion_status":
      return {
        connection: "offline",
        extension: {
          connected: false,
          reason: "Native Messaging host not implemented. Use Extension or Embedded Mode."
        },
        companion: {
          version: "0.2.0-beta.1",
          protocolVersion: PROTOCOL_VERSION,
          platform: "web",
          arch: "unknown"
        },
        embedded: {
          lifecycle: mockState.settings.embeddedMode ? "starting" : "disabled",
          embeddedMode: mockState.settings.embeddedMode,
          windowOpen: false,
          lastErrorCode: null,
          lastErrorMessage: null,
          runtimeInstalled: false,
          notes: mockState.settings.embeddedMode
            ? ["Mock embedded status (non-Tauri)."]
            : ["Embedded Mode is off."]
        }
      } as T;
    case "get_settings":
      return { ...mockState.settings } as T;
    case "update_settings": {
      const parsed = parseUpdateSettingsPayload({ settings: args?.patch });
      if (!parsed.ok) {
        throw new Error(parsed.error.message);
      }
      mockState.settings = applySettingsUpdate(
        mockState.settings,
        parsed.value.settings
      );
      return { ...mockState.settings } as T;
    }
    case "reset_companion_settings":
      mockState.settings = defaultSettings();
      return { ...mockState.settings } as T;
    case "get_diagnostics":
      return {
        generatedAt: Date.now(),
        companionVersion: "0.2.0-beta.1",
        protocolVersion: PROTOCOL_VERSION,
        connection: "offline",
        platform: "web",
        arch: "unknown",
        settingsKeys: Object.keys(mockState.settings),
        notes: [
          "Extension IPC is not connected (Native Messaging / H8 not implemented).",
          "Running outside Tauri shell (mock)."
        ]
      } as T;
    case "export_diagnostics_json":
      return JSON.stringify(
        {
          generatedAt: Date.now(),
          companionVersion: "0.2.0-beta.1",
          protocolVersion: PROTOCOL_VERSION,
          connection: "offline",
          settingsKeys: Object.keys(mockState.settings),
          notes: ["mock export"]
        },
        null,
        2
      ) as T;
    case "open_fut_web_app":
    case "open_fut_browser_fallback":
      return "https://www.ea.com/ea-sports-fc/ultimate-team/web-app/" as T;
    case "check_update_status":
      return {
        status: "not_configured",
        currentVersion: "0.2.0-beta.1",
        message: "Update channel is not configured."
      } as T;
    case "show_embedded_fut":
      if (!mockState.settings.embeddedMode) {
        throw new Error("embeddedMode is disabled");
      }
      return "https://www.ea.com/ea-sports-fc/ultimate-team/web-app/" as T;
    case "reload_embedded_fut":
    case "embedded_go_back":
    case "embedded_go_forward":
    case "embedded_go_home":
      return undefined as T;
    case "clear_embedded_site_data_cmd":
      if (!args?.confirm) throw new Error("confirmation required");
      return undefined as T;
    case "get_embedded_status_cmd":
      return {
        lifecycle: mockState.settings.embeddedMode ? "starting" : "disabled",
        embeddedMode: mockState.settings.embeddedMode,
        windowOpen: false,
        runtimeInstalled: false,
        notes: []
      } as T;
    default:
      throw new Error(`Unknown mock command: ${cmd}`);
  }
}

export const api = {
  getStatus: () => invoke<CompanionStatus>("get_companion_status"),
  getSettings: () => invoke<CompanionSettings>("get_settings"),
  updateSettings: (patch: Partial<CompanionSettings>) =>
    invoke<CompanionSettings>("update_settings", { patch }),
  resetSettings: () => invoke<CompanionSettings>("reset_companion_settings"),
  getDiagnostics: () => invoke<DiagnosticsExport>("get_diagnostics"),
  exportDiagnosticsJson: () => invoke<string>("export_diagnostics_json"),
  openFut: (url?: string) =>
    invoke<string>("open_fut_web_app", url ? { url } : undefined),
  openFutBrowserFallback: () => invoke<string>("open_fut_browser_fallback"),
  showEmbeddedFut: () => invoke<string>("show_embedded_fut"),
  reloadEmbeddedFut: () => invoke<void>("reload_embedded_fut"),
  embeddedGoBack: () => invoke<void>("embedded_go_back"),
  embeddedGoForward: () => invoke<void>("embedded_go_forward"),
  embeddedGoHome: () => invoke<void>("embedded_go_home"),
  clearEmbeddedSiteData: (confirm: boolean) =>
    invoke<void>("clear_embedded_site_data_cmd", { confirm }),
  getEmbeddedStatus: () => invoke<unknown>("get_embedded_status_cmd"),
  checkUpdate: () =>
    invoke<{ status: string; currentVersion: string; message: string }>(
      "check_update_status"
    )
};

export function __resetMockStateForTests(): void {
  mockState.settings = defaultSettings();
}
