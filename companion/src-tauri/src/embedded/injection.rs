//! Local packaged runtime injection for the FUT webview.
//! Scripts are build-time artifacts only — never fetched from the network.

use super::navigation_policy::{classify_url, UrlClass};

/// Marker object name on `window` for idempotence.
pub const RUNTIME_MARKER: &str = "__FSU_EMBEDDED_RUNTIME_V1__";
pub const RUNTIME_REPORT_PREFIX: &str = "__FSU_RUNTIME_V1__:";

/// Install order for documentation and tests.
pub const INJECTION_ORDER: &[&str] = &["marker", "host", "toolbar", "lodash", "userscript"];

/// Mutable runtime marker — host bootstrap must be able to set flags.
pub fn marker_script() -> String {
    format!(
        r#"(function(){{
  try {{
    if (window.{marker} && window.{marker}.version) return;
    window.{marker} = {{
      version: 1,
      host: false,
      lodash: false,
      userscript: false,
      toolbar: false,
      createdAt: Date.now()
    }};
    document.documentElement.setAttribute("data-fsu-embedded", "1");
  }} catch (e) {{}}
}})();"#,
        marker = RUNTIME_MARKER
    )
}

fn fut_runtime_guard(script: &str) -> String {
    format!(
        r#"(function(){{
  try {{
    var host = String(location.hostname || "").toLowerCase();
    var path = String(location.pathname || "");
    var isFutHost = host === "www.ea.com" || host === "www.easports.com";
    var isFutPath = /^\/(?:[A-Za-z0-9-]{{1,16}}\/)?ea-sports-fc\/ultimate-team\/web-app(?:\/|$)/.test(path);
    if (!isFutHost || !isFutPath || location.protocol !== "https:") return;
    {script}
  }} catch (_e) {{}}
}})();"#,
        script = script
    )
}

fn runtime_report_script(state: &str, token: &str) -> String {
    format!(
        r#"(function(){{
  try {{
    var previous = document.title;
    document.title = "{prefix}{token}:{state}";
    setTimeout(function() {{
      if (document.title === "{prefix}{token}:{state}") document.title = previous;
    }}, 0);
  }} catch (_e) {{}}
}})();"#,
        prefix = RUNTIME_REPORT_PREFIX,
        token = token,
        state = state
    )
}

/// Compact in-webview toolbar (history/location only — no Tauri IPC).
pub fn toolbar_script() -> String {
    r#"(function(){
  try {
    var M = window.__FSU_EMBEDDED_RUNTIME_V1__;
    if (!M || M.toolbar) return;
    if (document.getElementById("fsu-embedded-toolbar")) {
      M.toolbar = true;
      return;
    }
    var bar = document.createElement("div");
    bar.id = "fsu-embedded-toolbar";
    bar.setAttribute("data-fsu-ui", "toolbar");
    bar.style.cssText = [
      "position:fixed","top:0","left:0","right:0","z-index:2147483646",
      "height:36px","display:flex","align-items:center","gap:6px",
      "padding:0 8px","box-sizing:border-box",
      "background:rgba(22,26,33,0.94)","color:#e8eaed",
      "font:12px/1 system-ui,-apple-system,Segoe UI,sans-serif",
      "border-bottom:1px solid #2c333d","user-select:none"
    ].join(";");
    function mk(label, title, fn) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.title = title;
      b.setAttribute("aria-label", title);
      b.style.cssText = "appearance:none;border:1px solid #3a4250;background:#1b2028;color:#e8eaed;border-radius:4px;height:26px;padding:0 8px;cursor:pointer;font:inherit";
      b.addEventListener("click", function(e){ e.preventDefault(); e.stopPropagation(); try{fn();}catch(_e){} });
      b.addEventListener("mousedown", function(e){ e.preventDefault(); });
      return b;
    }
    bar.setAttribute("role", "toolbar");
    bar.setAttribute("aria-label", "FSU Embedded navigation");
    bar.appendChild(mk("←", "Back", function(){ history.back(); }));
    bar.appendChild(mk("→", "Forward", function(){ history.forward(); }));
    bar.appendChild(mk("↻", "Reload", function(){ location.reload(); }));
    bar.appendChild(mk("⌂", "Home", function(){
      location.href = "https://www.ea.com/ea-sports-fc/ultimate-team/web-app/";
    }));
    var spacer = document.createElement("span");
    spacer.style.flex = "1";
    bar.appendChild(spacer);
    var tag = document.createElement("span");
    tag.textContent = "FSU Embedded";
    tag.style.cssText = "opacity:0.65;font-size:11px";
    bar.appendChild(tag);
    function mount() {
      if (!document.documentElement) return;
      if (document.getElementById("fsu-embedded-toolbar")) return;
      (document.body || document.documentElement).appendChild(bar);
      var pad = document.documentElement.style.paddingTop || "";
      if (!document.documentElement.getAttribute("data-fsu-toolbar-pad")) {
        document.documentElement.style.paddingTop = "36px";
        document.documentElement.setAttribute("data-fsu-toolbar-pad", "1");
      }
      void pad;
    }
    if (document.body) mount();
    else document.addEventListener("DOMContentLoaded", mount, { once: true });
    M.toolbar = true;
  } catch (e) {}
})();"#
    .to_string()
}

