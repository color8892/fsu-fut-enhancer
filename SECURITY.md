# Security Policy

## Supported versions

| Version | Security support |
|---------|------------------|
| Latest [GitHub Release](https://github.com/color8892/fsu-fut-enhancer/releases/latest) | Supported |
| `main` | Best effort; development code |
| Older releases and forks | Not supported |

## Security model

FSU runs across three trust boundaries:

1. The Chrome extension service worker and isolated content script.
2. The EA FUT page world, including EA and third-party page scripts.
3. Remote EA, pricing, SBC, and configuration services.

FSU Companion adds a fourth boundary: its local `main` WebView is trusted, while the remote `fut` WebView is untrusted and receives no core, opener, filesystem, or shell permissions.

Code running in the page world is not trusted merely because it is on an allowed EA origin. Messages arriving from `window.postMessage` must be treated as attacker-controlled.

### Required controls

- Content scripts and web-accessible resources are limited to FUT Web App pages.
- Background requests use an origin and path allowlist; callers cannot authorize arbitrary URLs.
- HTTP methods, forwarded headers, credentials, redirects, timeout, and response size are constrained by the background policy.
- Executable JavaScript is packaged with the extension. Remote code fallbacks are not allowed.
- Remote text must use `textContent` or escaping before entering a trusted HTML helper.
- New host permissions require a documented feature need and rejection tests.
- Companion's Embedded HTTP bridge is GET-only and independently validates the caller window, remote capability URL, endpoint path, headers, timeout, redirects, and 5 MB response limit.
- Embedded runtime scripts execute only on the exact FUT host/path; EA authentication pages do not receive FSU globals or UI.

See [ARCHITECTURE.md](ARCHITECTURE.md#extension-安全邊界) for the implementation flow.

## Data handling

FSU stores user preferences and local feature caches in `chrome.storage.local`. It may process FUT session identifiers in memory when making EA requests. These values must never be written to logs, fixtures, screenshots, issues, or repository files.

The repository must not contain:

- EA account identifiers or session tokens
- cookies, authorization headers, `X-UT-SID`, or HAR captures
- private API credentials
- unsanitized EA bundle snapshots containing user data

Third-party API responses are untrusted input. Compromise or incorrect output from a pricing service must not grant script execution in the FUT page.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability.

Use GitHub private vulnerability reporting:

[Report a vulnerability privately](https://github.com/color8892/fsu-fut-enhancer/security/advisories/new)

Maintainers should use **Security → Advisories → New draft** when coordinating a fix. We aim to acknowledge reports within 7 days and provide a status update within 30 days when possible.

Include:

- affected FSU version and browser version
- affected URL, component, and trust boundary
- reproduction steps with secrets removed
- expected impact and whether user interaction is required
- suggested mitigation, if known

## Scope

In scope:

- extension privilege escalation or permission abuse
- cross-origin request policy bypass
- page-to-extension message forgery with additional security impact
- script or HTML injection caused by FSU
- exposure of locally stored FSU data or FUT session values

Generally out of scope:

- vulnerabilities that exist only in EA, Chrome, or a third-party API
- stale or inaccurate market data without a security impact
- reports solely about EA Terms of Service compliance
- denial of service requiring deliberate local modification of extension files

## Safe harbor

We appreciate good-faith research that avoids privacy violations, account access, destructive actions, market abuse, and disruption to other users. Do not test against accounts or data you do not own or have permission to use.
