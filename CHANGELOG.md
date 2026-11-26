# Changelog

## [Unreleased]

## [3.0.2] - 2026-11-26

### Fixed

- `/collect` events did not say how long their `visitorId` identifies the visitor, so the API's
  retention report, which counts only persistent visitor ids, could not use any events from this
  SDK. `trackPageView`, `trackEvent` and `identify` now send `visitorIdScope: "persistent"` when a
  `visitorId` is configured (constructor or `init`); it is left out for the generated per-day id.

[Unreleased]: https://github.com/entrolytics/node-sdk/compare/v3.0.2...HEAD
[3.0.2]: https://github.com/entrolytics/node-sdk/releases/tag/v3.0.2
