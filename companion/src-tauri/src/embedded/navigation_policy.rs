//! URL / origin / path allowlist for the untrusted `fut` WebView.
//! Fail closed: anything not explicitly allowed is denied.

use url::Url;

/// Canonical FUT Web App entry URL (no query, no user-controlled host).
pub const FUT_HOME_URL: &str = "https://www.ea.com/ea-sports-fc/ultimate-team/web-app/";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NavigationDecision {
    /// Allow navigation inside the FUT webview.
    Allow,
    /// Block navigation entirely (fail closed).
    Deny,
    /// Block in-webview navigation; main UI may offer external open after user intent.
    ExternalBlocked,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UrlClass {
    FutWebApp,
    EaAuth,
    EaAccount,
    EaStaticAsset,
    External,
    Invalid,
}

/// Explicit hosts — no `*.ea.com` wildcard.
const FUT_HOSTS: &[&str] = &["www.ea.com", "www.easports.com"];

const STATIC_HOSTS: &[&str] = &[
    "www.ea.com",
    "media.contentapi.ea.com",
    "eaassets-a.akamaihd.net",
    "cdn.ea.com",
];

fn host_in(list: &[&str], host: &str) -> bool {
    list.iter().any(|h| h.eq_ignore_ascii_case(host))
}

fn is_locale_segment(segment: &str) -> bool {
    !segment.is_empty()
        && segment.len() <= 16
        && segment
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-')
}

fn path_matches(path: &str, exact: &[&str], prefixes: &[&str]) -> bool {
    exact.contains(&path) || prefixes.iter().any(|prefix| path.starts_with(prefix))
}

fn is_auth_path(host: &str, path: &str) -> bool {
    match host {
        "signin.ea.com" => path_matches(
            path,
            &["/"],
            &["/p/", "/connect/", "/oauth/", "/oauth2/", "/login"],
        ),
        "accounts.ea.com" => path_matches(
            path,
            &["/"],
            &["/connect/", "/oauth/", "/oauth2/", "/login"],
        ),
        "signin.live.com" | "login.live.com" => {
            path_matches(path, &["/"], &["/oauth20_", "/ppsecure/", "/login.srf"])
        }
        "login.microsoftonline.com" => {
            path == "/" || path.contains("/oauth2/") || path.starts_with("/common/")
        }
        _ => false,
    }
}

fn is_account_path(host: &str, path: &str) -> bool {
    match host {
        "myaccount.ea.com" => path_matches(path, &["/"], &["/cp-ui/", "/login", "/connect/"]),
        "www.ea.com" => {
            let segments: Vec<&str> = path
                .split('/')
                .filter(|segment| !segment.is_empty())
                .collect();
            segments.as_slice() == ["login"]
                || (segments.len() == 2 && is_locale_segment(segments[0]) && segments[1] == "login")
        }
        _ => false,
    }
}

/// FUT web-app path: `/ea-sports-fc/ultimate-team/web-app` with optional locale prefix.
pub fn is_fut_web_app_path(path: &str) -> bool {
    let segments: Vec<&str> = path
        .split('/')
        .filter(|segment| !segment.is_empty())
        .collect();
    let app = ["ea-sports-fc", "ultimate-team", "web-app"];

    if segments.starts_with(&app) {
        return true;
    }
    segments.len() >= 4 && is_locale_segment(segments[0]) && segments[1..].starts_with(&app)
}

pub fn classify_url(raw: &str) -> UrlClass {
    let Ok(url) = Url::parse(raw) else {
        return UrlClass::Invalid;
    };
    if url.scheme() != "https" && url.scheme() != "about" {
        // about:blank used for popup scaffolding
        if url.scheme() == "about" {
            return UrlClass::EaAuth; // allow blank intermediate
        }
        return UrlClass::Invalid;
    }
    if url.scheme() == "about" {
        return UrlClass::EaAuth;
    }

    let Some(host) = url.host_str() else {
        return UrlClass::Invalid;
    };

    if host_in(FUT_HOSTS, host) && is_fut_web_app_path(url.path()) {
        return UrlClass::FutWebApp;
    }
    if is_auth_path(host, url.path()) {
        return UrlClass::EaAuth;
    }
    if is_account_path(host, url.path()) {
        return UrlClass::EaAccount;
    }
    if host_in(STATIC_HOSTS, host) {
        return UrlClass::EaStaticAsset;
    }
    UrlClass::External
}

/// Policy for top-level navigation inside the `fut` webview.
pub fn decide_navigation(raw: &str) -> NavigationDecision {
    match classify_url(raw) {
        UrlClass::FutWebApp | UrlClass::EaAuth | UrlClass::EaAccount => NavigationDecision::Allow,
        UrlClass::EaStaticAsset | UrlClass::External => NavigationDecision::ExternalBlocked,
        UrlClass::Invalid => NavigationDecision::Deny,
    }
}

/// Policy for `window.open` / new window requests from the FUT page.
pub fn decide_new_window(raw: &str) -> NavigationDecision {
    if raw == "about:blank" {
        return NavigationDecision::Deny;
    }
    match classify_url(raw) {
        UrlClass::FutWebApp | UrlClass::EaAuth | UrlClass::EaAccount => NavigationDecision::Allow,
        UrlClass::EaStaticAsset | UrlClass::External => NavigationDecision::ExternalBlocked,
        UrlClass::Invalid => NavigationDecision::Deny,
    }
}

/// Fixed home URL — never constructed from untrusted frontend input.
pub fn fut_home_url() -> Url {
    Url::parse(FUT_HOME_URL).expect("FUT_HOME_URL is constant valid URL")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_canonical_fut_home() {
        assert_eq!(decide_navigation(FUT_HOME_URL), NavigationDecision::Allow);
        assert_eq!(classify_url(FUT_HOME_URL), UrlClass::FutWebApp);
    }

    #[test]
    fn allows_locale_fut_path() {
        assert_eq!(
            decide_navigation("https://www.ea.com/en/ea-sports-fc/ultimate-team/web-app/"),
            NavigationDecision::Allow
        );
        assert_eq!(
            decide_navigation("https://www.easports.com/en-gb/ea-sports-fc/ultimate-team/web-app"),
            NavigationDecision::Allow
        );
    }

    #[test]
    fn allows_auth_hosts() {
        assert_eq!(
            decide_navigation("https://signin.ea.com/p/juno/login"),
            NavigationDecision::Allow
        );
        assert_eq!(
            decide_navigation("https://accounts.ea.com/connect/auth"),
            NavigationDecision::Allow
        );
    }

    #[test]
    fn denies_http() {
        assert_eq!(
            decide_navigation("http://www.ea.com/ea-sports-fc/ultimate-team/web-app/"),
            NavigationDecision::Deny
        );
    }

    #[test]
    fn blocks_external() {
        assert_eq!(
            decide_navigation("https://evil.example/phish"),
            NavigationDecision::ExternalBlocked
        );
        assert_eq!(
            decide_new_window("https://evil.example/"),
            NavigationDecision::ExternalBlocked
        );
    }

    #[test]
    fn denies_path_spoof_on_non_allowlisted_host() {
        // Looks like FUT path but host is not on the explicit list.
        assert_eq!(
            decide_navigation("https://phish.example/ea-sports-fc/ultimate-team/web-app/"),
            NavigationDecision::ExternalBlocked
        );
        assert_eq!(
            classify_url("https://www.ea.com/other/ultimate-team/web-app-not-really"),
            UrlClass::EaStaticAsset
        );
        assert_eq!(
            decide_navigation("https://www.ea.com/other/ultimate-team/web-app-not-really"),
            NavigationDecision::ExternalBlocked
        );
    }

    #[test]
    fn allows_only_known_auth_paths() {
        assert_eq!(
            classify_url("https://signin.ea.com/p/juno/login"),
            UrlClass::EaAuth
        );
        assert_eq!(
            classify_url("https://signin.ea.com/unrelated/content"),
            UrlClass::External
        );
        assert_eq!(
            classify_url("https://login.microsoftonline.com/common/oauth2/v2.0/authorize"),
            UrlClass::EaAuth
        );
    }

    #[test]
    fn static_hosts_are_not_top_level_pages() {
        assert_eq!(
            classify_url("https://media.contentapi.ea.com/content/image.png"),
            UrlClass::EaStaticAsset
        );
        assert_eq!(
            decide_navigation("https://media.contentapi.ea.com/content/image.png"),
            NavigationDecision::ExternalBlocked
        );
        assert_eq!(
            decide_new_window("https://media.contentapi.ea.com/content/image.png"),
            NavigationDecision::ExternalBlocked
        );
        assert_eq!(decide_new_window("about:blank"), NavigationDecision::Deny);
    }

    #[test]
    fn rejects_wildcard_style_hosts() {
        assert_eq!(
            classify_url("https://evil.ea.com/ea-sports-fc/ultimate-team/web-app/"),
            UrlClass::External
        );
        assert_eq!(
            decide_navigation("https://evil.ea.com/ea-sports-fc/ultimate-team/web-app/"),
            NavigationDecision::ExternalBlocked
        );
    }

    #[test]
    fn fut_home_is_parseable() {
        assert_eq!(fut_home_url().as_str(), FUT_HOME_URL);
    }
}
