import assert from "node:assert/strict";
import { before, beforeEach, describe, it } from "node:test";
import { Window as HappyDomWindow } from "happy-dom";
import {
  api,
  __resetMockStateForTests,
  defaultSettings
} from "../src/api.js";
import { isExtensionDisconnected, initialState } from "../src/state.js";
import { renderApp, type UiHandlers } from "../src/render.js";

before(() => {
  const browser = new HappyDomWindow();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: browser
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: browser.document
  });
});

const noopHandlers: UiHandlers = {
  onNavigate: () => undefined,
  onOpenFut: () => undefined,
  onOpenBrowserFallback: () => undefined,
  onDisableEmbedded: () => undefined,
  onRefresh: () => undefined,
  onSaveSettings: () => undefined,
  onResetSettings: () => undefined,
  onExportDiagnostics: () => undefined,
  onThemeChange: () => undefined,
  onOpenFutLaunchChange: () => undefined,
  onBrowserChange: () => undefined,
  onDiagnosticsPlatformChange: () => undefined,
  onLocaleChange: () => undefined,
  onEmbeddedModeChange: () => undefined,
  onOpenEmbeddedOnLaunchChange: () => undefined,
  onClearSiteData: () => undefined,
  onReloadFut: () => undefined,
  onFutBack: () => undefined,
  onFutForward: () => undefined,
  onFutHome: () => undefined
};

describe("offline connection state", () => {
  beforeEach(() => {
    __resetMockStateForTests();
  });

  it("status reports extension disconnected", async () => {
    const status = await api.getStatus();
    assert.equal(status.extension.connected, false);
    assert.equal(status.connection, "offline");
    assert.match(status.extension.reason, /Native Messaging|not implemented/i);
    assert.equal(isExtensionDisconnected(status), true);
  });

  it("embedded mode defaults off", async () => {
    const settings = await api.getSettings();
    assert.equal(settings.embeddedMode, false);
    const status = await api.getStatus();
    assert.equal(status.embedded?.embeddedMode, false);
    assert.equal(status.embedded?.lifecycle, "disabled");
  });

  it("initial UI state is loading and disconnected-friendly", () => {
    const state = initialState();
    assert.equal(state.loading, true);
    assert.equal(state.status, null);
    assert.equal(isExtensionDisconnected(state.status), true);
  });

  it("renders the disconnected state instead of a fake connection", async () => {
    const state = initialState();
    state.loading = false;
    state.status = await api.getStatus();
    state.settings = defaultSettings();
    const root = document.createElement("div");

    renderApp(root, state, noopHandlers);

    assert.match(root.textContent ?? "", /Extension disconnected/);
    assert.match(root.textContent ?? "", /Disconnected/);
    assert.doesNotMatch(root.textContent ?? "", /\bConnected\b/);
    assert.equal(
      root.querySelector(".badge.offline")?.textContent,
      "Extension disconnected"
    );
  });

  it("renders allowlisted settings controls including embedded flag", async () => {
    const state = initialState();
    state.view = "settings";
    state.loading = false;
    state.status = await api.getStatus();
    state.settings = await api.getSettings();
    const root = document.createElement("div");

    renderApp(root, state, noopHandlers);

    assert.equal(root.querySelectorAll("select").length, 2);
    // openFutOnLaunch, diagnosticsIncludePlatform, embeddedMode, openEmbeddedOnLaunch
    assert.equal(root.querySelectorAll('input[type="checkbox"]').length, 4);
    assert.match(root.textContent ?? "", /Embedded Mode/);
  });

  it("settings mock is allowlisted shape", async () => {
    const settings = await api.getSettings();
    assert.equal(settings.theme, "system");
    const updated = await api.updateSettings({ theme: "dark" });
    assert.equal(updated.theme, "dark");
    const reset = await api.resetSettings();
    assert.equal(reset.theme, "system");
  });

  it("settings mock rejects unknown keys", async () => {
    await assert.rejects(
      api.updateSettings({ unknown: true } as never),
      /Unknown setting key/
    );
  });

  it("diagnostics export has no session markers", async () => {
    const json = await api.exportDiagnosticsJson();
    assert.equal(/cookie|session|X-UT-SID|Users\//i.test(json), false);
    const parsed = JSON.parse(json) as { connection: string };
    assert.equal(parsed.connection, "offline");
  });

  it("check_update is not_configured", async () => {
    const update = await api.checkUpdate();
    assert.equal(update.status, "not_configured");
  });

  it("open_fut returns allowlisted URL", async () => {
    const url = await api.openFut();
    assert.match(url, /^https:\/\/www\.ea\.com\/.*ultimate-team\/web-app/);
  });

  it("failed lifecycle shows recovery actions without permanent spinner", async () => {
    const state = initialState();
    state.loading = false;
    state.status = await api.getStatus();
    state.status = {
      ...state.status,
      embedded: {
        lifecycle: "failed",
        embeddedMode: true,
        windowOpen: false,
        lastErrorCode: "RUNTIME_HANDSHAKE_TIMEOUT",
        lastErrorMessage: "Runtime handshake timed out waiting for ready.",
        runtimeInstalled: false,
        notes: ["Handshake timeout."]
      }
    };
    state.settings = { ...defaultSettings(), embeddedMode: true };
    const root = document.createElement("div");
    renderApp(root, state, noopHandlers);
    assert.match(root.textContent ?? "", /RUNTIME_HANDSHAKE_TIMEOUT|Reload FUT/i);
    assert.match(root.textContent ?? "", /browser fallback|failed/i);
    assert.match(root.textContent ?? "", /Disable Embedded/i);
    assert.doesNotMatch(root.textContent ?? "", /Loading companion status/);
  });

  it("ready lifecycle prefers show/reload actions", async () => {
    const state = initialState();
    state.loading = false;
    state.status = await api.getStatus();
    state.status = {
      ...state.status,
      embedded: {
        lifecycle: "ready",
        embeddedMode: true,
        windowOpen: true,
        lastErrorCode: null,
        lastErrorMessage: null,
        runtimeInstalled: true,
        notes: []
      }
    };
    state.settings = { ...defaultSettings(), embeddedMode: true };
    const root = document.createElement("div");
    renderApp(root, state, noopHandlers);
    assert.match(root.textContent ?? "", /Show FUT/);
    assert.match(root.textContent ?? "", /Reload FUT/);
  });
});
