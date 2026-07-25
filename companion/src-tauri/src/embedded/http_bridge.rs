//! Narrow allowlisted HTTP bridge for the untrusted FUT WebView.

use futures_util::StreamExt;
use reqwest::{
    header::{HeaderMap, HeaderName, HeaderValue},
    redirect::Policy,
    Client,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::WebviewWindow;
use url::Url;

const MAX_RESPONSE_BYTES: usize = 5 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS: u64 = 10_000;
const MAX_TIMEOUT_MS: u64 = 15_000;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EmbeddedHttpRequest {
    pub method: Option<String>,
    pub url: String,
    #[serde(default)]
    pub headers: HashMap<String, String>,
    pub timeout: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmbeddedHttpResponse {
    final_url: String,
    ready_state: u8,
    status: u16,
    status_text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    error_code: Option<String>,
    response_headers: String,
    response_text: String,
    response: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Endpoint {
    Public,
    EaTransferMarket,
}

fn digits(value: &str) -> bool {
    !value.is_empty() && value.bytes().all(|byte| byte.is_ascii_digit())
}

fn is_api_fut_to_path(path: &str) -> bool {
    const FILES: &[&str] = &[
        "updata.json",
        "meta.json",
        "fast.json",
        "pack.json",
        "sbc.json",
        "ggrating.json",
        "evolutions.json",
        "inpacks.json",
        "other.json",
        "fgconfig.json",
        "playermeta.json",
        "lowprice.json",
    ];
    path.strip_prefix("/26/")
        .is_some_and(|name| FILES.contains(&name))
}

fn is_fut_gg_path(path: &str) -> bool {
    if path == "/api/fut/player-prices/26/" {
        return true;
    }
    path.strip_prefix("/api/squads/").is_some_and(digits)
}

fn is_futbin_path(path: &str) -> bool {
    const ACTIONS: &[&str] = &[
        "getChallengeTopSquads",
        "getSquadByID",
        "getChallengesBySetId",
        "fetchPriceInformation",
        "getFilteredPlayers",
        "fetchPlayerInformationMinimal",
    ];
    let parts: Vec<&str> = path.trim_matches('/').split('/').collect();
    parts.len() == 4
        && parts[0] == "futbin"
        && parts[1] == "api"
        && digits(parts[2])
        && ACTIONS.contains(&parts[3])
}

fn is_futnext_preview_path(path: &str) -> bool {
    let parts: Vec<&str> = path.trim_matches('/').split('/').collect();
    let valid_slug = |slug: &str| {
        if slug.is_empty() || slug.len() > 192 || matches!(slug, "." | "..") {
            return false;
        }
        let bytes = slug.as_bytes();
        let mut index = 0;
        while index < bytes.len() {
            let byte = bytes[index];
            if byte == b'%' {
                if index + 2 >= bytes.len() {
                    return false;
                }
                let (Some(high), Some(low)) = (
                    (bytes[index + 1] as char).to_digit(16),
                    (bytes[index + 2] as char).to_digit(16),
                ) else {
                    return false;
                };
                let decoded = ((high << 4) | low) as u8;
                if decoded == b'/' || decoded == b'\\' || decoded <= 0x1f || decoded == 0x7f {
                    return false;
                }
                index += 3;
                continue;
            }
            if !(byte.is_ascii_alphanumeric() || matches!(byte, b'&' | b'.' | b'_' | b'-')) {
                return false;
            }
            index += 1;
        }
        true
    };
    match parts.as_slice() {
        ["pack", slug, id] => valid_slug(slug) && digits(id),
        ["pack" | "playerpick", slug, id, "open"] => valid_slug(slug) && digits(id),
        _ => false,
    }
}

fn authorize_url(raw: &str) -> Result<(Url, Endpoint), String> {
    let url = Url::parse(raw).map_err(|_| "invalid request URL".to_string())?;
    if url.scheme() != "https" || !url.username().is_empty() || url.password().is_some() {
        return Err("request URL is not allowed".into());
    }

    let endpoint = match (url.host_str().unwrap_or_default(), url.path()) {
        ("api.fut.to", path) if is_api_fut_to_path(path) => Endpoint::Public,
        ("www.fut.gg", path) if is_fut_gg_path(path) => Endpoint::Public,
        ("www.futbin.org", path) if is_futbin_path(path) => Endpoint::Public,
        ("enhancer-api.futnext.com", "/players/prices") => Endpoint::Public,
        ("www.futnext.com", path) if is_futnext_preview_path(path) => Endpoint::Public,
        ("utas.mob.v5.prd.futc-ext.gcp.ea.com", "/ut/game/fc26/transfermarket") => {
            Endpoint::EaTransferMarket
        }
        _ => return Err("request endpoint is not allowed".into()),
    };
    Ok((url, endpoint))
}

fn authorize_headers(
    raw: &HashMap<String, String>,
    endpoint: Endpoint,
) -> Result<HeaderMap, String> {
    let mut headers = HeaderMap::new();
    for (name, value) in raw {
        let lower = name.to_ascii_lowercase();
        if lower == "user-agent" {
            continue;
        }
        let allowed = matches!(
            lower.as_str(),
            "accept" | "content-type" | "cache-control" | "pragma" | "x-requested-with"
        ) || (endpoint == Endpoint::EaTransferMarket && lower == "x-ut-sid");
        if !allowed {
            return Err(format!("request header is not allowed: {lower}"));
        }
        let header_name =
            HeaderName::from_bytes(lower.as_bytes()).map_err(|_| "invalid header name")?;
        let header_value = HeaderValue::from_str(value).map_err(|_| "invalid header value")?;
        headers.insert(header_name, header_value);
    }
    Ok(headers)
}

/// Stable error codes (no URL query, header values, or response body).
pub const ERR_METHOD: &str = "BRIDGE_METHOD_NOT_ALLOWED";
pub const ERR_ENDPOINT: &str = "BRIDGE_ENDPOINT_DENIED";
pub const ERR_HEADER: &str = "BRIDGE_HEADER_DENIED";
pub const ERR_REDIRECT: &str = "BRIDGE_REDIRECT_BLOCKED";
pub const ERR_TOO_LARGE: &str = "BRIDGE_RESPONSE_TOO_LARGE";
pub const ERR_UTF8: &str = "BRIDGE_INVALID_UTF8";
pub const ERR_TRANSPORT: &str = "BRIDGE_TRANSPORT_FAILED";
pub const ERR_TIMEOUT: &str = "BRIDGE_TIMEOUT";
pub const ERR_NETWORK: &str = "BRIDGE_NETWORK_FAILED";
pub const ERR_PROVIDER: &str = "BRIDGE_PROVIDER_ERROR";

/// Public config/price GET may retry with bounded backoff; EA market never auto-retries.
const PUBLIC_MAX_ATTEMPTS: u32 = 3;
const PUBLIC_BACKOFF_BASE_MS: u64 = 50;
const PUBLIC_BACKOFF_MAX_MS: u64 = 400;
const PUBLIC_BACKOFF_JITTER_MS: u64 = 25;

/// Pure transport classification (testable without live network).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TransportKind {
    Timeout,
    /// DNS / connect / socket failures (not deadline timeouts).
    Network,
    Other,
}

/// Pure HTTP status classification for provider observability.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HttpStatusClass {
    Okish,
    ProviderRateLimit,
    ProviderServerError,
    Other,
}

/// Classify reqwest transport failures: timeout vs DNS/connect/network vs other.
pub fn classify_transport_kind(error: &reqwest::Error) -> TransportKind {
    if error.is_timeout() {
        return TransportKind::Timeout;
    }
    if error.is_connect() {
        return TransportKind::Network;
    }
    TransportKind::Other
}

pub fn transport_kind_to_code(kind: TransportKind) -> &'static str {
    match kind {
        TransportKind::Timeout => ERR_TIMEOUT,
        TransportKind::Network => ERR_NETWORK,
        TransportKind::Other => ERR_TRANSPORT,
    }
}

