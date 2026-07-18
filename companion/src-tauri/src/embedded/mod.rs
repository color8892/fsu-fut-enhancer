//! Embedded FUT Mode: untrusted remote WebView + local packaged FSU runtime.

pub mod http_bridge;
pub mod injection;
pub mod lifecycle;
pub mod navigation_policy;
pub mod site_data;
pub mod status;
pub mod window;

#[cfg(test)]
mod capability_tests;
#[cfg(test)]
mod fixture_integration_tests;

pub use navigation_policy::FUT_HOME_URL;
pub use site_data::clear_embedded_site_data;
pub use status::EmbeddedStatus;
pub use window::{
    close_fut, get_status, go_back, go_forward, hide_fut, mark_disabled, navigate_home, reload_fut,
    show_or_create_fut, EmbeddedState, SharedEmbedded,
};
