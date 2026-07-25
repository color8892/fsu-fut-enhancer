# Changelog

All notable user-visible and maintenance changes are recorded here.

## [Unreleased]

### Security

- Enforce the 5 MB remote response limit while streaming instead of after buffering.
- Restrict page-world storage access to known FSU keys and bounded values.
- Restrict extension-created tabs to documented FSU destinations.
- Limit web-accessible resources to EA origins and per-session dynamic URLs while
  keeping content-script injection restricted to FUT Web App paths.

### Changed

- Bump the development version to 26.10.0.
- Add release tag and cross-file version consistency checks.
- Remove stale Companion references from the extension security model.

## [26.9.0] - 2026-06-30

- Publish the initial GitHub release of the Manifest V3 extension.

[Unreleased]: https://github.com/color8892/fsu-fut-enhancer/compare/v26.9.0...HEAD
[26.9.0]: https://github.com/color8892/fsu-fut-enhancer/releases/tag/v26.9.0
