//! Pure Embedded lifecycle transitions and generation isolation.
//! No WebView / Tauri types — fully unit-testable.

use super::status::{EmbeddedLifecycle, EmbeddedStatus};

pub const RUNTIME_HANDSHAKE_TIMEOUT: &str = "RUNTIME_HANDSHAKE_TIMEOUT";
pub const HANDSHAKE_DEADLINE_MS: u64 = 5_000;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Generation {
    pub id: u64,
    pub token: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LifecycleEvent {
    /// User enabled Embedded and opened the window.
    EnableShow,
    /// Top-level auth/account page finished loading.
    AuthPage,
    /// Top-level FUT web-app page finished loading (starts handshake).
    FutPageStarted { generation: Generation },
    /// Handshake ready for a specific generation/token.
    Ready { generation_id: u64, token: String },
    /// Handshake failed for a specific generation/token.
    Failed {
        generation_id: u64,
        token: String,
        code: String,
    },
    /// Watchdog fired for a generation that never completed.
    Timeout { generation_id: u64 },
    /// User-triggered reload (clears error; next page load starts new generation).
    Reload,
    /// Disable Embedded or reset settings.
    Disable,
}

#[derive(Debug, Clone)]
pub struct LifecycleMachine {
    pub status: EmbeddedStatus,
    pub active: Option<Generation>,
}

impl LifecycleMachine {
    pub fn disabled() -> Self {
        Self {
            status: EmbeddedStatus::disabled(),
            active: None,
        }
    }

    pub fn apply(&mut self, event: LifecycleEvent) {
        match event {
            LifecycleEvent::EnableShow => {
                self.status.embedded_mode = true;
                self.status.lifecycle = EmbeddedLifecycle::Starting;
                self.status.window_open = true;
                self.status.runtime_installed = false;
                self.status.last_error_code = None;
                self.status.last_error_message = None;
                self.status.notes = vec!["Starting Embedded FUT window…".into()];
                self.active = None;
            }
            LifecycleEvent::AuthPage => {
                if !self.status.embedded_mode {
                    return;
                }
                self.status.lifecycle = EmbeddedLifecycle::LoginRequired;
                self.status.window_open = true;
                self.status.runtime_installed = false;
                self.status.notes = vec!["EA login / auth page open in Embedded window.".into()];
                // Auth pages do not own a runtime generation.
                self.active = None;
            }
            LifecycleEvent::FutPageStarted { generation } => {
                if !self.status.embedded_mode {
                    return;
                }
                self.status.lifecycle = EmbeddedLifecycle::Starting;
                self.status.window_open = true;
                self.status.runtime_installed = false;
                self.status.last_error_code = None;
                self.status.last_error_message = None;
                self.status.notes =
                    vec!["FUT Web App loaded; waiting for runtime handshake.".into()];
                self.active = Some(generation);
            }
            LifecycleEvent::Ready {
                generation_id,
                token,
            } => {
                // Transition table: only Starting → Ready for the current generation.
                // Late Ready after Timeout/Failed must not overwrite terminal state.
                if !self.is_active(generation_id, &token) {
                    return;
                }
                if self.status.lifecycle != EmbeddedLifecycle::Starting {
                    return;
                }
                self.status.lifecycle = EmbeddedLifecycle::Ready;
                self.status.runtime_installed = true;
                self.status.window_open = true;
                self.status.last_error_code = None;
                self.status.last_error_message = None;
                self.status.notes =
                    vec!["FUT Web App loaded; embedded runtime handshake passed.".into()];
            }
            LifecycleEvent::Failed {
                generation_id,
                token,
                code,
            } => {
                // Transition table: only Starting → Failed for the current generation.
                // Late Failed after Ready must not overwrite Ready.
                if !self.is_active(generation_id, &token) {
                    return;
                }
                if self.status.lifecycle != EmbeddedLifecycle::Starting {
                    return;
                }
                self.status.lifecycle = EmbeddedLifecycle::Failed;
                self.status.runtime_installed = false;
                self.status.last_error_code = Some(code);
                self.status.last_error_message =
                    Some("Packaged FSU runtime did not pass its startup checks.".into());
                self.status.notes =
                    vec!["Embedded runtime failed. Use Reload or Extension fallback.".into()];
            }
            LifecycleEvent::Timeout { generation_id } => {
                let Some(active) = &self.active else {
                    return;
                };
                if active.id != generation_id {
                    return;
                }
                if self.status.lifecycle != EmbeddedLifecycle::Starting {
                    return;
                }
                self.status.lifecycle = EmbeddedLifecycle::Failed;
                self.status.runtime_installed = false;
                self.status.last_error_code = Some(RUNTIME_HANDSHAKE_TIMEOUT.into());
                self.status.last_error_message =
                    Some("Runtime handshake timed out waiting for ready.".into());
                self.status.notes = vec![
                    "Handshake timeout. Reload FUT or open browser Extension fallback.".into(),
                ];
            }
            LifecycleEvent::Reload => {
                if !self.status.embedded_mode {
                    return;
                }
                self.status.lifecycle = EmbeddedLifecycle::Starting;
                self.status.runtime_installed = false;
                self.status.last_error_code = None;
                self.status.last_error_message = None;
                self.status.notes = vec!["Reloading FUT…".into()];
                self.active = None;
            }
            LifecycleEvent::Disable => {
                self.status = EmbeddedStatus::disabled();
                self.active = None;
            }
        }
    }

    fn is_active(&self, generation_id: u64, token: &str) -> bool {
        match &self.active {
            Some(active) => active.id == generation_id && active.token == token,
            None => false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn gen(id: u64, token: &str) -> Generation {
        Generation {
            id,
            token: token.into(),
        }
    }

    #[test]
    fn ready_before_timeout() {
        let mut m = LifecycleMachine::disabled();
        m.apply(LifecycleEvent::EnableShow);
        m.apply(LifecycleEvent::FutPageStarted {
            generation: gen(1, "t1"),
        });
        assert_eq!(m.status.lifecycle, EmbeddedLifecycle::Starting);
        m.apply(LifecycleEvent::Ready {
            generation_id: 1,
            token: "t1".into(),
        });
        assert_eq!(m.status.lifecycle, EmbeddedLifecycle::Ready);
        assert!(m.status.runtime_installed);
        assert!(m.status.last_error_code.is_none());
    }

    #[test]
    fn timeout_marks_failed() {
        let mut m = LifecycleMachine::disabled();
        m.apply(LifecycleEvent::EnableShow);
        m.apply(LifecycleEvent::FutPageStarted {
            generation: gen(2, "t2"),
        });
        m.apply(LifecycleEvent::Timeout { generation_id: 2 });
        assert_eq!(m.status.lifecycle, EmbeddedLifecycle::Failed);
        assert_eq!(
            m.status.last_error_code.as_deref(),
            Some(RUNTIME_HANDSHAKE_TIMEOUT)
        );
        assert!(!m.status.runtime_installed);
    }

    #[test]
    fn stale_ready_ignored() {
        let mut m = LifecycleMachine::disabled();
        m.apply(LifecycleEvent::EnableShow);
        m.apply(LifecycleEvent::FutPageStarted {
            generation: gen(3, "new"),
        });
        m.apply(LifecycleEvent::Ready {
            generation_id: 1,
            token: "old".into(),
        });
        assert_eq!(m.status.lifecycle, EmbeddedLifecycle::Starting);
        assert!(!m.status.runtime_installed);
    }

    #[test]
    fn stale_timeout_ignored_after_ready() {
        let mut m = LifecycleMachine::disabled();
        m.apply(LifecycleEvent::EnableShow);
        m.apply(LifecycleEvent::FutPageStarted {
            generation: gen(4, "t4"),
        });
        m.apply(LifecycleEvent::Ready {
            generation_id: 4,
            token: "t4".into(),
        });
        m.apply(LifecycleEvent::Timeout { generation_id: 4 });
        assert_eq!(m.status.lifecycle, EmbeddedLifecycle::Ready);
        assert!(m.status.runtime_installed);
        assert!(m.status.last_error_code.is_none());
    }

    #[test]
    fn stale_timeout_ignored_after_new_generation() {
        let mut m = LifecycleMachine::disabled();
        m.apply(LifecycleEvent::EnableShow);
        m.apply(LifecycleEvent::FutPageStarted {
            generation: gen(5, "a"),
        });
        m.apply(LifecycleEvent::FutPageStarted {
            generation: gen(6, "b"),
        });
        m.apply(LifecycleEvent::Timeout { generation_id: 5 });
        assert_eq!(m.status.lifecycle, EmbeddedLifecycle::Starting);
        m.apply(LifecycleEvent::Ready {
            generation_id: 6,
            token: "b".into(),
        });
        assert_eq!(m.status.lifecycle, EmbeddedLifecycle::Ready);
    }

    #[test]
    fn auth_page_does_not_keep_generation() {
        let mut m = LifecycleMachine::disabled();
        m.apply(LifecycleEvent::EnableShow);
        m.apply(LifecycleEvent::FutPageStarted {
            generation: gen(7, "x"),
        });
        m.apply(LifecycleEvent::AuthPage);
        assert_eq!(m.status.lifecycle, EmbeddedLifecycle::LoginRequired);
        assert!(m.active.is_none());
        m.apply(LifecycleEvent::Timeout { generation_id: 7 });
        assert_eq!(m.status.lifecycle, EmbeddedLifecycle::LoginRequired);
    }

    #[test]
    fn reload_clears_error() {
        let mut m = LifecycleMachine::disabled();
        m.apply(LifecycleEvent::EnableShow);
        m.apply(LifecycleEvent::FutPageStarted {
            generation: gen(8, "t"),
        });
        m.apply(LifecycleEvent::Timeout { generation_id: 8 });
        assert_eq!(m.status.lifecycle, EmbeddedLifecycle::Failed);
        m.apply(LifecycleEvent::Reload);
        assert_eq!(m.status.lifecycle, EmbeddedLifecycle::Starting);
        assert!(m.status.last_error_code.is_none());
        assert!(m.active.is_none());
    }

    #[test]
    fn disable_resets_machine() {
        let mut m = LifecycleMachine::disabled();
        m.apply(LifecycleEvent::EnableShow);
        m.apply(LifecycleEvent::FutPageStarted {
            generation: gen(9, "t"),
        });
        m.apply(LifecycleEvent::Disable);
        assert_eq!(m.status.lifecycle, EmbeddedLifecycle::Disabled);
        assert!(!m.status.embedded_mode);
        assert!(m.active.is_none());
    }

    #[test]
    fn diagnostics_error_codes_have_no_token() {
        let mut m = LifecycleMachine::disabled();
        m.apply(LifecycleEvent::EnableShow);
        m.apply(LifecycleEvent::FutPageStarted {
            generation: gen(10, "supersecrettoken"),
        });
        m.apply(LifecycleEvent::Timeout { generation_id: 10 });
        let code = m.status.last_error_code.unwrap();
        let msg = m.status.last_error_message.unwrap();
        assert!(!code.contains("supersecret"));
        assert!(!msg.contains("supersecret"));
        for note in &m.status.notes {
            assert!(!note.contains("supersecret"));
        }
    }

    #[test]
    fn late_ready_after_timeout_does_not_overwrite_failed() {
        let mut m = LifecycleMachine::disabled();
        m.apply(LifecycleEvent::EnableShow);
        m.apply(LifecycleEvent::FutPageStarted {
            generation: gen(11, "t11"),
        });
        m.apply(LifecycleEvent::Timeout { generation_id: 11 });
        assert_eq!(m.status.lifecycle, EmbeddedLifecycle::Failed);
        assert!(!m.status.runtime_installed);
        // Same generation Ready arrives late (e.g. slow inject after watchdog).
        m.apply(LifecycleEvent::Ready {
            generation_id: 11,
            token: "t11".into(),
        });
        assert_eq!(m.status.lifecycle, EmbeddedLifecycle::Failed);
        assert_eq!(
            m.status.last_error_code.as_deref(),
            Some(RUNTIME_HANDSHAKE_TIMEOUT)
        );
        assert!(!m.status.runtime_installed);
    }

    #[test]
    fn late_failed_after_ready_does_not_overwrite_ready() {
        let mut m = LifecycleMachine::disabled();
        m.apply(LifecycleEvent::EnableShow);
        m.apply(LifecycleEvent::FutPageStarted {
            generation: gen(12, "t12"),
        });
        m.apply(LifecycleEvent::Ready {
            generation_id: 12,
            token: "t12".into(),
        });
        assert_eq!(m.status.lifecycle, EmbeddedLifecycle::Ready);
        assert!(m.status.runtime_installed);
        m.apply(LifecycleEvent::Failed {
            generation_id: 12,
            token: "t12".into(),
            code: "RUNTIME_LATE_FAIL".into(),
        });
        assert_eq!(m.status.lifecycle, EmbeddedLifecycle::Ready);
        assert!(m.status.runtime_installed);
        assert!(m.status.last_error_code.is_none());
    }

    #[test]
    fn stale_generation_after_navigation_cannot_install_runtime() {
        let mut m = LifecycleMachine::disabled();
        m.apply(LifecycleEvent::EnableShow);
        m.apply(LifecycleEvent::FutPageStarted {
            generation: gen(13, "old"),
        });
        // New top-level navigation supersedes generation 13.
        m.apply(LifecycleEvent::FutPageStarted {
            generation: gen(14, "new"),
        });
        assert_eq!(m.status.lifecycle, EmbeddedLifecycle::Starting);
        assert!(!m.status.runtime_installed);
        // Stale ready from previous document.
        m.apply(LifecycleEvent::Ready {
            generation_id: 13,
            token: "old".into(),
        });
        assert_eq!(m.status.lifecycle, EmbeddedLifecycle::Starting);
        assert!(!m.status.runtime_installed);
        // Wrong token for current generation.
        m.apply(LifecycleEvent::Ready {
            generation_id: 14,
            token: "old".into(),
        });
        assert!(!m.status.runtime_installed);
        // Only current Starting → Ready installs runtime.
        m.apply(LifecycleEvent::Ready {
            generation_id: 14,
            token: "new".into(),
        });
        assert_eq!(m.status.lifecycle, EmbeddedLifecycle::Ready);
        assert!(m.status.runtime_installed);
    }

    #[test]
    fn runtime_installed_only_on_starting_to_ready() {
        let mut m = LifecycleMachine::disabled();
        m.apply(LifecycleEvent::EnableShow);
        assert!(!m.status.runtime_installed);
        m.apply(LifecycleEvent::FutPageStarted {
            generation: gen(15, "t15"),
        });
        assert!(!m.status.runtime_installed);
        m.apply(LifecycleEvent::Failed {
            generation_id: 15,
            token: "t15".into(),
            code: "RUNTIME_INJECT_FAILED".into(),
        });
        assert!(!m.status.runtime_installed);
        m.apply(LifecycleEvent::Reload);
        m.apply(LifecycleEvent::FutPageStarted {
            generation: gen(16, "t16"),
        });
        m.apply(LifecycleEvent::Ready {
            generation_id: 16,
            token: "t16".into(),
        });
        assert!(m.status.runtime_installed);
        // Subsequent Failed on same gen ignored; flag stays true.
        m.apply(LifecycleEvent::Failed {
            generation_id: 16,
            token: "t16".into(),
            code: "SHOULD_IGNORE".into(),
        });
        assert!(m.status.runtime_installed);
        assert_eq!(m.status.lifecycle, EmbeddedLifecycle::Ready);
    }
}