fn classify_transport_error(error: &reqwest::Error) -> String {
    transport_kind_to_code(classify_transport_kind(error)).into()
}

/// Observable provider classification for HTTP status codes (429/5xx).
pub fn classify_http_status(status: u16) -> HttpStatusClass {
    if status == 429 {
        HttpStatusClass::ProviderRateLimit
    } else if (500..600).contains(&status) {
        HttpStatusClass::ProviderServerError
    } else if (200..400).contains(&status) {
        HttpStatusClass::Okish
    } else {
        HttpStatusClass::Other
    }
}

pub fn provider_error_code(status: u16) -> Option<&'static str> {
    match classify_http_status(status) {
        HttpStatusClass::ProviderRateLimit | HttpStatusClass::ProviderServerError => {
            Some(ERR_PROVIDER)
        }
        _ => None,
    }
}

/// Whether a completed public GET attempt should be retried (status-based).
pub fn should_retry_public_status(status: u16) -> bool {
    matches!(
        classify_http_status(status),
        HttpStatusClass::ProviderRateLimit | HttpStatusClass::ProviderServerError
    )
}

/// Whether a public transport error should be retried.
pub fn should_retry_public_transport(kind: TransportKind) -> bool {
    matches!(kind, TransportKind::Timeout | TransportKind::Network)
}

