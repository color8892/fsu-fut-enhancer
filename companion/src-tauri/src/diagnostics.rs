//! Sanitized diagnostics — never include secrets or home paths.

use crate::settings::{CompanionSettings, COMPANION_VERSION, PROTOCOL_VERSION};
use serde::Serialize;
use std::env::consts::{ARCH, OS};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsExport {
    pub generated_at: u64,
    pub companion_version: String,
    pub protocol_version: String,
    pub connection: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub platform: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub arch: Option<String>,
    pub settings_keys: Vec<String>,
    pub notes: Vec<String>,
    /// Embedded lifecycle label only (no URLs).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub embedded_lifecycle: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub embedded_window_open: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub embedded_runtime_installed: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub runtime_pack: Option<Vec<String>>,
}

const SENSITIVE: &[&str] = &[
    "cookie",
    "session",
    "x-ut-sid",
    "authorization",
    "password",
    "token",
    "home/",
    "users/",
    "\\users\\",
];

fn looks_sensitive(text: &str) -> bool {
    let lower = text.to_ascii_lowercase();
    SENSITIVE.iter().any(|s| lower.contains(s))
}

fn sanitize_label(value: &str) -> String {
    let cleaned: String = value
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '+' | '-'))
        .take(64)
        .collect();
    if cleaned.is_empty() {
        "unknown".into()
    } else {
        cleaned
    }
}

pub fn build_diagnostics(
    settings: &CompanionSettings,
    connection: &str,
    now_ms: u64,
) -> DiagnosticsExport {
    let mut notes = vec![
        "Extension IPC is not connected (Native Messaging not implemented).".into(),
        "Export excludes secrets, account material, filesystem paths, and process env dumps."
            .into(),
    ];

    let mut export = DiagnosticsExport {
        generated_at: now_ms,
        companion_version: if looks_sensitive(COMPANION_VERSION) {
            "[redacted]".into()
        } else {
            COMPANION_VERSION.into()
        },
        protocol_version: PROTOCOL_VERSION.into(),
        connection: connection.into(),
        platform: None,
        arch: None,
        settings_keys: vec![
            "theme".into(),
            "openFutOnLaunch".into(),
            "preferredBrowser".into(),
            "diagnosticsIncludePlatform".into(),
            "localeHint".into(),
            "embeddedMode".into(),
            "openEmbeddedOnLaunch".into(),
        ],
        notes: notes.clone(),
        embedded_lifecycle: Some(if settings.embedded_mode {
            "enabled_flag".into()
        } else {
            "disabled".into()
        }),
        embedded_window_open: None,
        embedded_runtime_installed: None,
        last_error_code: None,
        runtime_pack: None,
    };

    if settings.diagnostics_include_platform {
        export.platform = Some(sanitize_label(OS));
        export.arch = Some(sanitize_label(ARCH));
    } else {
        notes.push("Platform details hidden by settings.".into());
        export.notes = notes;
    }

    export
}

/// Attach live Embedded status fields (host-only, no URLs).
pub fn attach_embedded_status(
    export: &mut DiagnosticsExport,
    lifecycle: &str,
    window_open: bool,
    runtime_installed: bool,
    last_error_code: Option<String>,
    runtime_pack: Vec<String>,
) {
    export.embedded_lifecycle = Some(sanitize_label(lifecycle));
    export.embedded_window_open = Some(window_open);
    export.embedded_runtime_installed = Some(runtime_installed);
    export.last_error_code = last_error_code
        .filter(|c| !c.is_empty())
        .map(|c| sanitize_label(&c));
    export.runtime_pack = Some(runtime_pack);
}

pub fn assert_safe(export: &DiagnosticsExport) -> Result<(), String> {
    let text = serde_json::to_string(export).map_err(|e| e.to_string())?;
    if looks_sensitive(&text) {
        return Err("diagnostics failed redaction".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn export_is_safe() {
        let settings = CompanionSettings::default();
        let diag = build_diagnostics(&settings, "offline", 1_700_000_000_000);
        assert_eq!(diag.connection, "offline");
        assert!(diag.platform.is_some());
        assert_safe(&diag).unwrap();
        let text = serde_json::to_string(&diag).unwrap();
        assert!(!text.to_ascii_lowercase().contains("cookie"));
        assert!(!text.contains("HOME"));
    }

    #[test]
    fn embedded_attach_redacts_error_codes_only() {
        let settings = CompanionSettings::default();
        let mut diag = build_diagnostics(&settings, "offline", 1);
        attach_embedded_status(
            &mut diag,
            "failed",
            false,
            false,
            Some("RUNTIME_HANDSHAKE_TIMEOUT".into()),
            vec!["lodash".into(), "userscript".into()],
        );
        assert_eq!(
            diag.last_error_code.as_deref(),
            Some("RUNTIME_HANDSHAKE_TIMEOUT")
        );
        assert_safe(&diag).unwrap();
        let text = serde_json::to_string(&diag).unwrap();
        assert!(!text.contains("?"));
        assert!(!text.contains("https://"));
        assert!(!text.to_ascii_lowercase().contains("x-ut-sid"));
    }

    #[test]
    fn sensitive_error_code_is_sanitized() {
        let settings = CompanionSettings::default();
        let mut diag = build_diagnostics(&settings, "offline", 1);
        // Path-like or query-like values must not pass through as-is.
        attach_embedded_status(
            &mut diag,
            "failed",
            false,
            false,
            Some("ERR/with?query=1".into()),
            vec![],
        );
        let code = diag.last_error_code.unwrap();
        assert!(!code.contains('?'));
        assert!(!code.contains('/'));
    }
}
