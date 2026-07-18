//! Companion-local settings store (allowlist + atomic write).

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;

pub const COMPANION_VERSION: &str = env!("CARGO_PKG_VERSION");
pub const PROTOCOL_VERSION: &str = "1.0";
pub const FUT_WEB_APP_URL: &str = "https://www.ea.com/ea-sports-fc/ultimate-team/web-app/";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
pub struct CompanionSettings {
    pub theme: String,
    pub open_fut_on_launch: bool,
    pub preferred_browser: String,
    pub diagnostics_include_platform: bool,
    pub locale_hint: String,
    /// Opt-in Embedded FUT WebView (default false — feasibility beta).
    pub embedded_mode: bool,
    /// When Embedded Mode is on, open the FUT window on launch.
    pub open_embedded_on_launch: bool,
}

impl Default for CompanionSettings {
    fn default() -> Self {
        Self {
            theme: "system".into(),
            open_fut_on_launch: false,
            preferred_browser: "system".into(),
            diagnostics_include_platform: true,
            locale_hint: String::new(),
            embedded_mode: false,
            open_embedded_on_launch: true,
        }
    }
}

#[derive(Debug, Error)]
pub enum SettingsError {
    #[error("unknown setting key: {0}")]
    UnknownKey(String),
    #[error("invalid setting value for {0}")]
    InvalidValue(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
}

fn validate_theme(value: &str) -> bool {
    matches!(value, "system" | "light" | "dark")
}

fn validate_browser(value: &str) -> bool {
    matches!(value, "system" | "chrome" | "edge")
}

fn validate_locale(value: &str) -> bool {
    value.len() <= 32
        && value
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'))
}

/// Merge a JSON object of settings updates; fail closed on unknown keys.
pub fn apply_settings_patch(
    current: &CompanionSettings,
    patch: &serde_json::Value,
) -> Result<CompanionSettings, SettingsError> {
    let obj = patch
        .as_object()
        .ok_or_else(|| SettingsError::InvalidValue("settings".into()))?;

    if obj.is_empty() {
        return Err(SettingsError::InvalidValue("settings empty".into()));
    }

    let mut next = current.clone();

    for (key, value) in obj {
        match key.as_str() {
            "theme" => {
                let v = value
                    .as_str()
                    .ok_or_else(|| SettingsError::InvalidValue("theme".into()))?;
                if !validate_theme(v) {
                    return Err(SettingsError::InvalidValue("theme".into()));
                }
                next.theme = v.to_string();
            }
            "openFutOnLaunch" => {
                next.open_fut_on_launch = value
                    .as_bool()
                    .ok_or_else(|| SettingsError::InvalidValue("openFutOnLaunch".into()))?;
            }
            "preferredBrowser" => {
                let v = value
                    .as_str()
                    .ok_or_else(|| SettingsError::InvalidValue("preferredBrowser".into()))?;
                if !validate_browser(v) {
                    return Err(SettingsError::InvalidValue("preferredBrowser".into()));
                }
                next.preferred_browser = v.to_string();
            }
            "diagnosticsIncludePlatform" => {
                next.diagnostics_include_platform = value.as_bool().ok_or_else(|| {
                    SettingsError::InvalidValue("diagnosticsIncludePlatform".into())
                })?;
            }
            "localeHint" => {
                let v = value
                    .as_str()
                    .ok_or_else(|| SettingsError::InvalidValue("localeHint".into()))?;
                if !validate_locale(v) {
                    return Err(SettingsError::InvalidValue("localeHint".into()));
                }
                next.locale_hint = v.to_string();
            }
            "embeddedMode" => {
                next.embedded_mode = value
                    .as_bool()
                    .ok_or_else(|| SettingsError::InvalidValue("embeddedMode".into()))?;
            }
            "openEmbeddedOnLaunch" => {
                next.open_embedded_on_launch = value
                    .as_bool()
                    .ok_or_else(|| SettingsError::InvalidValue("openEmbeddedOnLaunch".into()))?;
            }
            other => return Err(SettingsError::UnknownKey(other.to_string())),
        }
    }

    Ok(next)
}

pub fn settings_path(base: &Path) -> PathBuf {
    base.join("settings.json")
}

pub fn load_settings(base: &Path) -> Result<CompanionSettings, SettingsError> {
    let path = settings_path(base);
    if !path.exists() {
        return Ok(CompanionSettings::default());
    }
    let raw = fs::read_to_string(path)?;
    let settings: CompanionSettings = serde_json::from_str(&raw)?;
    // Re-validate on load
    if !validate_theme(&settings.theme)
        || !validate_browser(&settings.preferred_browser)
        || !validate_locale(&settings.locale_hint)
    {
        return Ok(CompanionSettings::default());
    }
    Ok(settings)
}

#[cfg(not(windows))]
fn replace_file(tmp: &Path, path: &Path) -> std::io::Result<()> {
    fs::rename(tmp, path)
}

#[cfg(windows)]
fn replace_file(tmp: &Path, path: &Path) -> std::io::Result<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };

    let tmp_wide: Vec<u16> = tmp.as_os_str().encode_wide().chain(Some(0)).collect();
    let path_wide: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
    let result = unsafe {
        MoveFileExW(
            tmp_wide.as_ptr(),
            path_wide.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if result == 0 {
        Err(std::io::Error::last_os_error())
    } else {
        Ok(())
    }
}

/// Atomic write on the same filesystem, including replacement on Windows.
pub fn save_settings(base: &Path, settings: &CompanionSettings) -> Result<(), SettingsError> {
    fs::create_dir_all(base)?;
    let path = settings_path(base);
    let tmp = base.join(format!("settings.json.{}.tmp", std::process::id()));
    let data = serde_json::to_string_pretty(settings)?;
    fs::write(&tmp, data)?;
    if let Err(error) = replace_file(&tmp, &path) {
        let _ = fs::remove_file(&tmp);
        return Err(error.into());
    }
    Ok(())
}

pub fn reset_settings(base: &Path) -> Result<CompanionSettings, SettingsError> {
    let defaults = CompanionSettings::default();
    save_settings(base, &defaults)?;
    Ok(defaults)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn matches_shared_protocol_contract() {
        let contract: serde_json::Value =
            serde_json::from_str(include_str!("../../../shared/protocol/contract.json")).unwrap();
        assert_eq!(contract["protocolVersion"], PROTOCOL_VERSION);
        assert_eq!(
            contract["settings"]["defaults"],
            serde_json::to_value(CompanionSettings::default()).unwrap()
        );
        assert_eq!(
            contract["settings"]["keys"],
            serde_json::json!([
                "theme",
                "openFutOnLaunch",
                "preferredBrowser",
                "diagnosticsIncludePlatform",
                "localeHint",
                "embeddedMode",
                "openEmbeddedOnLaunch"
            ])
        );
    }

    #[test]
    fn rejects_unknown_key() {
        let current = CompanionSettings::default();
        let patch = serde_json::json!({ "evil": true });
        let err = apply_settings_patch(&current, &patch).unwrap_err();
        assert!(matches!(err, SettingsError::UnknownKey(_)));
    }

    #[test]
    fn atomic_valid_patch() {
        let current = CompanionSettings::default();
        let patch = serde_json::json!({
            "theme": "dark",
            "openFutOnLaunch": true
        });
        let next = apply_settings_patch(&current, &patch).unwrap();
        assert_eq!(next.theme, "dark");
        assert!(next.open_fut_on_launch);
        assert_eq!(next.preferred_browser, "system");
    }

    #[test]
    fn roundtrip_file() {
        let dir = tempdir().unwrap();
        let settings = CompanionSettings {
            theme: "light".into(),
            ..CompanionSettings::default()
        };
        save_settings(dir.path(), &settings).unwrap();
        let loaded = load_settings(dir.path()).unwrap();
        assert_eq!(loaded, settings);
    }

    #[test]
    fn repeated_save_replaces_existing_file() {
        let dir = tempdir().unwrap();
        let mut settings = CompanionSettings::default();
        save_settings(dir.path(), &settings).unwrap();
        settings.theme = "dark".into();
        save_settings(dir.path(), &settings).unwrap();
        assert_eq!(load_settings(dir.path()).unwrap(), settings);
    }

    #[test]
    fn rejects_unknown_persisted_key() {
        let dir = tempdir().unwrap();
        fs::write(
            settings_path(dir.path()),
            r#"{
                "theme": "system",
                "openFutOnLaunch": false,
                "preferredBrowser": "system",
                "diagnosticsIncludePlatform": true,
                "localeHint": "",
                "unknown": true
            }"#,
        )
        .unwrap();
        assert!(matches!(
            load_settings(dir.path()),
            Err(SettingsError::Json(_))
        ));
    }

    #[test]
    fn migrates_pre_embedded_settings() {
        let dir = tempdir().unwrap();
        fs::write(
            settings_path(dir.path()),
            r#"{
                "theme": "dark",
                "openFutOnLaunch": true,
                "preferredBrowser": "system",
                "diagnosticsIncludePlatform": true,
                "localeHint": "zh-TW"
            }"#,
        )
        .unwrap();

        let loaded = load_settings(dir.path()).unwrap();
        assert_eq!(loaded.theme, "dark");
        assert!(loaded.open_fut_on_launch);
        assert!(!loaded.embedded_mode);
        assert!(loaded.open_embedded_on_launch);
    }

    #[test]
    fn reset_writes_defaults() {
        let dir = tempdir().unwrap();
        let s = CompanionSettings {
            theme: "dark".into(),
            ..CompanionSettings::default()
        };
        save_settings(dir.path(), &s).unwrap();
        let reset = reset_settings(dir.path()).unwrap();
        assert_eq!(reset, CompanionSettings::default());
    }
}
