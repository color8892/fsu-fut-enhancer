import "./styles.css";
import { api, type CompanionSettings } from "./api.js";
import { initialState, type AppState, type ViewId } from "./state.js";
import { renderApp, type UiHandlers } from "./render.js";

const rootEl = document.querySelector("#app");
if (!(rootEl instanceof HTMLElement)) {
  throw new Error("Missing #app root");
}
const root: HTMLElement = rootEl;

let state: AppState = initialState();
let draftSettings: CompanionSettings | null = null;
let toastTimer: number | undefined;

function setState(patch: Partial<AppState>): void {
  state = { ...state, ...patch };
  paint();
}

function showToast(message: string): void {
  if (toastTimer) window.clearTimeout(toastTimer);
  setState({ toast: message });
  toastTimer = window.setTimeout(() => {
    setState({ toast: null });
  }, 3200);
}

function applyTheme(theme: CompanionSettings["theme"] | undefined): void {
  const rootEl = document.documentElement;
  if (!theme || theme === "system") {
    rootEl.removeAttribute("data-theme");
  } else {
    rootEl.setAttribute("data-theme", theme);
  }
}

async function loadAll(): Promise<void> {
  setState({ loading: true, error: null });
  try {
    const [status, settings, diagnostics] = await Promise.all([
      api.getStatus(),
      api.getSettings(),
      api.getDiagnostics()
    ]);
    draftSettings = { ...settings };
    applyTheme(settings.theme);
    setState({
      status,
      settings,
      diagnostics,
      loading: false,
      error: null
    });

    if (settings.openFutOnLaunch && !settings.embeddedMode) {
      // Best-effort; ignore failures on launch.
      void api.openFut().catch(() => undefined);
    }
  } catch (error) {
    setState({
      loading: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

const handlers: UiHandlers = {
  onNavigate(view: ViewId) {
    setState({ view });
  },
  async onOpenFut() {
    try {
      const url = await api.openFut();
      showToast(`Opened ${url}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    }
  },
  async onOpenBrowserFallback() {
    try {
      const url = await api.openFutBrowserFallback();
      showToast(`Browser fallback: ${url}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    }
  },
  async onDisableEmbedded() {
    try {
      const saved = await api.updateSettings({ embeddedMode: false });
      draftSettings = { ...saved };
      setState({ settings: saved });
      showToast("Embedded Mode disabled");
      void loadAll();
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    }
  },
  onRefresh() {
    void loadAll();
  },
  async onSaveSettings() {
    if (!draftSettings) return;
    try {
      const saved = await api.updateSettings({
        theme: draftSettings.theme,
        openFutOnLaunch: draftSettings.openFutOnLaunch,
        preferredBrowser: draftSettings.preferredBrowser,
        diagnosticsIncludePlatform: draftSettings.diagnosticsIncludePlatform,
        localeHint: draftSettings.localeHint,
        embeddedMode: draftSettings.embeddedMode,
        openEmbeddedOnLaunch: draftSettings.openEmbeddedOnLaunch
      });
      draftSettings = { ...saved };
      applyTheme(saved.theme);
      setState({ settings: saved });
      showToast("Settings saved");
      const diagnostics = await api.getDiagnostics();
      setState({ diagnostics });
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    }
  },
  async onResetSettings() {
    try {
      const saved = await api.resetSettings();
      draftSettings = { ...saved };
      applyTheme(saved.theme);
      setState({ settings: saved });
      showToast("Settings reset");
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    }
  },
  async onExportDiagnostics() {
    try {
      const json = await api.exportDiagnosticsJson();
      setState({ diagnosticsJson: json });
      // Copy when clipboard available
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(json);
        showToast("Diagnostics copied to clipboard");
      } else {
        showToast("Diagnostics ready below");
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    }
  },
  onThemeChange(theme) {
    if (!draftSettings) return;
    if (theme === "system" || theme === "light" || theme === "dark") {
      draftSettings = { ...draftSettings, theme };
      applyTheme(theme);
    }
  },
  onOpenFutLaunchChange(value) {
    if (!draftSettings) return;
    draftSettings = { ...draftSettings, openFutOnLaunch: value };
  },
  onBrowserChange(value) {
    if (!draftSettings) return;
    if (value === "system" || value === "chrome" || value === "edge") {
      draftSettings = { ...draftSettings, preferredBrowser: value };
    }
  },
  onDiagnosticsPlatformChange(value) {
    if (!draftSettings) return;
    draftSettings = { ...draftSettings, diagnosticsIncludePlatform: value };
  },
  onLocaleChange(value) {
    if (!draftSettings) return;
    draftSettings = { ...draftSettings, localeHint: value };
  },
  onEmbeddedModeChange(value) {
    if (!draftSettings) return;
    draftSettings = { ...draftSettings, embeddedMode: value };
  },
  onOpenEmbeddedOnLaunchChange(value) {
    if (!draftSettings) return;
    draftSettings = { ...draftSettings, openEmbeddedOnLaunch: value };
  },
  async onClearSiteData() {
    const ok = window.confirm(
      "Clear Embedded FUT WebView site data?\n\nThis signs you out of EA inside Companion only.\nCompanion settings and the browser Extension are not affected."
    );
    if (!ok) return;
    try {
      await api.clearEmbeddedSiteData(true);
      showToast("Embedded site data cleared");
      void loadAll();
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    }
  },
  async onReloadFut() {
    try {
      await api.reloadEmbeddedFut();
      showToast("FUT reload requested");
      void loadAll();
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    }
  },
  async onFutBack() {
    try {
      await api.embeddedGoBack();
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    }
  },
  async onFutForward() {
    try {
      await api.embeddedGoForward();
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    }
  },
  async onFutHome() {
    try {
      await api.embeddedGoHome();
      showToast("Navigating to FUT home");
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    }
  }
};

function paint(): void {
  renderApp(root, state, handlers);
}

paint();
void loadAll();
