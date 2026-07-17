## Scope

- Feature or capability:
- Patch family / installer phase:
- Explicitly out of scope:

## Behavior

- Current behavior:
- Target behavior:
- Compatibility or setting migration:

## Runtime Boundary

- EA classes, methods, services or repositories used:
- Adapter capability and result contract:
- Unsupported-capability fallback:
- Feature disable / restore path:

## Risk

- User-visible failure mode:
- Write or automation risk:
- Rollback plan:
- Security boundary affected:

## Verification

- [ ] Characterization test added before behavior changes
- [ ] Success, malformed and unavailable results tested
- [ ] Patch ID, phase, verify, idempotence and restore covered
- [ ] `npm run lint`
- [ ] `npm run test:all`
- [ ] `npm run package`
- [ ] `npm run check:ea-bundle -- --bundles <local-ea-bundle-dir>` when EA hooks changed
- [ ] `src/userscript.js` rebuilt only through `npm run build`
- [ ] Browser/manual verification recorded
- [ ] Logs, fixtures and screenshots contain no session or account data

## Evidence

Describe fixtures, browser path, relevant diagnostics and any verification that could not
be run locally.
