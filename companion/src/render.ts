import { iconNode, type IconName } from "./icons.js";
import type { DiagnosticsExport } from "./api.js";
import type { AppState, ViewId } from "./state.js";
import { isExtensionDisconnected } from "./state.js";

export type UiHandlers = {
  onNavigate: (view: ViewId) => void;
  onOpenFut: () => void;
  onOpenBrowserFallback: () => void;
  onDisableEmbedded: () => void;
  onRefresh: () => void;
  onSaveSettings: () => void;
  onResetSettings: () => void;
  onExportDiagnostics: () => void;
  onThemeChange: (theme: string) => void;
  onOpenFutLaunchChange: (value: boolean) => void;
  onBrowserChange: (value: string) => void;
  onDiagnosticsPlatformChange: (value: boolean) => void;
  onLocaleChange: (value: string) => void;
  onEmbeddedModeChange: (value: boolean) => void;
  onOpenEmbeddedOnLaunchChange: (value: boolean) => void;
  onClearSiteData: () => void;
  onReloadFut: () => void;
  onFutBack: () => void;
  onFutForward: () => void;
  onFutHome: () => void;
};

const NAV: { id: ViewId; label: string; icon: IconName }[] = [
  { id: "overview", label: "Overview", icon: "overview" },
  { id: "extension", label: "Extension", icon: "extension" },
  { id: "settings", label: "Settings", icon: "settings" },
  { id: "diagnostics", label: "Diagnostics", icon: "diagnostics" },
  { id: "about", label: "About", icon: "about" }
];

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(
  label: string,
  opts: {
    className?: string;
    icon?: IconName;
    onClick?: () => void;
    disabled?: boolean;
  } = {}
): HTMLButtonElement {
  const btn = el("button", `btn ${opts.className ?? ""}`.trim()) as HTMLButtonElement;
  if (opts.icon) btn.appendChild(iconNode(opts.icon));
  btn.appendChild(document.createTextNode(label));
  if (opts.onClick) btn.addEventListener("click", opts.onClick);
  if (opts.disabled) btn.disabled = true;
  return btn;
}

function metric(label: string, value: string): HTMLElement {
  const box = el("div", "metric");
  box.appendChild(el("div", "label", label));
  box.appendChild(el("div", "value", value));
  return box;
}

function offlineBadge(): HTMLElement {
  const badge = el("span", "badge offline");
  badge.appendChild(iconNode("offline"));
  badge.appendChild(document.createTextNode("Extension disconnected"));
  return badge;
}

function modeBadge(embedded: boolean, lifecycle?: string): HTMLElement {
  const badge = el("span", embedded ? "badge warn" : "badge ok");
  badge.appendChild(iconNode(embedded ? "activity" : "cable"));
  badge.appendChild(
    document.createTextNode(
      embedded
        ? `Embedded: ${lifecycle ?? "on"}`
        : "Mode: Extension fallback"
    )
  );
  return badge;
}

function titleFor(view: ViewId): string {
  return NAV.find((n) => n.id === view)?.label ?? "FSU Companion";
}

