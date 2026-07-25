# Contributing to FSU

Thank you for helping improve FSU. Changes should preserve the extension's narrow
FUT-only scope, security boundaries, and compatibility with EA's evolving runtime.

## Before opening a change

1. Read [AGENTS.md](AGENTS.md), [ARCHITECTURE.md](ARCHITECTURE.md), and the relevant
   section of [ROADMAP.md](ROADMAP.md).
2. Keep feature logic in `extension/src/fsu/`; do not manually edit the generated
   `extension/src/userscript.js`.
3. Do not include cookies, session identifiers, account data, HAR files, or private
   EA bundle snapshots.
4. Add focused tests for success, malformed input, unavailable capabilities, and
   lifecycle restore behavior where applicable.

## Verification

```bash
cd extension
npm ci
npx playwright install chromium
npm run check:version
npm run lint
npm run test:ci
npm run package
npm run package:smoke
```

Changes to EA patches should also run:

```bash
npm run check:ea-bundle -- --bundles <local-ea-bundle-directory>
```

Use the pull request template to record affected capabilities, security boundaries,
fallback behavior, verification evidence, and anything that could not be tested.

Security vulnerabilities must be reported privately according to
[SECURITY.md](SECURITY.md), not through a public issue.
