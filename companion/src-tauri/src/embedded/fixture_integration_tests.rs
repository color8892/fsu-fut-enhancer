//! H6: WebView-less pure-function fixture tests (NOT a live WebView integration suite).
//!
//! These exercise navigation policy + lifecycle machine + ACL file constraints
//! **without** creating a WKWebView/WebView2 instance and **without** adding
//! localhost to production `capabilities/fut.json`.
//!
//! Real WebView integration (window create, navigation hooks, inject, handshake
//! against a fixture HTML page) and the EA login platform matrix remain
//! **pending / manual** — see `docs/EMBEDDED_MANUAL_CHECKLIST.md` and
//! `COMPANION_HARDENING_PLAN.md` H6 status.

#[cfg(test)]
mod tests {
    use crate::embedded::lifecycle::{
        Generation, LifecycleEvent, LifecycleMachine, RUNTIME_HANDSHAKE_TIMEOUT,
    };
    use crate::embedded::navigation_policy::{
        decide_navigation, decide_new_window, NavigationDecision,
    };
    use crate::embedded::status::EmbeddedLifecycle;
    use std::fs;
    use std::path::PathBuf;

    fn gen(id: u64) -> Generation {
        Generation {
            id,
            token: format!("fixture-token-{id}"),
        }
    }

    /// Pure-function fixture matrix: navigation deny, popup deny, timeout, reload.
    #[test]
    fn pure_function_navigation_deny_does_not_use_localhost() {
        assert_eq!(
            decide_navigation("https://evil.example/phish"),
            NavigationDecision::ExternalBlocked
        );
        assert_eq!(
            decide_navigation("http://localhost:1420/"),
            NavigationDecision::Deny
        );
        assert_eq!(
            decide_new_window("https://evil.example/popup"),
            NavigationDecision::ExternalBlocked
        );
        // Production fut capability must not list localhost.
        let fut = fs::read_to_string(
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("capabilities/fut.json"),
        )
        .unwrap();
        assert!(!fut.contains("localhost"));
        assert!(!fut.contains("127.0.0.1"));
    }

    #[test]
    fn pure_function_runtime_timeout_and_reload_idempotence() {
        let mut m = LifecycleMachine::disabled();
        m.apply(LifecycleEvent::EnableShow);
        m.apply(LifecycleEvent::FutPageStarted { generation: gen(1) });
        assert_eq!(m.status.lifecycle, EmbeddedLifecycle::Starting);

        m.apply(LifecycleEvent::Timeout { generation_id: 1 });
        assert_eq!(m.status.lifecycle, EmbeddedLifecycle::Failed);
        assert_eq!(
            m.status.last_error_code.as_deref(),
            Some(RUNTIME_HANDSHAKE_TIMEOUT)
        );

        // Reload clears error; repeated reloads stay starting until new page gen.
        for _ in 0..3 {
            m.apply(LifecycleEvent::Reload);
            assert_eq!(m.status.lifecycle, EmbeddedLifecycle::Starting);
            assert!(m.status.last_error_code.is_none());
            assert!(!m.status.runtime_installed);
        }

        m.apply(LifecycleEvent::FutPageStarted { generation: gen(2) });
        m.apply(LifecycleEvent::Ready {
            generation_id: 2,
            token: "fixture-token-2".into(),
        });
        assert_eq!(m.status.lifecycle, EmbeddedLifecycle::Ready);
        assert!(m.status.runtime_installed);
    }

    #[test]
    fn pure_function_auth_to_fut_then_ready() {
        let mut m = LifecycleMachine::disabled();
        m.apply(LifecycleEvent::EnableShow);
        m.apply(LifecycleEvent::AuthPage);
        assert_eq!(m.status.lifecycle, EmbeddedLifecycle::LoginRequired);
        // Stale handshake from a previous FUT visit cannot fire.
        m.apply(LifecycleEvent::Timeout { generation_id: 99 });
        assert_eq!(m.status.lifecycle, EmbeddedLifecycle::LoginRequired);

        m.apply(LifecycleEvent::FutPageStarted { generation: gen(3) });
        assert_eq!(m.status.lifecycle, EmbeddedLifecycle::Starting);
        m.apply(LifecycleEvent::Ready {
            generation_id: 3,
            token: "fixture-token-3".into(),
        });
        assert_eq!(m.status.lifecycle, EmbeddedLifecycle::Ready);
    }

    #[test]
    fn pure_function_disable_after_failed() {
        let mut m = LifecycleMachine::disabled();
        m.apply(LifecycleEvent::EnableShow);
        m.apply(LifecycleEvent::FutPageStarted { generation: gen(4) });
        m.apply(LifecycleEvent::Timeout { generation_id: 4 });
        m.apply(LifecycleEvent::Disable);
        assert_eq!(m.status.lifecycle, EmbeddedLifecycle::Disabled);
        assert!(!m.status.embedded_mode);
        assert!(m.active.is_none());
    }

    #[test]
    fn pure_function_no_infinite_auto_reload_policy() {
        // Policy assertion: machine never auto-reloads; only Reload event from user.
        let mut m = LifecycleMachine::disabled();
        m.apply(LifecycleEvent::EnableShow);
        m.apply(LifecycleEvent::FutPageStarted { generation: gen(5) });
        m.apply(LifecycleEvent::Timeout { generation_id: 5 });
        assert_eq!(m.status.lifecycle, EmbeddedLifecycle::Failed);
        // Without user Reload, remains failed.
        m.apply(LifecycleEvent::Timeout { generation_id: 5 });
        assert_eq!(m.status.lifecycle, EmbeddedLifecycle::Failed);
    }

    #[test]
    fn pure_function_late_ready_after_timeout_stays_failed() {
        let mut m = LifecycleMachine::disabled();
        m.apply(LifecycleEvent::EnableShow);
        m.apply(LifecycleEvent::FutPageStarted { generation: gen(6) });
        m.apply(LifecycleEvent::Timeout { generation_id: 6 });
        m.apply(LifecycleEvent::Ready {
            generation_id: 6,
            token: "fixture-token-6".into(),
        });
        assert_eq!(m.status.lifecycle, EmbeddedLifecycle::Failed);
        assert!(!m.status.runtime_installed);
    }
}
