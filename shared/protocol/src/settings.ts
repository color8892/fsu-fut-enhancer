/**
 * Companion-local settings allowlist.
 * Extension feature keys are not writable from Companion in Phase 0–2.
 */
export const SETTINGS_ALLOWLIST = Object.freeze({
  theme: {
    type: "enum",
    values: ["system", "light", "dark"] as const,
    default: "system" as const
  },
  openFutOnLaunch: {
    type: "boolean",
    default: false
  },
  preferredBrowser: {
    type: "enum",
    values: ["system", "chrome", "edge"] as const,
    default: "system" as const
  },
  diagnosticsIncludePlatform: {
    type: "boolean",
    default: true
  },
  localeHint: {
    type: "string",
    maxLength: 32,
    pattern: /^[A-Za-z0-9._-]{0,32}$/,
    default: ""
  },
  embeddedMode: {
    type: "boolean",
    default: false
  },
  openEmbeddedOnLaunch: {
    type: "boolean",
    default: true
  }
} as const);

export type SettingsKey = keyof typeof SETTINGS_ALLOWLIST;

export type CompanionSettings = {
  theme: "system" | "light" | "dark";
  openFutOnLaunch: boolean;
  preferredBrowser: "system" | "chrome" | "edge";
  diagnosticsIncludePlatform: boolean;
  localeHint: string;
  /** Opt-in Embedded FUT WebView (default false). */
  embeddedMode: boolean;
  openEmbeddedOnLaunch: boolean;
};

export function defaultSettings(): CompanionSettings {
  return {
    theme: SETTINGS_ALLOWLIST.theme.default,
    openFutOnLaunch: SETTINGS_ALLOWLIST.openFutOnLaunch.default,
    preferredBrowser: SETTINGS_ALLOWLIST.preferredBrowser.default,
    diagnosticsIncludePlatform: SETTINGS_ALLOWLIST.diagnosticsIncludePlatform.default,
    localeHint: SETTINGS_ALLOWLIST.localeHint.default,
    embeddedMode: SETTINGS_ALLOWLIST.embeddedMode.default,
    openEmbeddedOnLaunch: SETTINGS_ALLOWLIST.openEmbeddedOnLaunch.default
  };
}

export function isSettingsKey(key: string): key is SettingsKey {
  return Object.prototype.hasOwnProperty.call(SETTINGS_ALLOWLIST, key);
}