/// Host bootstrap providing GM_* shims for the userscript without Chrome extension APIs.
pub fn host_bootstrap_script() -> String {
    include_str!("../../../resources/fsu/embedded-host.js").to_string()
}

pub fn lodash_script() -> Option<&'static str> {
    let s = include_str!("../../../resources/fsu/lodash.min.js");
    if s.trim().is_empty() || s.contains("PLACEHOLDER") {
        None
    } else {
        Some(s)
    }
}

pub fn userscript_bundle() -> Option<&'static str> {
    let s = include_str!("../../../resources/fsu/userscript.js");
    if s.trim().is_empty() || s.contains("PLACEHOLDER") {
        None
    } else {
        Some(s)
    }
}

/// Initialization script run on every document start in the fut webview.
pub fn initialization_script(full_runtime: bool, report_token: &str) -> String {
    let mut parts = vec![marker_script(), host_bootstrap_script(), toolbar_script()];
    if full_runtime {
        if let Some(lodash) = lodash_script() {
            parts.push(format!(
                r#"(function(){{
  try {{
    var m = window.{m};
    if (!m || m.lodash) return;
    {code}
    if (window.{m}) window.{m}.lodash = true;
  }} catch (e) {{ console.warn("[FSU embedded] lodash install failed", e && e.message); }}
}})();"#,
                m = RUNTIME_MARKER,
                code = lodash
            ));
        }
        if let Some(userscript) = userscript_bundle() {
            parts.push(format!(
                r#"(function(){{
  try {{
    var m = window.{m};
    if (!m || m.userscript) return;
    if (!location.href || location.href.indexOf("ultimate-team/web-app") === -1) return;
    {code}
    if (window.{m}) window.{m}.userscript = true;
    {ready}
  }} catch (e) {{
    console.warn("[FSU embedded] userscript install failed", e && e.message);
    try {{
      if (window.{m}) {{
        window.{m}.userscriptError = String((e && e.message) || e).slice(0, 120);
      }}
    }} catch (_e) {{}}
    {failed}
  }}
}})();"#,
                m = RUNTIME_MARKER,
                code = userscript,
                ready = runtime_report_script("ready", report_token),
                failed = runtime_report_script("failed", report_token)
            ));
        }
    }
    fut_runtime_guard(&parts.join("\n"))
}

pub fn should_install_userscript(url: &str) -> bool {
    matches!(classify_url(url), UrlClass::FutWebApp)
}

/// Idempotent ensure after page load.
pub fn ensure_runtime_eval_script(report_token: &str) -> String {
    format!(
        r#"(function(){{
  try {{
    if (!window.{m}) {{ {marker} }}
    if (typeof window.__FSU_EMBEDDED_ENSURE__ === "function") {{
      window.__FSU_EMBEDDED_ENSURE__();
    }}
    {toolbar}
    var m = window.{m} || {{}};
    var ready = !!m.host && !!m.lodash && !!m.userscript && !!m.toolbar &&
      typeof window.GM_addStyle === "function";
    if (ready) {{ {report} }} else {{ {failed} }}
    return ready;
  }} catch (e) {{
    {failed}
    return false;
  }}
}})()"#,
        m = RUNTIME_MARKER,
        marker = marker_script(),
        toolbar = toolbar_script(),
        report = runtime_report_script("ready", report_token),
        failed = runtime_report_script("failed", report_token)
    )
}

