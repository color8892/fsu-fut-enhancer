import type { CompanionSettings, CompanionStatus, DiagnosticsExport } from "./api.js";

export type ViewId =
  | "overview"
  | "extension"
  | "settings"
  | "diagnostics"
  | "about";

export type AppState = {
  view: ViewId;
  status: CompanionStatus | null;
  settings: CompanionSettings | null;
  diagnostics: DiagnosticsExport | null;
  diagnosticsJson: string | null;
  loading: boolean;
  error: string | null;
  toast: string | null;
};

export function initialState(): AppState {
  return {
    view: "overview",
    status: null,
    settings: null,
    diagnostics: null,
    diagnosticsJson: null,
    loading: true,
    error: null,
    toast: null
  };
}

export function isExtensionDisconnected(status: CompanionStatus | null): boolean {
  if (!status) return true;
  return !status.extension.connected || status.connection === "offline";
}
