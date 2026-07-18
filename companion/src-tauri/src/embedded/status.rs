//! Embedded lifecycle status — never includes session material.

use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum EmbeddedLifecycle {
    /// Feature flag off; use Extension / external browser.
    Disabled,
    Starting,
    LoginRequired,
    Ready,
    Failed,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmbeddedStatus {
    pub lifecycle: EmbeddedLifecycle,
    pub embedded_mode: bool,
    pub window_open: bool,
    pub last_error_code: Option<String>,
    pub last_error_message: Option<String>,
    pub runtime_installed: bool,
    pub notes: Vec<String>,
}

impl EmbeddedStatus {
    pub fn disabled() -> Self {
        Self {
            lifecycle: EmbeddedLifecycle::Disabled,
            embedded_mode: false,
            window_open: false,
            last_error_code: None,
            last_error_message: None,
            runtime_installed: false,
            notes: vec![
                "Embedded Mode is off. Enable embeddedMode in Settings (opt-in beta).".into(),
            ],
        }
    }

    pub fn with_error(mut self, code: &str, message: &str) -> Self {
        self.lifecycle = EmbeddedLifecycle::Failed;
        self.last_error_code = Some(code.to_string());
        self.last_error_message = Some(message.chars().take(200).collect());
        self
    }
}