export function renderApp(
  root: HTMLElement,
  state: AppState,
  handlers: UiHandlers
): void {
  root.replaceChildren();
  const shell = el("div", "app-shell");

  // Sidebar
  const sidebar = el("aside", "sidebar");
  const brand = el("div", "brand");
  brand.appendChild(el("strong", undefined, "FSU Companion"));
  brand.appendChild(el("span", undefined, "Desktop control panel"));
  sidebar.appendChild(brand);

  const nav = el("nav", "nav");
  for (const item of NAV) {
    const btn = el("button") as HTMLButtonElement;
    if (state.view === item.id) btn.classList.add("active");
    btn.appendChild(iconNode(item.icon));
    btn.appendChild(el("span", "label", item.label));
    btn.addEventListener("click", () => handlers.onNavigate(item.id));
    nav.appendChild(btn);
  }
  sidebar.appendChild(nav);

  const footer = el("div", "sidebar-footer");
  footer.textContent = state.status
    ? `v${state.status.companion.version} · protocol ${state.status.companion.protocolVersion}`
    : "Loading…";
  sidebar.appendChild(footer);
  shell.appendChild(sidebar);

  // Main
  const main = el("main", "main");
  const topbar = el("div", "topbar");
  topbar.appendChild(el("h1", undefined, titleFor(state.view)));
  const topActions = el("div", "row");
  const embeddedOn = Boolean(state.settings?.embeddedMode);
  const lifecycle = state.status?.embedded?.lifecycle;
  topActions.appendChild(modeBadge(embeddedOn, lifecycle));
  if (isExtensionDisconnected(state.status)) {
    topActions.appendChild(offlineBadge());
  }
  topActions.appendChild(
    button("Refresh", { icon: "refresh", onClick: handlers.onRefresh })
  );
  if (embeddedOn) {
    topActions.appendChild(
      button("←", { onClick: handlers.onFutBack })
    );
    topActions.appendChild(
      button("→", { onClick: handlers.onFutForward })
    );
    topActions.appendChild(
      button("Reload", { icon: "refresh", onClick: handlers.onReloadFut })
    );
    topActions.appendChild(
      button("Home", { onClick: handlers.onFutHome })
    );
  }
  topActions.appendChild(
    button(embeddedOn ? "Show FUT" : "Open FUT (browser)", {
      className: "primary",
      icon: "open",
      onClick: handlers.onOpenFut
    })
  );
  topbar.appendChild(topActions);
  main.appendChild(topbar);

  const content = el("div", "content");
  if (state.error) {
    content.appendChild(el("div", "error-state", state.error));
  }
  if (state.loading && !state.status) {
    content.appendChild(el("div", "empty-state", "Loading companion status…"));
  } else {
    content.appendChild(renderView(state, handlers));
  }
  main.appendChild(content);
  shell.appendChild(main);
  root.appendChild(shell);

  if (state.toast) {
    const toast = el("div", "toast", state.toast);
    root.appendChild(toast);
  }
}

function renderView(state: AppState, handlers: UiHandlers): HTMLElement {
  switch (state.view) {
    case "overview":
      return renderOverview(state, handlers);
    case "extension":
      return renderExtension(state, handlers);
    case "settings":
      return renderSettings(state, handlers);
    case "diagnostics":
      return renderDiagnostics(state, handlers);
    case "about":
      return renderAbout(state);
    default:
      return el("div", "empty-state", "Unknown view");
  }
}

function panel(title: string, body: HTMLElement): HTMLElement {
  const p = el("div", "panel");
  const header = el("div", "panel-header");
  header.appendChild(el("h2", undefined, title));
  p.appendChild(header);
  const pb = el("div", "panel-body");
  pb.appendChild(body);
  p.appendChild(pb);
  return p;
}

/** H5: lifecycle-driven copy + actions (no permanent spinner). */
function lifecycleHelp(lifecycle: string | undefined): string {
  switch (lifecycle) {
    case "disabled":
      return "Embedded Mode is OFF (default). Enable it in Settings, or use the browser Extension fallback.";
    case "starting":
      return "Starting Embedded FUT… waiting for runtime handshake (timeout becomes failed, not a permanent spinner).";
    case "login_required":
      return "EA login / auth page is open in the Embedded window. Complete login there, then FUT will continue.";
    case "ready":
      return "Embedded runtime handshake passed. Use Show / Reload / Hide as needed.";
    case "failed":
      return "Embedded runtime failed or handshake timed out. Reload FUT, disable Embedded, or open the browser Extension fallback.";
    default:
      return "Enable Embedded Mode in Settings (opt-in beta), or use the Chrome/Edge Extension.";
  }
}

