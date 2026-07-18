//! Singleton FUT WebViewWindow lifecycle with generation-isolated handshake.

use super::injection::{
    ensure_runtime_eval_script, initialization_script, parse_runtime_report, runtime_pack_summary,
    should_install_userscript,
};
use super::lifecycle::{Generation, LifecycleEvent, LifecycleMachine, HANDSHAKE_DEADLINE_MS};
use super::navigation_policy::{
    classify_url, decide_navigation, decide_new_window, fut_home_url, NavigationDecision, UrlClass,
    FUT_HOME_URL,
};
#[cfg(not(target_os = "macos"))]
use super::site_data::embedded_profile_dir;
use super::status::{EmbeddedLifecycle, EmbeddedStatus};
use std::path::Path;
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Mutex,
};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{
    webview::{NewWindowResponse, PageLoadEvent},
    AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};

pub const FUT_WINDOW_LABEL: &str = "fut";
static REPORT_TOKEN_SEQUENCE: AtomicU64 = AtomicU64::new(1);
static GENERATION_SEQUENCE: AtomicU64 = AtomicU64::new(1);

fn new_report_token() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    let sequence = REPORT_TOKEN_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    format!("{nanos:x}{sequence:x}")
}

fn next_generation() -> Generation {
    Generation {
        id: GENERATION_SEQUENCE.fetch_add(1, Ordering::Relaxed),
        token: new_report_token(),
    }
}

pub struct EmbeddedState {
    pub machine: LifecycleMachine,
    /// Host only (never full URL / query) of last blocked navigation.
    pub last_blocked_host: Option<String>,
}

impl Default for EmbeddedState {
    fn default() -> Self {
        Self::new_disabled()
    }
}

impl EmbeddedState {
    pub fn new_disabled() -> Self {
        Self {
            machine: LifecycleMachine::disabled(),
            last_blocked_host: None,
        }
    }
}

pub type SharedEmbedded = Mutex<EmbeddedState>;

fn update_state(app: &AppHandle, f: impl FnOnce(&mut EmbeddedState)) {
    if let Some(state) = app.try_state::<SharedEmbedded>() {
        if let Ok(mut guard) = state.lock() {
            f(&mut guard);
        }
    }
}

fn apply_event(app: &AppHandle, event: LifecycleEvent) {
    update_state(app, |st| {
        st.machine.apply(event);
        // Always annotate pack summary on ready/starting without tokens.
        if matches!(
            st.machine.status.lifecycle,
            EmbeddedLifecycle::Ready | EmbeddedLifecycle::Starting
        ) {
            let pack = format!("Pack: {}", runtime_pack_summary().join(", "));
            if !st
                .machine
                .status
                .notes
                .iter()
                .any(|n| n.starts_with("Pack:"))
            {
                st.machine.status.notes.push(pack);
            }
        }
    });
}

pub fn get_status(app: &AppHandle) -> EmbeddedStatus {
    app.try_state::<SharedEmbedded>()
        .and_then(|s| s.lock().ok().map(|g| g.machine.status.clone()))
        .unwrap_or_else(EmbeddedStatus::disabled)
}

pub fn get_last_blocked_host(app: &AppHandle) -> Option<String> {
    app.try_state::<SharedEmbedded>()
        .and_then(|s| s.lock().ok().and_then(|g| g.last_blocked_host.clone()))
}

fn schedule_handshake_watchdog(app: AppHandle, generation_id: u64) {
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(HANDSHAKE_DEADLINE_MS));
        apply_event(&app, LifecycleEvent::Timeout { generation_id });
    });
}

fn begin_fut_handshake(app: &AppHandle, window: &WebviewWindow) {
    let generation = next_generation();
    let gen_id = generation.id;
    let token = generation.token.clone();
    apply_event(
        app,
        LifecycleEvent::FutPageStarted {
            generation: generation.clone(),
        },
    );
    if let Err(error) = window.eval(ensure_runtime_eval_script(&token)) {
        apply_event(
            app,
            LifecycleEvent::Failed {
                generation_id: gen_id,
                token,
                code: "RUNTIME_EVAL_FAILED".into(),
            },
        );
        update_state(app, |st| {
            st.machine.status.last_error_message = Some(
                format!("Runtime evaluation failed: {error}")
                    .chars()
                    .take(200)
                    .collect(),
            );
        });
        return;
    }
    schedule_handshake_watchdog(app.clone(), gen_id);
}

