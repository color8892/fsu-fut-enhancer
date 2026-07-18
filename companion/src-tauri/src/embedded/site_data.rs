//! Clear Embedded WebView site data after explicit user confirmation.
//! Does not touch Companion settings or Extension storage.
//!
//! ## H4 platform strategy (feasibility gate)
//!
//! | Platform   | Strategy |
//! |------------|----------|
//! | macOS 11–13 | Non-persistent WKWebView (`incognito`); quit clears login |
//! | macOS 14+   | Custom data-store identifier **not enabled** until Tauri/Wry
//! |             | exposes a reliable API to create + clear only that store without
//! |             | falling back to the shared default WKWebsiteDataStore |
//! | Windows     | Isolated WebView2 profile under `embedded-webview-profile/` |
//! | Linux       | Isolated profile directory where supported |
//!
//! Gate status: **not passed** for persistent custom store on macOS.
//! We keep non-persistent macOS store; UI documents re-login after quit.
//! Never import Safari/Chrome profiles or use the default shared store.

use std::fs;
use std::path::{Path, PathBuf};
use std::thread;
use std::time::Duration;

pub fn embedded_profile_dir(app_data: &Path) -> PathBuf {
    app_data.join("embedded-webview-profile")
}

/// Remove the Embedded WebView persistent profile directory where supported.
/// On macOS this also removes any legacy unused profile from older builds.
/// Safe to call if the directory does not exist.
pub fn clear_embedded_site_data(app_data: &Path) -> Result<(), String> {
    let dir = embedded_profile_dir(app_data);
    if !dir.exists() {
        return Ok(());
    }
    for attempt in 0..5 {
        match fs::remove_dir_all(&dir) {
            Ok(()) => return Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
            Err(_) if attempt < 4 => thread::sleep(Duration::from_millis(100)),
            Err(error) => return Err(format!("clear site data failed: {error}")),
        }
    }
    unreachable!("site-data retry loop always returns")
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn clear_missing_is_ok() {
        let dir = tempdir().unwrap();
        assert!(clear_embedded_site_data(dir.path()).is_ok());
    }

    #[test]
    fn clear_removes_profile() {
        let dir = tempdir().unwrap();
        let profile = embedded_profile_dir(dir.path());
        fs::create_dir_all(profile.join("Cookies")).unwrap();
        assert!(profile.exists());
        clear_embedded_site_data(dir.path()).unwrap();
        assert!(!profile.exists());
    }
}