function renderOverview(state: AppState, handlers: UiHandlers): HTMLElement {
  const wrap = el("div");
  wrap.style.display = "flex";
  wrap.style.flexDirection = "column";
  wrap.style.gap = "14px";

  const metrics = el("div", "grid-metrics");
  const s = state.status;
  const lifecycle = s?.embedded?.lifecycle;
  metrics.appendChild(metric("Companion", s?.companion.version ?? "—"));
  metrics.appendChild(metric("Protocol", s?.companion.protocolVersion ?? "—"));
  metrics.appendChild(
    metric("Platform", s ? `${s.companion.platform} / ${s.companion.arch}` : "—")
  );
  metrics.appendChild(
    metric("Extension", s?.extension.connected ? "Connected" : "Disconnected")
  );
  metrics.appendChild(
    metric(
      "Embedded",
      s?.embedded
        ? `${s.embedded.lifecycle}${s.embedded.windowOpen ? " · open" : ""}`
        : state.settings?.embeddedMode
          ? "enabled"
          : "disabled"
    )
  );
  if (s?.embedded?.lastErrorCode) {
    metrics.appendChild(metric("Error code", s.embedded.lastErrorCode));
  }
  wrap.appendChild(panel("Status", metrics));

  const mode = el("div");
  mode.appendChild(el("p", undefined, lifecycleHelp(lifecycle)));
  if (lifecycle === "failed" && s?.embedded?.lastErrorMessage) {
    mode.appendChild(
      el("p", undefined, s.embedded.lastErrorMessage.slice(0, 200))
    );
  }

  const actions = el("div", "row");
  actions.style.marginTop = "10px";
  const embeddedOn = Boolean(state.settings?.embeddedMode);

  // Lifecycle-relevant actions only (H5).
  if (!embeddedOn || lifecycle === "disabled") {
    actions.appendChild(
      button("Open FUT in browser", {
        className: "primary",
        icon: "open",
        onClick: handlers.onOpenFut
      })
    );
  } else if (lifecycle === "failed") {
    actions.appendChild(
      button("Reload FUT", {
        className: "primary",
        icon: "refresh",
        onClick: handlers.onReloadFut
      })
    );
    actions.appendChild(
      button("Disable Embedded", {
        className: "danger",
        onClick: handlers.onDisableEmbedded
      })
    );
    actions.appendChild(
      button("Open browser fallback", {
        icon: "open",
        onClick: handlers.onOpenBrowserFallback
      })
    );
  } else if (lifecycle === "login_required" || lifecycle === "starting") {
    actions.appendChild(
      button("Show FUT", {
        className: "primary",
        icon: "open",
        onClick: handlers.onOpenFut
      })
    );
    actions.appendChild(
      button("Reload FUT", {
        icon: "refresh",
        onClick: handlers.onReloadFut
      })
    );
  } else if (lifecycle === "ready") {
    actions.appendChild(
      button("Show FUT", {
        className: "primary",
        icon: "open",
        onClick: handlers.onOpenFut
      })
    );
    actions.appendChild(
      button("Reload FUT", {
        icon: "refresh",
        onClick: handlers.onReloadFut
      })
    );
  } else {
    actions.appendChild(
      button(embeddedOn ? "Show FUT window" : "Open FUT in browser", {
        className: "primary",
        icon: "open",
        onClick: handlers.onOpenFut
      })
    );
  }

  mode.appendChild(actions);
  wrap.appendChild(panel("Mode", mode));

  return wrap;
}

function renderExtension(state: AppState, handlers: UiHandlers): HTMLElement {
  const wrap = el("div");
  wrap.style.display = "flex";
  wrap.style.flexDirection = "column";
  wrap.style.gap = "14px";

  const body = el("div");
  body.appendChild(offlineBadge());
  const reason = el(
    "p",
    undefined,
    state.status?.extension.reason ??
      "Extension is not linked. Install and load the MV3 extension separately."
  );
  reason.style.marginTop = "12px";
  body.appendChild(reason);

  const steps = el("ul");
  for (const step of [
    "Load the unpacked extension from extension/ (or install a release ZIP).",
    "Open the EA FC Ultimate Team Web App and press F5 after reloading the extension.",
    "Companion will remain disconnected until Native Messaging (Phase 3+) is shipped."
  ]) {
    const li = el("li", undefined, step);
    steps.appendChild(li);
  }
  body.appendChild(steps);

  const row = el("div", "row");
  row.appendChild(
    button("Open FUT Web App", {
      className: "primary",
      icon: "open",
      onClick: handlers.onOpenFut
    })
  );
  body.appendChild(row);

  wrap.appendChild(panel("Extension link", body));
  return wrap;
}