/// Show existing FUT window or create the singleton.
pub fn show_or_create_fut(
    app: &AppHandle,
    _app_data: &Path,
    full_runtime: bool,
) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window(FUT_WINDOW_LABEL) {
        let _ = existing.show();
        let _ = existing.unminimize();
        let _ = existing.set_focus();
        update_state(app, |st| {
            st.machine.status.window_open = true;
            st.machine.status.embedded_mode = true;
        });
        return Ok(());
    }

    apply_event(app, LifecycleEvent::EnableShow);

    #[cfg(not(target_os = "macos"))]
    let profile = {
        let profile = embedded_profile_dir(_app_data);
        std::fs::create_dir_all(&profile).map_err(|e| format!("profile dir: {e}"))?;
        profile
    };

    let home = fut_home_url();
    // Bootstrap token only for first document; each FUT load replaces via begin_fut_handshake.
    let bootstrap_token = new_report_token();
    let init = initialization_script(full_runtime, &bootstrap_token);
    let app_handle = app.clone();
    let app_for_nav = app.clone();
    let app_for_popup = app.clone();

    let builder = WebviewWindowBuilder::new(app, FUT_WINDOW_LABEL, WebviewUrl::External(home))
        .title("FSU · FUT")
        .inner_size(1280.0, 800.0)
        .min_inner_size(960.0, 600.0)
        .resizable(true)
        .initialization_script(&init);

    // WKWebView ignores data_directory. Non-persistent store keeps clear/logout
    // deterministic on every supported macOS version (H4 fallback).
    #[cfg(target_os = "macos")]
    let builder = builder.incognito(true);
    #[cfg(not(target_os = "macos"))]
    let builder = builder.data_directory(profile);

    let builder = builder
        .on_navigation(move |url| {
            let decision = decide_navigation(url.as_str());
            match decision {
                NavigationDecision::Allow => true,
                NavigationDecision::Deny | NavigationDecision::ExternalBlocked => {
                    let host = url.host_str().unwrap_or("invalid").to_string();
                    update_state(&app_for_nav, |st| {
                        st.last_blocked_host = Some(host.clone());
                        st.machine.status.last_error_code =
                            Some(if decision == NavigationDecision::ExternalBlocked {
                                "NAV_EXTERNAL_BLOCKED".into()
                            } else {
                                "NAV_DENIED".into()
                            });
                        st.machine.status.last_error_message =
                            Some(format!("Blocked navigation host: {host}"));
                        st.machine.status.notes.push(format!(
                            "Navigation blocked ({host}). No secrets or full URL stored."
                        ));
                        if st.machine.status.notes.len() > 12 {
                            let drain = st.machine.status.notes.len() - 12;
                            st.machine.status.notes.drain(0..drain);
                        }
                    });
                    false
                }
            }
        })
        .on_new_window(
            move |url, _features| match decide_new_window(url.as_str()) {
                NavigationDecision::Allow => {
                    if let Some(window) = app_for_popup.get_webview_window(FUT_WINDOW_LABEL) {
                        if let Ok(encoded) = serde_json::to_string(url.as_str()) {
                            let _ = window.eval(format!("window.location.href = {encoded};"));
                        }
                    }
                    NewWindowResponse::Deny
                }
                NavigationDecision::Deny | NavigationDecision::ExternalBlocked => {
                    NewWindowResponse::Deny
                }
            },
        )
        .on_document_title_changed(move |window, title| {
            let handle = window.app_handle().clone();
            let active = handle
                .try_state::<SharedEmbedded>()
                .and_then(|s| s.lock().ok().and_then(|g| g.machine.active.clone()));
            let Some(active) = active else {
                return;
            };
            let Some(ready) = parse_runtime_report(&title, &active.token) else {
                return;
            };
            if ready {
                apply_event(
                    &handle,
                    LifecycleEvent::Ready {
                        generation_id: active.id,
                        token: active.token,
                    },
                );
            } else {
                apply_event(
                    &handle,
                    LifecycleEvent::Failed {
                        generation_id: active.id,
                        token: active.token,
                        code: "RUNTIME_INSTALL_FAILED".into(),
                    },
                );
            }
        })
        .on_page_load(move |window, payload| {
            if payload.event() != PageLoadEvent::Finished {
                return;
            }
            let url = payload.url().to_string();
            let handle = window.app_handle().clone();
            if should_install_userscript(&url) {
                begin_fut_handshake(&handle, &window);
            } else if matches!(classify_url(&url), UrlClass::EaAuth | UrlClass::EaAccount) {
                apply_event(&handle, LifecycleEvent::AuthPage);
            }
        });

    let window = builder.build().map_err(|e| {
        update_state(&app_handle, |st| {
            st.machine.status =
                EmbeddedStatus::disabled().with_error("EMBEDDED_WINDOW_CREATE", &e.to_string());
            st.machine.status.embedded_mode = true;
            st.machine.status.notes =
                vec!["Failed to create FUT window. Use Extension Mode fallback.".into()];
            st.machine.active = None;
        });
        format!("create fut window: {e}")
    })?;

    wire_close_handler(&window, app.clone());
    update_state(app, |st| {
        st.machine.status.window_open = true;
        if st.machine.status.lifecycle == EmbeddedLifecycle::Starting {
            // First paint often lands on login; auth/FUT page handlers refine state.
            st.machine.status.lifecycle = EmbeddedLifecycle::LoginRequired;
        }
    });
    Ok(())
}

