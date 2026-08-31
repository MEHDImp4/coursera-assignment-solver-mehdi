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

## Next

- Add browser smoke coverage for read-only fixture behavior.
- Remove duplicated legacy parsing/API helpers only after that coverage is stable.
- Extract presentation/banner helpers.
