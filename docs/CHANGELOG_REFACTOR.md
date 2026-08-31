# Refactor changelog

## Phase 1 — Read-only diagnostics and interception hardening

- Added Dry Run diagnostics that do not call an AI provider or modify the page.
- Added metadata-only diagnostic exports.
- Restricted intercepted Coursera traffic and removed unnecessary sensitive request data.
- Added GitHub Actions syntax and Node test checks.

## Phase 2 — Parsing and course metadata extraction

- Added `assessment-parser.js`.
- Added `course-requirements.js`.
- Added `coursera-api.js`.
- Added sanitized HTML/JSON fixtures and regression tests.
- Added progressive `content-adapters.js` delegation.

## Phase 3 — Course state and Monaco read extraction

- Added `coursera-state.js` with course-scoped materials caching.
- Added cache invalidation when the active course slug changes.
- Added sanitized state snapshots that never expose header values or learner IDs.
- Added `monaco-bridge.js` for editor discovery, URI/action validation, and read-side bridge transport.
- Kept the legacy Monaco write path unchanged during this phase.
- Added state and Monaco regression tests.

## Phase 4 — Browser read-only smoke coverage

- Added a real Chrome/Chromium headless smoke harness using only sanitized local fixtures.
- Verified semantic assessment parsing and Monaco descriptor discovery in-browser.
- Added before/after DOM and form-control snapshots to prove the read path does not modify the fixture.
- Added the smoke harness to the normal GitHub Actions workflow.

## Phase 5 — Remove duplicated read-only legacy helpers

- Replaced legacy read-only helper bodies in `content.js` with thin delegates to `CourseraReadRuntime`.
- Removed duplicated course-material request construction, course-requirement normalization, assessment selector parsing, Monaco descriptor discovery, and detailed read scraping from `content.js`.
- Removed 307 lines from `content.js` while adding only 13 delegate lines.
- Added `tests/content-read-runtime-contract.test.js` so the removed legacy implementations cannot silently return.
- Left existing mutation-oriented integration paths outside this cleanup.

## Phase 6 — Presentation extraction

- Added `presentation.js` for the in-page status banner, spinner style, accessibility attributes, and show/hide timing.
- Replaced the banner DOM implementation in `content.js` with thin presentation-runtime delegates.
- Switched dynamic banner messages away from `innerHTML` to safe text-node rendering.
- Added stale-hide cancellation so a refreshed banner is not removed by an older timeout.
- Added `tests/presentation.test.js` and `tests/content-presentation-contract.test.js`.
- Added the presentation module to manifest load-order contracts, syntax CI, and diagnostics metadata.
- Removed the temporary write-enabled cleanup workflow after the guarded refactor succeeded.

## Next

- Add more sanitized fixture variants for selector fallback and malformed structures.
- Reduce remaining integration-only state duplication without changing mutation behavior.
- Isolate generic Chrome message routing/error serialization from feature-specific actions.
