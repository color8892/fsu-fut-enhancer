import type { MessageType } from "./message-types.js";
import type { ProtocolError } from "./errors.js";
import type { CompanionSettings } from "./settings.js";

export type ProtocolRequest<T extends MessageType = MessageType> = {
  protocolVersion: string;
  requestId: string;
  type: T;
  payload: unknown;
  timestamp: number;
};

export type ProtocolSuccessResponse<TData = unknown> = {
  protocolVersion: string;
  requestId: string;
  success: true;
  data: TData;
};

export type ProtocolFailureResponse = {
  protocolVersion: string;
  requestId: string;
  success: false;
  error: ProtocolError;
};

export type ProtocolResponse<TData = unknown> =
  | ProtocolSuccessResponse<TData>
  | ProtocolFailureResponse;

export type HelloPayload = {
  client: "companion" | "extension" | "test";
  clientVersion: string;
};

export type HelloResult = {
  server: "companion";
  protocolVersion: string;
  companionVersion: string;
  connection: "offline" | "connected";
};

export type EmbeddedLifecycle =
  | "disabled"
  | "starting"
  | "login_required"
  | "ready"
  | "failed";

export type EmbeddedStatusResult = {
  lifecycle: EmbeddedLifecycle;
  embeddedMode: boolean;
  windowOpen: boolean;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  runtimeInstalled: boolean;
  notes: string[];
};

export type StatusResult = {
  connection: "offline" | "connected";
  extension: {
    connected: boolean;
    reason: string;
  };
  companion: {
    version: string;
    protocolVersion: string;
    platform: string;
    arch: string;
  };
  embedded?: EmbeddedStatusResult;
};

export type SettingsResult = {
  settings: CompanionSettings;
};

export type UpdateSettingsPayload = {
  settings: Partial<CompanionSettings>;
};

export type OpenFutPayload = {
  url?: string;
};

export type OpenFutResult = {
  opened: boolean;
  url: string;
};

export type DiagnosticsResult = {
  generatedAt: number;
  companionVersion: string;
  protocolVersion: string;
  connection: "offline" | "connected";
  platform?: string;
  arch?: string;
  settingsKeys: string[];
  notes: string[];
};

export type CheckUpdateResult = {
  status: "not_configured" | "offline" | "up_to_date" | "update_available";
  currentVersion: string;
  latestVersion?: string;
  message: string;
};
