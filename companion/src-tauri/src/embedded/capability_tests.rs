//! Static capability isolation checks (no live WebView required).
//! H2: exact-set ACL inventory — mirrors scripts/check-acl-inventory.cjs.

#[cfg(test)]
mod tests {
    use std::collections::BTreeSet;
    use std::fs;
    use std::path::PathBuf;

    fn root() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
    }

    fn read(rel: &str) -> String {
        fs::read_to_string(root().join(rel)).unwrap_or_else(|e| panic!("read {rel}: {e}"))
    }

    fn parse_generate_handler(source: &str) -> BTreeSet<String> {
        let start = source
            .find("generate_handler![")
            .expect("generate_handler! present");
        let after = &source[start + "generate_handler![".len()..];
        let end = after.find(']').expect("generate_handler closing ]");
        let body = &after[..end];
        let mut set = BTreeSet::new();
        for line in body.lines() {
            let trimmed = line
                .split("//")
                .next()
                .unwrap_or("")
                .trim()
                .trim_end_matches(',')
                .trim();
            if trimmed.is_empty() {
                continue;
            }
            assert!(
                trimmed
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || c == '_'),
                "unexpected handler entry: {trimmed}"
            );
            assert!(
                set.insert(trimmed.to_string()),
                "duplicate handler: {trimmed}"
            );
        }
        set
    }

    fn parse_toml_allow(toml: &str) -> BTreeSet<String> {
        let start = toml.find("commands.allow").expect("commands.allow present");
        let after = &toml[start..];
        let bracket = after.find('[').expect("allow list [");
        let rest = &after[bracket + 1..];
        let end = rest.find(']').expect("allow list ]");
        let body = &rest[..end];
        let mut set = BTreeSet::new();
        for cap in body.split('"').skip(1).step_by(2) {
            if !cap.trim().is_empty() && !cap.contains('\n') {
                assert!(set.insert(cap.to_string()), "duplicate allow: {cap}");
            }
        }
        set
    }

    #[test]
    fn exact_set_handler_matches_acl_union() {
        let handler = parse_generate_handler(&read("src/lib.rs"));
        let main = parse_toml_allow(&read("permissions/main-commands.toml"));
        let http = parse_toml_allow(&read("permissions/embedded-http.toml"));

        // Disjoint
        for cmd in &main {
            assert!(
                !http.contains(cmd),
                "command in both main and http ACL: {cmd}"
            );
        }

        let mut union = main.clone();
        union.extend(http.iter().cloned());
        assert_eq!(
            handler, union,
            "generate_handler! must equal main∪http exact set\nhandler={handler:?}\nunion={union:?}"
        );

        assert_eq!(
            http,
            BTreeSet::from(["embedded_http_request".to_string()]),
            "HTTP ACL must be exactly embedded_http_request"
        );
    }

    #[test]
    fn fut_capability_has_only_http_bridge_permission() {
        let raw = read("capabilities/fut.json");
        let json: serde_json::Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(json["identifier"], "fut-remote");
        assert_eq!(json["windows"], serde_json::json!(["fut"]));
        assert_eq!(json["local"], false);
        assert_eq!(
            json["permissions"],
            serde_json::json!(["allow-embedded-http-request"])
        );
        let urls = json["remote"]["urls"].as_array().expect("remote URLs");
        assert!(!urls.is_empty());
        assert!(urls.iter().all(|url| {
            let value = url.as_str().unwrap_or("");
            !value.contains("localhost")
                && !value.contains("127.0.0.1")
                && (value.starts_with("https://www.ea.com/")
                    || value.starts_with("https://www.easports.com/"))
        }));
        let perms = json["permissions"].as_array().expect("permissions array");
        for p in perms {
            let s = p.as_str().unwrap_or("");
            assert_ne!(s, "core:default");
            assert!(!s.starts_with("opener"));
            assert_ne!(s, "allow-main-commands");
        }
    }

    #[test]
    fn main_capability_does_not_include_fut_window() {
        let raw = read("capabilities/default.json");
        let json: serde_json::Value = serde_json::from_str(&raw).unwrap();
        let windows = json["windows"].as_array().unwrap();
        assert!(windows.iter().any(|w| w == "main"));
        assert!(!windows.iter().any(|w| w == "fut"));
        let perms: BTreeSet<String> = json["permissions"]
            .as_array()
            .unwrap()
            .iter()
            .filter_map(|p| p.as_str().map(str::to_string))
            .collect();
        assert!(perms.contains("core:default"));
        assert!(perms.contains("allow-main-commands"));
        assert!(!perms.contains("allow-embedded-http-request"));
        assert!(!raw.contains("opener:"));
    }

    #[test]
    fn fut_denies_main_command_names_in_capability_file() {
        let raw = read("capabilities/fut.json");
        for denied in [
            "privileged_main_only_ping",
            "get_settings",
            "update_settings",
            "get_diagnostics",
            "open_fut_web_app",
            "reset_companion_settings",
            "export_diagnostics_json",
            "clear_embedded_site_data_cmd",
            "check_update_status",
            "allow-main-commands",
            "core:default",
        ] {
            assert!(
                !raw.contains(denied),
                "fut capability must not mention {denied}"
            );
        }
    }

    #[test]
    fn main_permission_exact_set_covers_lifecycle_and_settings() {
        let main = parse_toml_allow(&read("permissions/main-commands.toml"));
        for command in [
            "get_companion_status",
            "get_settings",
            "update_settings",
            "reset_companion_settings",
            "get_diagnostics",
            "export_diagnostics_json",
            "open_fut_web_app",
            "open_fut_browser_fallback",
            "show_embedded_fut",
            "reload_embedded_fut",
            "embedded_go_back",
            "embedded_go_forward",
            "embedded_go_home",
            "hide_embedded_fut",
            "get_embedded_status_cmd",
            "clear_embedded_site_data_cmd",
            "check_update_status",
            "privileged_main_only_ping",
        ] {
            assert!(
                main.contains(command),
                "missing main command in ACL: {command}"
            );
        }
        assert!(!main.contains("embedded_http_request"));
    }

    #[test]
    fn generated_acl_manifest_lists_permission_identifiers() {
        // Snapshot-style assertion against Tauri-generated schema inventory when present.
        let schema = root().join("gen/schemas/capabilities.json");
        if !schema.exists() {
            // Generated at build time; skip soft if clean checkout without build.
            return;
        }
        let raw = fs::read_to_string(schema).unwrap();
        assert!(
            raw.contains("allow-main-commands") || raw.contains("main-commands"),
            "generated capabilities should reference main-commands permission"
        );
        assert!(
            raw.contains("allow-embedded-http-request") || raw.contains("embedded-http"),
            "generated capabilities should reference embedded-http permission"
        );
        // Production must not open localhost for fut remote.
        assert!(!raw.contains("http://localhost"));
    }
}