fn wire_close_handler(window: &WebviewWindow, app: AppHandle) {
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            if let Some(w) = app.get_webview_window(FUT_WINDOW_LABEL) {
                let _ = w.hide();
            }
            update_state(&app, |st| {
                st.machine.status.window_open = false;
            });
        }
    });
}

pub fn reload_fut(app: &AppHandle) -> Result<(), String> {
    let Some(window) = app.get_webview_window(FUT_WINDOW_LABEL) else {
        return Err("FUT window is not open".into());
    };
    apply_event(app, LifecycleEvent::Reload);
    window
        .eval(format!(
            "window.location.href = {};",
            serde_json::to_string(FUT_HOME_URL).unwrap()
        ))
        .map_err(|e| format!("reload: {e}"))?;
    Ok(())
}

pub fn navigate_home(app: &AppHandle) -> Result<(), String> {
    reload_fut(app)
}

pub fn go_back(app: &AppHandle) -> Result<(), String> {
    let Some(window) = app.get_webview_window(FUT_WINDOW_LABEL) else {
        return Err("FUT window is not open".into());
    };
    window
        .eval("window.history.back()")
        .map_err(|e| format!("back: {e}"))?;
    Ok(())
}

pub fn go_forward(app: &AppHandle) -> Result<(), String> {
    let Some(window) = app.get_webview_window(FUT_WINDOW_LABEL) else {
        return Err("FUT window is not open".into());
    };
    window
        .eval("window.history.forward()")
        .map_err(|e| format!("forward: {e}"))?;
    Ok(())
}

pub fn hide_fut(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(FUT_WINDOW_LABEL) {
        let _ = window.hide();
        update_state(app, |st| {
            st.machine.status.window_open = false;
        });
    }
}

pub fn close_fut(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(FUT_WINDOW_LABEL) {
        let _ = window.destroy();
    }
    apply_event(app, LifecycleEvent::Disable);
    update_state(app, |st| {
        // Preserve that destroy was for clear/disable; status already disabled.
        st.machine.status.window_open = false;
        st.machine.status.runtime_installed = false;
    });
}

/// Public for disable path when only flag flips.
pub fn mark_disabled(app: &AppHandle) {
    apply_event(app, LifecycleEvent::Disable);
}