/// Bounded exponential backoff with deterministic small jitter.
/// `jitter_seed` is attempt-based for tests; production passes attempt index.
pub fn public_backoff_ms(attempt: u32, jitter_seed: u64) -> u64 {
    let exp = PUBLIC_BACKOFF_BASE_MS.saturating_mul(1u64 << attempt.min(3));
    let capped = exp.min(PUBLIC_BACKOFF_MAX_MS);
    let jitter = jitter_seed % (PUBLIC_BACKOFF_JITTER_MS + 1);
    capped.saturating_add(jitter)
}

fn runtime_jitter_seed(attempt: u32) -> u64 {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.subsec_nanos() as u64)
        .unwrap_or_default();
    nanos ^ u64::from(attempt)
}

async fn sleep_ms(ms: u64) {
    if ms == 0 {
        return;
    }
    // Non-blocking delay (tokio, same runtime as Tauri async commands).
    tokio::time::sleep(Duration::from_millis(ms)).await;
}

/// Max attempts for endpoint: EA market is never auto-retried at the bridge.
pub fn max_attempts_for(endpoint: Endpoint) -> u32 {
    match endpoint {
        Endpoint::Public => PUBLIC_MAX_ATTEMPTS,
        Endpoint::EaTransferMarket => 1,
    }
}

async fn send_once(
    client: &Client,
    url: Url,
    headers: HeaderMap,
) -> Result<EmbeddedHttpResponse, String> {
    let response = client
        .get(url)
        .headers(headers)
        .send()
        .await
        .map_err(|e| classify_transport_error(&e))?;

    if response.status().is_redirection() {
        return Err(ERR_REDIRECT.into());
    }
    if response
        .content_length()
        .is_some_and(|length| length > MAX_RESPONSE_BYTES as u64)
    {
        return Err(ERR_TOO_LARGE.into());
    }

    let status = response.status();
    // Sanitize final URL for IPC: host + path only (drop query).
    let final_url = {
        let u = response.url();
        format!(
            "{}://{}{}",
            u.scheme(),
            u.host_str().unwrap_or("invalid"),
            u.path()
        )
    };
    let response_headers = response
        .headers()
        .iter()
        .filter(|(name, _)| {
            matches!(
                name.as_str(),
                "content-type" | "content-length" | "cache-control" | "etag" | "last-modified"
            )
        })
        .filter_map(|(name, value)| value.to_str().ok().map(|value| format!("{name}: {value}")))
        .collect::<Vec<_>>()
        .join("\r\n");

    let mut body = Vec::new();
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|error| classify_transport_error(&error))?;
        if body.len() + chunk.len() > MAX_RESPONSE_BYTES {
            return Err(ERR_TOO_LARGE.into());
        }
        body.extend_from_slice(&chunk);
    }
    let text = String::from_utf8(body).map_err(|_| ERR_UTF8.to_string())?;

    // Preserve GM_xmlhttpRequest HTTP semantics while exposing a stable provider
    // classification to the embedded caller after the bounded retries are exhausted.
    let error_code = provider_error_code(status.as_u16()).map(str::to_string);

    Ok(EmbeddedHttpResponse {
        final_url,
        ready_state: 4,
        status: status.as_u16(),
        status_text: status.canonical_reason().unwrap_or("").to_string(),
        error_code,
        response_headers,
        response_text: text.clone(),
        response: text,
    })
}

