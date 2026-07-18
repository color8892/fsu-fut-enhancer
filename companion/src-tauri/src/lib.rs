mod diagnostics;
mod embedded;
mod settings;

use diagnostics::{assert_safe, attach_embedded_status, build_diagnostics, DiagnosticsExport};
use embedded::http_bridge::embedded_http_request;
use embedded::injection::runtime_pack_summary;
use embedded::{
    clear_embedded_site_data, close_fut, get_status as get_embedded_status, go_back, go_forward,
    hide_fut, mark_disabled, navigate_home, reload_fut, show_or_create_fut, EmbeddedState,
    SharedEmbedded, FUT_HOME_URL,
};
use settings::{
    apply_settings_patch, load_settings, reset_settings, save_settings, CompanionSettings,
    COMPANION_VERSION, FUT_WEB_APP_URL, PROTOCOL_VERSION,
};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};
use tauri_plugin_opener::OpenerExt;

fn app_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("app data dir: {e}"))
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct CompanionStatus {
    connection: String,
    extension: ExtensionStatus,
    companion: CompanionInfo,
    embedded: embedded::EmbeddedStatus,
}

#[derive(serde::Serialize)]
struct ExtensionStatus {
    connected: bool,
    reason: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct CompanionInfo {
    version: String,
    protocol_version: String,
    platform: String,
    arch: String,
}

#[tauri::command]
fn get_companion_status(app: tauri::AppHandle) -> CompanionStatus {
    let embedded = get_embedded_status(&app);
    CompanionStatus {
        connection: "offline".into(),
        extension: ExtensionStatus {
            connected: false,
            reason: "Native Messaging host not implemented. Use Extension or Embedded Mode.".into(),
        },
        companion: CompanionInfo {
            version: COMPANION_VERSION.into(),
            protocol_version: PROTOCOL_VERSION.into(),
            platform: std::env::consts::OS.into(),
            arch: std::env::consts::ARCH.into(),
        },
        embedded,
    }
}

#[tauri::command]
fn get_settings(app: tauri::AppHandle) -> Result<CompanionSettings, String> {
    let dir = app_data_dir(&app)?;
    load_settings(&dir).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_settings(
    app: tauri::AppHandle,
    patch: serde_json::Value,
) -> Result<CompanionSettings, String> {
    let dir = app_data_dir(&app)?;
    let current = load_settings(&dir).map_err(|e| e.to_string())?;
    let next = apply_settings_patch(&current, &patch).map_err(|e| e.to_string())?;
    save_settings(&dir, &next).map_err(|e| e.to_string())?;

    if current.embedded_mode && !next.embedded_mode {
        close_fut(&app);
        mark_disabled(&app);
    }
    Ok(next)
}

#[tauri::command]
fn reset_companion_settings(app: tauri::AppHandle) -> Result<CompanionSettings, String> {
    let dir = app_data_dir(&app)?;
    let defaults = reset_settings(&dir).map_err(|e| e.to_string())?;
    close_fut(&app);
    mark_disabled(&app);
    Ok(defaults)
}

#[tauri::command]
fn get_diagnostics(app: tauri::AppHandle) -> Result<DiagnosticsExport, String> {
    let dir = app_data_dir(&app)?;
    let settings = load_settings(&dir).map_err(|e| e.to_string())?;
    let mut export = build_diagnostics(&settings, "offline", now_ms());
    let emb = get_embedded_status(&app);
    let lifecycle = format!("{:?}", emb.lifecycle).to_ascii_lowercase();
    attach_embedded_status(
        &mut export,
        &lifecycle,
        emb.window_open,
        emb.runtime_installed,
        emb.last_error_code.clone(),
        runtime_pack_summary(),
    );
    if let Some(host) = embedded::window::get_last_blocked_host(&app) {
        export
            .notes
            .push(format!("Last blocked host (no path/query): {host}"));
    }
    for n in emb.notes.into_iter().take(6) {
        if !export.notes.iter().any(|x| x == &n) {
            export.notes.push(n);
        }
    }
    assert_safe(&export)?;
    Ok(export)
}

#[tauri::command]
fn export_diagnostics_json(app: tauri::AppHandle) -> Result<String, String> {
    let export = get_diagnostics(app)?;
    serde_json::to_string_pretty(&export).map_err(|e| e.to_string())
}

/// Open FUT: Embedded window when enabled; otherwise system browser (Extension fallback path).
#[tauri::command]
fn open_fut_web_app(app: tauri::AppHandle, url: Option<String>) -> Result<String, String> {
    // Ignore arbitrary frontend URLs for Embedded path; only fixed home is used.
    let _ignored_url = url;
    let dir = app_data_dir(&app)?;
    let settings = load_settings(&dir).map_err(|e| e.to_string())?;

    if settings.embedded_mode {
        show_or_create_fut(&app, &dir, true)?;
        return Ok(FUT_HOME_URL.to_string());
    }

    open_fut_browser_fallback(app)
}

/// Always open the allowlisted FUT URL in the system browser (Extension path).
/// Used for recovery when Embedded fails; ignores embeddedMode.
#[tauri::command]
fn open_fut_browser_fallback(app: tauri::AppHandle) -> Result<String, String> {
    app.opener()
        .open_url(FUT_WEB_APP_URL, None::<&str>)
        .map_err(|e| format!("failed to open browser: {e}"))?;
    Ok(FUT_WEB_APP_URL.to_string())
}

#[tauri::command]
fn show_embedded_fut(app: tauri::AppHandle) -> Result<String, String> {
    let dir = app_data_dir(&app)?;
    let settings = load_settings(&dir).map_err(|e| e.to_string())?;
    if !settings.embedded_mode {
        return Err("embeddedMode is disabled".into());
    }
    show_or_create_fut(&app, &dir, true)?;
    Ok(FUT_HOME_URL.to_string())
}

#[tauri::command]
fn reload_embedded_fut(app: tauri::AppHandle) -> Result<(), String> {
    reload_fut(&app)
}

#[tauri::command]
fn embedded_go_back(app: tauri::AppHandle) -> Result<(), String> {
    go_back(&app)
}

#[tauri::command]
fn embedded_go_forward(app: tauri::AppHandle) -> Result<(), String> {
    go_forward(&app)
}

#[tauri::command]
fn embedded_go_home(app: tauri::AppHandle) -> Result<(), String> {
    navigate_home(&app)
}

#[tauri::command]
fn hide_embedded_fut(app: tauri::AppHandle) {
    hide_fut(&app);
}

#[tauri::command]
fn get_embedded_status_cmd(app: tauri::AppHandle) -> embedded::EmbeddedStatus {
    get_embedded_status(&app)
}

/// Clear Embedded site data after UI confirmation. Does not clear Companion settings.
#[tauri::command]
fn clear_embedded_site_data_cmd(app: tauri::AppHandle, confirm: bool) -> Result<(), String> {
    if !confirm {
        return Err("confirmation required".into());
    }
    close_fut(&app);
    let dir = app_data_dir(&app)?;
    clear_embedded_site_data(&dir)?;
    Ok(())
}

#[tauri::command]
fn check_update_status() -> serde_json::Value {
    serde_json::json!({
        "status": "not_configured",
        "currentVersion": COMPANION_VERSION,
        "message": "Update channel is not configured."
    })
}

/// Privileged main-only command used in capability isolation tests.
/// Must never be available to the `fut` window.
#[tauri::command]
fn privileged_main_only_ping() -> String {
    "main-ok".into()
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn setup_tray(app: &mut tauri::App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show Settings", true, None::<&str>)?;
    let show_fut = MenuItem::with_id(app, "show_fut", "Show FUT", true, None::<&str>)?;
    let reload_fut_item = MenuItem::with_id(app, "reload_fut", "Reload FUT", true, None::<&str>)?;
    let open_browser = MenuItem::with_id(
        app,
        "open_browser",
        "Open FUT in Browser",
        true,
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[&show_fut, &show, &reload_fut_item, &open_browser, &quit],
    )?;

    let mut tray = TrayIconBuilder::with_id("fsu-companion")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("FSU Companion")
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => show_main_window(app),
            "show_fut" => {
                if let Ok(dir) = app_data_dir(app) {
                    if let Ok(settings) = load_settings(&dir) {
                        if settings.embedded_mode {
                            let _ = show_or_create_fut(app, &dir, true);
                            return;
                        }
                    }
                }
                let _ = app.opener().open_url(FUT_WEB_APP_URL, None::<&str>);
            }
            "reload_fut" => {
                let _ = reload_fut(app);
            }
            "open_browser" => {
                let _ = app.opener().open_url(FUT_WEB_APP_URL, None::<&str>);
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Mutex::new(EmbeddedState::new_disabled()) as SharedEmbedded)
        .setup(|app| {
            setup_tray(app)?;
            // Opt-in auto-open Embedded FUT when enabled.
            let handle = app.handle().clone();
            if let Ok(dir) = app_data_dir(&handle) {
                if let Ok(settings) = load_settings(&dir) {
                    if settings.embedded_mode && settings.open_embedded_on_launch {
                        let _ = show_or_create_fut(&handle, &dir, true);
                    }
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_companion_status,
            get_settings,
            update_settings,
            reset_companion_settings,
            get_diagnostics,
            export_diagnostics_json,
            open_fut_web_app,
            open_fut_browser_fallback,
            show_embedded_fut,
            reload_embedded_fut,
            embedded_go_back,
            embedded_go_forward,
            embedded_go_home,
            hide_embedded_fut,
            get_embedded_status_cmd,
            clear_embedded_site_data_cmd,
            check_update_status,
            embedded_http_request,
            privileged_main_only_ping
        ])
        .run(tauri::generate_context!())
        .expect("error while running FSU Companion");
}

#[cfg(test)]
mod tests {
    use super::*;
    use embedded::navigation_policy::{decide_navigation, NavigationDecision};

    #[test]
    fn fut_url_policy_matrix_smoke() {
        assert_eq!(decide_navigation(FUT_HOME_URL), NavigationDecision::Allow);
        assert_eq!(
            decide_navigation("https://evil.example/"),
            NavigationDecision::ExternalBlocked
        );
    }

    #[test]
    fn privileged_ping_is_main_only_symbol() {
        // Compile-time presence of the command; capability isolation is enforced by
        // capabilities/fut.json omitting this command for the fut window.
        assert_eq!(privileged_main_only_ping(), "main-ok");
    }
}
