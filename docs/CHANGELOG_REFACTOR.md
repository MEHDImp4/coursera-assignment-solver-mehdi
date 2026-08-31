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
- Kept the existing Monaco write path outside the read-side refactor.
- Added state and Monaco regression tests.

## Phase 4 — Browser read-only smoke coverage

- Added a real Chrome/Chromium headless smoke harness using only sanitized local fixtures.
- Verified assessment parsing and Monaco descriptor discovery in-browser.
- Added before/after DOM and form-control snapshots to prove the read path does not modify fixtures.
- Added the smoke harness to normal GitHub Actions CI.

## Phase 5 — Remove duplicated read-only legacy helpers

- Replaced covered read-only implementations in `content.js` with `CourseraReadRuntime` delegates.
- Removed duplicated course-material request construction, normalization, selector parsing, Monaco descriptor discovery, and detailed read scraping.
- Removed more than 300 legacy lines from `content.js` during the first cleanup pass.
- Added `tests/content-read-runtime-contract.test.js` to prevent removed read-only implementations from returning.
- Kept mutation-oriented integration outside this cleanup.

## Phase 6 — Presentation extraction

- Added `presentation.js` for the in-page status banner, spinner style, accessibility attributes, and show/hide timing.
- Replaced banner DOM implementation in `content.js` with thin presentation delegates.
- Switched dynamic messages from `innerHTML` to safe text-node rendering.
- Added stale-hide cancellation so an older timer cannot remove a refreshed banner.
- Added presentation unit/contract coverage.

## Phase 7 — Selector resilience and malformed fixtures

- Added sanitized legacy, mixed, and malformed assessment fixtures.
- Allowed semantic and legacy selector families to coexist on partially migrated pages.
- Deduplicated dual-matched/nested blocks and preserved document order.
- Filtered promptless candidates before extraction.
- Added metadata-only invalid-candidate and selected-block diagnostics.
- Added explicit `mixed` strategy reporting.
- Expanded Chrome smoke coverage to all assessment fixtures with no-mutation snapshots.

## Phase 8 — SPA navigation and cache consistency

- Extended `coursera-state.js` with `syncLocation`, `clearCourse`, `onCourseRoute`, and `courseRevision`.
- Preserved cache on navigation within the same course.
- Invalidated stale materials when the course slug changes.
- Cleared active course/cache when navigation leaves `/learn/<slug>/...`.
- Synchronized read state from initial URL, `popstate`, `hashchange`, and a read-only `MutationObserver` URL check.
- Tightened legacy-cache seeding so materials are reused only when the captured course ID exactly matches the active route.
- Added SPA transition regression tests.

## Phase 9 — Dedicated read-only Chrome message routing

- Added `read-message-router.js`.
- Moved `getSelection`, `getCourseRequirements`, `getGradedAssignments`, and `getParserDiagnostics` out of the large legacy listener.
- Reduced read-only failures to message-only error objects without stack traces.
- Contract-tested the router to reject mutation-oriented actions and mutation primitives.
- Removed now-unused course-loading/normalization helper delegates from `content.js`.
- Left the existing mutation-oriented listener and write paths outside the refactor.

## Phase 10 — Final security and repository hygiene gate

- Removed the unused Manifest `scripting` permission; extension permissions are now `activeTab` and `storage`.
- Added `tests/repo-hygiene.test.js` to reject checked-in write-enabled/temporary workflows, permission creep, content-script scope drift, and credential-like fixture data.
- Added `read-message-router.js` to manifest load-order and syntax-CI contracts.
- Removed the final temporary write-enabled cleanup workflow after its guarded mechanical patch passed syntax, Node tests, and Chrome smoke coverage.
- Updated architecture documentation to record the final safe refactor boundary.

## Status

All planned safe refactor phases are complete in this PR. Permanent validation consists of full JavaScript syntax checks, the complete Node unit/contract/hygiene suite, and the real Chrome/Chromium read-only smoke harness.

Mutation-oriented answer filling, write-side Monaco behavior, submission/completion flows, and their required legacy integration state remain intentionally outside this refactor and were not enhanced.