function renderSettings(state: AppState, handlers: UiHandlers): HTMLElement {
  const settings = state.settings;
  const wrap = el("div");
  if (!settings) {
    wrap.appendChild(el("div", "empty-state", "Settings not loaded."));
    return wrap;
  }

  const form = el("div", "form-grid");

  // Theme
  {
    const field = el("div", "field");
    field.appendChild(el("label", undefined, "Theme"));
    const select = el("select") as HTMLSelectElement;
    for (const opt of ["system", "light", "dark"] as const) {
      const o = el("option", undefined, opt) as HTMLOptionElement;
      o.value = opt;
      if (settings.theme === opt) o.selected = true;
      select.appendChild(o);
    }
    select.addEventListener("change", () => handlers.onThemeChange(select.value));
    field.appendChild(select);
    field.appendChild(el("div", "hint", "Follows OS appearance when set to system."));
    form.appendChild(field);
  }

  // Preferred browser
  {
    const field = el("div", "field");
    field.appendChild(el("label", undefined, "Preferred browser label"));
    const select = el("select") as HTMLSelectElement;
    for (const opt of ["system", "chrome", "edge"] as const) {
      const o = el("option", undefined, opt) as HTMLOptionElement;
      o.value = opt;
      if (settings.preferredBrowser === opt) o.selected = true;
      select.appendChild(o);
    }
    select.addEventListener("change", () => handlers.onBrowserChange(select.value));
    field.appendChild(select);
    field.appendChild(
      el(
        "div",
        "hint",
        "Preferred browser label is stored for future use; open always uses the system default handler."
      )
    );
    form.appendChild(field);
  }

  // Locale hint
  {
    const field = el("div", "field");
    field.appendChild(el("label", undefined, "Locale hint"));
    const input = el("input") as HTMLInputElement;
    input.type = "text";
    input.value = settings.localeHint;
    input.placeholder = "e.g. en or zh-TW";
    input.maxLength = 32;
    input.addEventListener("change", () => handlers.onLocaleChange(input.value));
    field.appendChild(input);
    form.appendChild(field);
  }

  // Checkboxes
  {
    const field = el("div", "field");
    const label = el("label", "checkbox") as HTMLLabelElement;
    const cb = el("input") as HTMLInputElement;
    cb.type = "checkbox";
    cb.checked = settings.embeddedMode;
    cb.addEventListener("change", () => handlers.onEmbeddedModeChange(cb.checked));
    label.appendChild(cb);
    label.appendChild(
      document.createTextNode("Enable Embedded Mode (opt-in beta — FUT in-app WebView)")
    );
    field.appendChild(label);
    field.appendChild(
      el(
        "div",
        "hint",
        "Default is off. When on, Show FUT opens an isolated WebView (not Chrome). Requires Save. On macOS, quitting Companion clears the Embedded login session (non-persistent store) — you will need to sign in again."
      )
    );
    form.appendChild(field);
  }
  {
    const field = el("div", "field");
    const label = el("label", "checkbox") as HTMLLabelElement;
    const cb = el("input") as HTMLInputElement;
    cb.type = "checkbox";
    cb.checked = settings.openEmbeddedOnLaunch;
    cb.addEventListener("change", () =>
      handlers.onOpenEmbeddedOnLaunchChange(cb.checked)
    );
    label.appendChild(cb);
    label.appendChild(document.createTextNode("Open Embedded FUT on Companion launch"));
    field.appendChild(label);
    form.appendChild(field);
  }
  {
    const field = el("div", "field");
    const label = el("label", "checkbox") as HTMLLabelElement;
    const cb = el("input") as HTMLInputElement;
    cb.type = "checkbox";
    cb.checked = settings.openFutOnLaunch;
    cb.addEventListener("change", () => handlers.onOpenFutLaunchChange(cb.checked));
    label.appendChild(cb);
    label.appendChild(
      document.createTextNode("Open FUT (browser) on launch when Embedded is off")
    );
    field.appendChild(label);
    form.appendChild(field);
  }
  {
    const field = el("div", "field");
    const label = el("label", "checkbox") as HTMLLabelElement;
    const cb = el("input") as HTMLInputElement;
    cb.type = "checkbox";
    cb.checked = settings.diagnosticsIncludePlatform;
    cb.addEventListener("change", () =>
      handlers.onDiagnosticsPlatformChange(cb.checked)
    );
    label.appendChild(cb);
    label.appendChild(document.createTextNode("Include platform/arch in diagnostics"));
    field.appendChild(label);
    form.appendChild(field);
  }

  const actions = el("div", "row");
  actions.appendChild(
    button("Save settings", {
      className: "primary",
      onClick: handlers.onSaveSettings
    })
  );
  actions.appendChild(
    button("Reset to defaults", {
      className: "danger",
      onClick: handlers.onResetSettings
    })
  );
  actions.appendChild(
    button("Clear Embedded site data…", {
      className: "danger",
      onClick: handlers.onClearSiteData
    })
  );
  form.appendChild(actions);

  wrap.appendChild(panel("Local Companion settings", form));
  return wrap;
}