pub fn parse_runtime_report(title: &str, report_token: &str) -> Option<bool> {
    title
        .strip_prefix(&format!("{RUNTIME_REPORT_PREFIX}{report_token}:"))
        .and_then(|state| match state {
            "ready" => Some(true),
            "failed" => Some(false),
            _ => None,
        })
}

/// Describe install order for diagnostics (no script bodies).
pub fn runtime_pack_summary() -> Vec<String> {
    let mut out = INJECTION_ORDER[..3]
        .iter()
        .map(|name| (*name).to_string())
        .collect::<Vec<_>>();
    if lodash_script().is_some() {
        out.push("lodash:packaged".into());
    } else {
        out.push("lodash:missing".into());
    }
    if userscript_bundle().is_some() {
        out.push("userscript:packaged".into());
    } else {
        out.push("userscript:missing".into());
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn marker_is_idempotent_shape() {
        let s = marker_script();
        assert!(s.contains(RUNTIME_MARKER));
        assert!(s.contains("data-fsu-embedded"));
        assert!(s.contains("host: false"));
        assert!(!s.contains("Object.freeze"));
    }

    #[test]
    fn host_bootstrap_present() {
        let host = host_bootstrap_script();
        assert!(host.contains("GM_getValue"));
        assert!(host.contains("GM_addStyle"));
        assert!(host.contains("__FSU_EMBEDDED_ENSURE__"));
    }

    #[test]
    fn toolbar_is_local_only() {
        let t = toolbar_script();
        assert!(t.contains("fsu-embedded-toolbar"));
        assert!(t.contains("aria-label"));
        assert!(t.contains("role"));
        assert!(t.contains("history.back"));
        assert!(!t.contains("__TAURI__"));
        assert!(!t.contains("invoke"));
    }

    #[test]
    fn userscript_only_on_fut_app() {
        assert!(should_install_userscript(
            "https://www.ea.com/ea-sports-fc/ultimate-team/web-app/"
        ));
        assert!(!should_install_userscript(
            "https://signin.ea.com/p/juno/login"
        ));
        assert!(!should_install_userscript("https://evil.example/"));
    }

    #[test]
    fn init_script_order() {
        let init = initialization_script(false, "test-token");
        let marker_at = init.find(RUNTIME_MARKER).expect("marker");
        let host_at = init.find("GM_getValue").expect("host");
        let toolbar_at = init.find("fsu-embedded-toolbar").expect("toolbar");
        assert!(marker_at < host_at);
        assert!(host_at < toolbar_at);
        assert_eq!(INJECTION_ORDER[0], "marker");
    }

    #[test]
    fn initialization_is_gated_to_fut_pages() {
        let init = initialization_script(false, "test-token");
        assert!(init.contains("isFutHost"));
        assert!(init.contains("isFutPath"));
        assert!(init.contains("location.protocol !== \"https:\""));
    }

    #[test]
    fn runtime_report_parser_is_strict() {
        assert_eq!(
            parse_runtime_report("__FSU_RUNTIME_V1__:secret:ready", "secret"),
            Some(true)
        );
        assert_eq!(
            parse_runtime_report("__FSU_RUNTIME_V1__:secret:failed", "secret"),
            Some(false)
        );
        assert_eq!(parse_runtime_report("EA SPORTS FC", "secret"), None);
        assert_eq!(
            parse_runtime_report("__FSU_RUNTIME_V1__:other:ready", "secret"),
            None
        );
        assert_eq!(
            parse_runtime_report("__FSU_RUNTIME_V1__:secret:ready:extra", "secret"),
            None
        );
    }

    #[test]
    fn runtime_summary_lists_packages() {
        let s = runtime_pack_summary();
        assert!(s.iter().any(|x| x.starts_with("lodash:")));
        assert!(s.iter().any(|x| x.starts_with("userscript:")));
    }
}