pub async fn execute(request: EmbeddedHttpRequest) -> Result<EmbeddedHttpResponse, String> {
    if !request
        .method
        .as_deref()
        .unwrap_or("GET")
        .eq_ignore_ascii_case("GET")
    {
        return Err(ERR_METHOD.into());
    }

    let (url, endpoint) = authorize_url(&request.url).map_err(|_| ERR_ENDPOINT.to_string())?;
    let headers =
        authorize_headers(&request.headers, endpoint).map_err(|_| ERR_HEADER.to_string())?;
    let timeout_ms = request
        .timeout
        .unwrap_or(DEFAULT_TIMEOUT_MS)
        .clamp(1, MAX_TIMEOUT_MS);
    let client = Client::builder()
        .redirect(Policy::none())
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_millis(timeout_ms))
        .user_agent("FSU-Companion/0.1")
        .build()
        .map_err(|_| ERR_TRANSPORT.to_string())?;

    let attempts = max_attempts_for(endpoint);

    let mut last_err = ERR_TRANSPORT.to_string();
    for attempt in 0..attempts {
        match send_once(&client, url.clone(), headers.clone()).await {
            Ok(response) => {
                // Bounded retry only for public idempotent GET provider errors (429/5xx).
                // EA market never retries. Final attempt returns the response as-is.
                if endpoint == Endpoint::Public
                    && attempt + 1 < attempts
                    && should_retry_public_status(response.status)
                {
                    let delay = public_backoff_ms(attempt, runtime_jitter_seed(attempt));
                    sleep_ms(delay).await;
                    continue;
                }
                return Ok(response);
            }
            Err(err) => {
                last_err = err.clone();
                // Retry public GET only for timeout/network; never retry redirect/policy/size.
                let kind = if err == ERR_TIMEOUT {
                    Some(TransportKind::Timeout)
                } else if err == ERR_NETWORK {
                    Some(TransportKind::Network)
                } else {
                    None
                };
                let retryable = endpoint == Endpoint::Public
                    && attempt + 1 < attempts
                    && kind.is_some_and(should_retry_public_transport);
                if retryable {
                    let delay = public_backoff_ms(attempt, runtime_jitter_seed(attempt));
                    sleep_ms(delay).await;
                    continue;
                }
                return Err(last_err);
            }
        }
    }
    Err(last_err)
}