function renderDiagnostics(state: AppState, handlers: UiHandlers): HTMLElement {
  const wrap = el("div");
  wrap.style.display = "flex";
  wrap.style.flexDirection = "column";
  wrap.style.gap = "14px";

  const body = el("div");
  if (!state.diagnostics) {
    body.appendChild(el("div", "empty-state", "No diagnostics loaded."));
  } else {
    const d = state.diagnostics as DiagnosticsExport & {
      embeddedLifecycle?: string;
      embeddedWindowOpen?: boolean;
      embeddedRuntimeInstalled?: boolean;
      lastErrorCode?: string;
      runtimePack?: string[];
    };
    const emb = state.status?.embedded;
    const dl = el("dl", "kv");
    const rows: [string, string][] = [
      ["Connection", d.connection],
      ["Companion", d.companionVersion],
      ["Protocol", d.protocolVersion],
      ["Generated", new Date(d.generatedAt).toISOString()],
      ["Platform", d.platform ?? "(hidden)"],
      ["Arch", d.arch ?? "(hidden)"],
      [
        "Embedded lifecycle",
        d.embeddedLifecycle ?? emb?.lifecycle ?? "(unknown)"
      ],
      [
        "Embedded window",
        String(d.embeddedWindowOpen ?? emb?.windowOpen ?? false)
      ],
      [
        "Runtime installed",
        String(d.embeddedRuntimeInstalled ?? emb?.runtimeInstalled ?? false)
      ],
      ["Last error code", d.lastErrorCode ?? emb?.lastErrorCode ?? "(none)"],
      [
        "Runtime pack",
        (d.runtimePack ?? []).join(", ") || "(n/a)"
      ],
      ["Settings keys", d.settingsKeys.join(", ")]
    ];
    for (const [k, v] of rows) {
      dl.appendChild(el("dt", undefined, k));
      dl.appendChild(el("dd", undefined, v));
    }
    body.appendChild(dl);
    if (d.notes.length) {
      const notes = el("ul");
      for (const n of d.notes) notes.appendChild(el("li", undefined, n));
      body.appendChild(notes);
    }
  }

  const actions = el("div", "row");
  actions.style.marginTop = "10px";
  actions.appendChild(
    button("Export sanitized JSON", {
      icon: "export",
      onClick: handlers.onExportDiagnostics
    })
  );
  body.appendChild(actions);

  if (state.diagnosticsJson) {
    const pre = el("pre", "mono", state.diagnosticsJson);
    body.appendChild(pre);
  }

  wrap.appendChild(panel("Sanitized local status", body));
  return wrap;
}

function renderAbout(state: AppState): HTMLElement {
  const wrap = el("div");
  const body = el("div");
  body.appendChild(
    el(
      "p",
      undefined,
      "FSU Companion is a desktop shell for FSU. Extension Mode uses Chrome/Edge. Embedded Mode (opt-in beta) loads FUT in an isolated WebView with a packaged userscript — no remote JS execution."
    )
  );
  const limits = el("ul");
  for (const item of [
    "Native Messaging / live Extension link: not implemented (status stays offline).",
    "macOS Embedded login is non-persistent: quit requires re-login.",
    "Signed/notarized public installers require external credentials (beta builds may be ad-hoc).",
    "HTTP bridge is allowlisted GET only — not a generic proxy."
  ]) {
    limits.appendChild(el("li", undefined, item));
  }
  body.appendChild(limits);
  const dl = el("dl", "kv");
  const s = state.status;
  const pairs: [string, string][] = [
    ["Companion version", s?.companion.version ?? "—"],
    ["Protocol version", s?.companion.protocolVersion ?? "—"],
    ["Platform", s?.companion.platform ?? "—"],
    ["Architecture", s?.companion.arch ?? "—"],
    ["Extension link", "Disconnected (H8 not shipped)"],
    ["Update channel", "not_configured"]
  ];
  for (const [k, v] of pairs) {
    dl.appendChild(el("dt", undefined, k));
    dl.appendChild(el("dd", undefined, v));
  }
  body.appendChild(dl);
  wrap.appendChild(panel("About", body));
  return wrap;
}