#[tauri::command]
pub async fn embedded_http_request(
    webview: WebviewWindow,
    request: EmbeddedHttpRequest,
) -> Result<EmbeddedHttpResponse, String> {
    if webview.label() != super::window::FUT_WINDOW_LABEL {
        return Err("HTTP bridge is restricted to the FUT WebView".into());
    }
    execute(request).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;
    use std::fs;
    use std::path::PathBuf;

    fn corpus() -> Value {
        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../shared/request-policy-corpus.json");
        let raw = fs::read_to_string(&path).unwrap_or_else(|e| panic!("read corpus {path:?}: {e}"));
        assert!(
            !raw.to_ascii_lowercase().contains("x-ut-sid\": \"session"),
            "corpus must not embed live session material"
        );
        serde_json::from_str(&raw).expect("corpus json")
    }

    #[test]
    fn shared_corpus_url_cases() {
        let data = corpus();
        for case in data["urlCases"].as_array().expect("urlCases") {
            let id = case["id"].as_str().unwrap_or("?");
            let url = case["url"].as_str().expect("url");
            let method = case["method"].as_str().unwrap_or("GET");
            let expect = case["expect"].as_str().expect("expect");
            if method != "GET" {
                assert_eq!(expect, "deny", "{id}: non-GET must be deny");
                // authorize_url only runs for GET path in execute; still ensure URL policy
                // is independent of method for allow hosts when method would fail first.
                continue;
            }
            let result = authorize_url(url);
            match expect {
                "allow" => assert!(result.is_ok(), "{id}: expected allow for {url}"),
                "deny" => assert!(result.is_err(), "{id}: expected deny for {url}"),
                other => panic!("{id}: unknown expect {other}"),
            }
            if let Ok((_, endpoint)) = result {
                if let Some(expected) = case["endpoint"].as_str() {
                    match expected {
                        "public" => assert_eq!(endpoint, Endpoint::Public, "{id}"),
                        "ea_transfer_market" => {
                            assert_eq!(endpoint, Endpoint::EaTransferMarket, "{id}")
                        }
                        _ => {}
                    }
                }
            }
        }
    }

    #[test]
    fn shared_corpus_header_cases() {
        let data = corpus();
        for case in data["headerCases"].as_array().expect("headerCases") {
            let id = case["id"].as_str().unwrap_or("?");
            let endpoint = match case["endpoint"].as_str().unwrap_or("public") {
                "ea_transfer_market" => Endpoint::EaTransferMarket,
                _ => Endpoint::Public,
            };
            let mut headers = HashMap::new();
            if let Some(obj) = case["headers"].as_object() {
                for (k, v) in obj {
                    headers.insert(k.clone(), v.as_str().unwrap_or("").to_string());
                }
            }
            let expect = case["expect"].as_str().unwrap();
            let result = authorize_headers(&headers, endpoint);
            match expect {
                "accept" => {
                    assert!(result.is_ok(), "{id}: expected accept");
                    // User-Agent must be dropped
                    if headers.keys().any(|k| k.eq_ignore_ascii_case("user-agent")) {
                        assert!(
                            result.unwrap().get("user-agent").is_none(),
                            "{id}: UA must be dropped"
                        );
                    }
                }
                "reject_or_drop" => {
                    // Companion rejects unknown/forbidden headers (strict).
                    assert!(
                        result.is_err(),
                        "{id}: companion must reject forbidden header"
                    );
                }
                other => panic!("{id}: unknown expect {other}"),
            }
        }
    }

    #[test]
    fn endpoint_policy_matches_extension_rules() {
        assert!(authorize_url("https://api.fut.to/26/updata.json").is_ok());
        assert!(authorize_url("https://www.fut.gg/api/fut/player-prices/26/?ids=1%2C2").is_ok());
        assert!(authorize_url(
            "https://utas.mob.v5.prd.futc-ext.gcp.ea.com/ut/game/fc26/transfermarket?num=21"
        )
        .is_ok());
        assert!(authorize_url("https://api.fut.to/26/not-allowed.json").is_err());
        assert!(authorize_url("https://evil.example/26/updata.json").is_err());
        assert!(authorize_url("http://api.fut.to/26/updata.json").is_err());
    }

    #[test]
    fn header_policy_is_endpoint_specific() {
        let public = HashMap::from([("Content-Type".into(), "application/json".into())]);
        assert!(authorize_headers(&public, Endpoint::Public).is_ok());

        let sid = HashMap::from([("X-UT-SID".into(), "redacted-test-value".into())]);
        assert!(authorize_headers(&sid, Endpoint::Public).is_err());
        assert!(authorize_headers(&sid, Endpoint::EaTransferMarket).is_ok());

        let cookie = HashMap::from([("Cookie".into(), "never".into())]);
        assert!(authorize_headers(&cookie, Endpoint::EaTransferMarket).is_err());

        let user_agent = HashMap::from([("User-Agent".into(), "page supplied".into())]);
        assert!(authorize_headers(&user_agent, Endpoint::Public)
            .unwrap()
            .is_empty());
    }

    #[test]
    fn error_codes_have_no_url_or_secrets() {
        for code in [
            ERR_METHOD,
            ERR_ENDPOINT,
            ERR_HEADER,
            ERR_REDIRECT,
            ERR_TOO_LARGE,
            ERR_UTF8,
            ERR_TRANSPORT,
            ERR_TIMEOUT,
            ERR_NETWORK,
            ERR_PROVIDER,
        ] {
            assert!(!code.contains('?'));
            assert!(!code.contains("http"));
            assert!(!code.contains("SID"));
        }
    }

    #[test]
    fn transport_kinds_map_to_stable_codes() {
        assert_eq!(transport_kind_to_code(TransportKind::Timeout), ERR_TIMEOUT);
        assert_eq!(transport_kind_to_code(TransportKind::Network), ERR_NETWORK);
        assert_eq!(transport_kind_to_code(TransportKind::Other), ERR_TRANSPORT);
        assert_ne!(ERR_TIMEOUT, ERR_NETWORK);
    }

    #[test]
    fn provider_status_classification_is_observable() {
        assert_eq!(
            classify_http_status(429),
            HttpStatusClass::ProviderRateLimit
        );
        assert_eq!(
            classify_http_status(500),
            HttpStatusClass::ProviderServerError
        );
        assert_eq!(
            classify_http_status(503),
            HttpStatusClass::ProviderServerError
        );
        assert_eq!(classify_http_status(200), HttpStatusClass::Okish);
        assert_eq!(classify_http_status(404), HttpStatusClass::Other);
        assert_eq!(provider_error_code(429), Some(ERR_PROVIDER));
        assert_eq!(provider_error_code(502), Some(ERR_PROVIDER));
        assert_eq!(provider_error_code(200), None);
        assert_eq!(provider_error_code(404), None);
        assert!(should_retry_public_status(429));
        assert!(should_retry_public_status(503));
        assert!(!should_retry_public_status(200));
        assert!(!should_retry_public_status(404));

        let response = EmbeddedHttpResponse {
            final_url: "https://api.fut.to/26/meta.json".into(),
            ready_state: 4,
            status: 503,
            status_text: "Service Unavailable".into(),
            error_code: provider_error_code(503).map(str::to_string),
            response_headers: String::new(),
            response_text: String::new(),
            response: String::new(),
        };
        let serialized = serde_json::to_value(response).expect("serialize response");
        assert_eq!(serialized["errorCode"], ERR_PROVIDER);
    }

    #[test]
    fn public_backoff_is_bounded_and_deterministic() {
        let d0 = public_backoff_ms(0, 0);
        let d1 = public_backoff_ms(1, 0);
        let d2 = public_backoff_ms(2, 0);
        assert_eq!(d0, PUBLIC_BACKOFF_BASE_MS); // 50 + 0 jitter
        assert_eq!(d1, PUBLIC_BACKOFF_BASE_MS * 2);
        assert!(d2 >= d1);
        assert!(public_backoff_ms(10, 0) <= PUBLIC_BACKOFF_MAX_MS + PUBLIC_BACKOFF_JITTER_MS);
        // Same seed → same delay
        assert_eq!(public_backoff_ms(1, 7), public_backoff_ms(1, 7));
        // Jitter is small and bounded
        let with_j = public_backoff_ms(0, PUBLIC_BACKOFF_JITTER_MS);
        assert_eq!(with_j, PUBLIC_BACKOFF_BASE_MS + PUBLIC_BACKOFF_JITTER_MS);
    }

    #[test]
    fn ea_market_never_retries_at_bridge() {
        assert_eq!(max_attempts_for(Endpoint::EaTransferMarket), 1);
        assert!(max_attempts_for(Endpoint::Public) > 1);
        // Transport retry helper only applies to public path in execute.
        assert!(should_retry_public_transport(TransportKind::Timeout));
        assert!(should_retry_public_transport(TransportKind::Network));
        assert!(!should_retry_public_transport(TransportKind::Other));
    }

    #[test]
    fn production_inventory_matches_authorize_url() {
        let data = corpus();
        let endpoints = data["productionEndpoints"]
            .as_array()
            .expect("productionEndpoints required for drift detection");
        assert!(!endpoints.is_empty());

        let mut inventory_hosts = std::collections::BTreeSet::new();
        for ep in endpoints {
            let host = ep["host"].as_str().expect("host");
            inventory_hosts.insert(host.to_string());
            let endpoint_label = ep["endpoint"].as_str().unwrap_or("public");
            for path in ep["paths"].as_array().expect("paths") {
                let path = path.as_str().unwrap();
                let url = format!("https://{host}{path}");
                let result = authorize_url(&url);
                assert!(
                    result.is_ok(),
                    "inventory path must authorize: {url} ({})",
                    ep["id"]
                );
                let (_, classified) = result.unwrap();
                match endpoint_label {
                    "public" => assert_eq!(classified, Endpoint::Public, "{url}"),
                    "ea_transfer_market" => {
                        assert_eq!(classified, Endpoint::EaTransferMarket, "{url}")
                    }
                    other => panic!("unknown endpoint label {other}"),
                }
            }
        }

        // Companion production hosts must equal inventory (no silent extras).
        // Spot-check known denials outside inventory stay denied.
        assert!(authorize_url("https://www.futnext.com/anything").is_err());
        assert!(authorize_url("https://www.futnext.com/pack/Gold-Pack/1001/open").is_ok());
        assert!(authorize_url("https://evil.example/26/updata.json").is_err());

        // Every allow urlCase host must appear in inventory.
        for case in data["urlCases"].as_array().unwrap() {
            if case["expect"].as_str() != Some("allow") {
                continue;
            }
            let url = Url::parse(case["url"].as_str().unwrap()).unwrap();
            let host = url.host_str().unwrap().to_string();
            assert!(
                inventory_hosts.contains(&host),
                "allow case host {host} missing from productionEndpoints"
            );
        }
    }

    #[test]
    fn invariants_fail_closed_get_only_size_limit() {
        let data = corpus();
        let inv = &data["invariants"];
        assert_eq!(
            inv["maxResponseBytes"].as_u64().unwrap(),
            MAX_RESPONSE_BYTES as u64
        );
        assert_eq!(inv["redirect"].as_str().unwrap(), "fail_closed");
        let methods = inv["methods"].as_array().unwrap();
        assert_eq!(methods.len(), 1);
        assert_eq!(methods[0].as_str().unwrap(), "GET");
    }
}
