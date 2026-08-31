# Extension architecture

This fork is moving away from a single large `content.js` file through a progressive extraction strategy. The goal is to keep runtime behavior stable while moving testable responsibilities into focused modules.

## Runtime layers

### Pure modules

- `course-requirements.js` — normalizes Coursera course-material metadata into a stable list of grade-relevant activities.
- `assessment-parser.js` — owns assessment DOM selectors, question-block discovery, option extraction, and question-type classification.
- `coursera-api.js` — builds and validates course-material API requests and course slugs.
- `coursera-state.js` — keeps read-side course state and materials cache scoped to the active course. Diagnostics expose only header names and boolean context flags, never token/header values or learner IDs.
- `diagnostics.js` — converts parser results into metadata-only read-only reports.
- `intercept-policy.js` — defines which Coursera traffic and headers are safe to expose to the isolated extension world.

These modules are written so they can be loaded in the browser and required directly by Node tests.

### Monaco bridge

- `monaco-bridge.js` — identifies the editable Monaco model, validates model URIs/actions, and provides the window-message transport used for read-side editor inspection.
- The read runtime uses this module for editor detection and **read-model** requests.
- The legacy write path remains in `content.js` for now to avoid changing mutation behavior during this refactor.

### Presentation

- `presentation.js` — owns the in-page status banner, spinner style, hide/show timing, and accessibility attributes.
- Dynamic banner messages are rendered with `textContent`/text nodes instead of `innerHTML`, so message strings cannot be interpreted as injected markup.
- A pending hide timer is cancelled when a banner is refreshed, preventing an older timeout from removing a newer status message.
- `content.js` keeps only thin `showOrUpdateBanner` / `hideBanner` delegates to `globalThis.CourseraPresentation`.

### Browser integration

- `content.js` — orchestration/integration layer. Covered read-only and presentation helpers are thin delegates; Chrome message routing, mutation actions, write-side Monaco behavior, completion flows, and remaining integration logic stay here.
- `content-adapters.js` — creates `globalThis.CourseraReadRuntime` and owns the modular read path for parsing, course metadata normalization, course-scoped cache, course-material requests, and Monaco read inspection.
- `intercept.js` — MAIN-world network hook, constrained by `intercept-policy.js`.

### Popup

- `popup.js` — existing popup actions and provider configuration.
- `dry-run.js` — read-only assessment diagnostics UI.
- `diagnostics.js` — sanitizes the information shown/exported by Dry Run.

## Content-script load order

The isolated-world scripts intentionally load in this order:

1. `course-requirements.js`
2. `assessment-parser.js`
3. `coursera-api.js`
4. `coursera-state.js`
5. `monaco-bridge.js`
6. `presentation.js`
7. `content.js`
8. `content-adapters.js`

The extracted modules load before the integration layer. `presentation.js` exposes the banner presenter before `content.js` executes, while `content-adapters.js` exposes the stable `CourseraReadRuntime` object used by the read-only delegates.

## Course-scoped cache

The legacy `capturedCourseMaterials` variable is global to the content-script lifetime. Coursera can navigate between course routes without a full tab reload, so reusing that cache without checking the active course can return stale materials.

`coursera-state.js` associates cached materials with a `courseSlug`. Changing the active slug invalidates a mismatched cache. The adapter keeps the legacy variables synchronized after a fresh fetch so existing integration code continues to function.

The modular state snapshot is deliberately metadata-only:

- current course slug;
- whether course materials are cached;
- names of observed allowlisted CSRF/request headers;
- whether a user-context response was observed.

It never returns header values, cookies, authorization data, CSRF values, or learner IDs.

## Read-runtime cleanup

After browser smoke coverage was established, the duplicated read-only implementations were removed from `content.js`.

`content.js` now keeps only small delegates for:

- current course slug lookup;
- course-material loading;
- course-requirement normalization;
- assessment block discovery;
- Monaco editor description;
- detailed read-only assessment scraping.

The implementation for those responsibilities lives in `CourseraReadRuntime`, backed by the extracted modules. This removed more than 300 legacy lines from `content.js` without modifying the existing mutation-oriented paths.

`tests/content-read-runtime-contract.test.js` prevents the removed legacy helper bodies from being reintroduced and verifies that the adapter exposes a stable runtime object instead of reassigning legacy globals.

## Presentation cleanup

The original banner implementation created and styled its DOM directly inside `content.js`. That implementation has now been removed and replaced with delegates to `presentation.js`.

The presentation module is covered by unit tests for:

- info/success/error banner descriptors;
- safe literal rendering of strings that contain HTML-like markup;
- single spinner-style registration;
- cancellation of stale hide timers;
- absence of Chrome API dependencies and `innerHTML` usage.

`tests/content-presentation-contract.test.js` prevents the old banner DOM implementation from returning to `content.js`.

## Why progressive extraction?

`content.js` mixes network state, course parsing, assessment parsing, Monaco integration, UI feedback, and mutation behavior. Rewriting it wholesale would create a large regression surface. Progressive extraction lets each responsibility gain fixtures and tests first, then removes duplicated implementations only after the replacement path is covered.

## Fixtures

Sanitized regression fixtures live under `tests/fixtures/`.

- `course-materials-confirmed.json` represents a small course-material response with confirmed passable metadata.
- `assessment-basic.html` represents the structural markers for common assessment types without real course content, account identifiers, tokens, or answers.

Fixtures must never contain cookies, authorization headers, CSRF values, real learner IDs, real assessment answers, or copied private course content.

## Browser smoke harness

`tests/browser/read-only-smoke.html` runs the extracted parser and Monaco descriptor code in a real browser against the sanitized assessment fixture. `tests/browser/run-smoke.sh` serves the repository only on `127.0.0.1` and launches the Chrome/Chromium binary already available on the CI runner.

The smoke harness asserts that:

- four fixture questions are discovered;
- their detected types are `single_answer`, `multiple_answer`, `text_input`, and `code_expression`;
- the semantic selector strategy is selected;
- the Monaco model URI and language are discovered correctly;
- the fixture DOM and form-control state are byte-for-byte equivalent before and after read-side inspection.

The harness has no network dependency on Coursera, no AI-provider calls, and no Chrome-extension messaging.

## Test strategy

The GitHub Actions workflow runs:

- `node --check` against extension JavaScript files, including the extracted state, Monaco, and presentation modules;
- unit tests for provider request construction;
- unit tests for course requirements normalization;
- unit tests for assessment classification and selector strategy;
- course-state/cache isolation tests;
- Monaco bridge validation/transport tests;
- presentation rendering/timer tests;
- interception-policy tests;
- Dry Run diagnostics tests;
- popup/manifest/module-load contracts;
- read-runtime and presentation cleanup contracts;
- a real headless-browser smoke test against sanitized local fixtures.

## Current migration status

Extracted, delegated, and covered by tests:

- course-requirement normalization;
- assessment selector strategy and question-shell parsing;
- course-material API URL/response helpers;
- read-side course state and course-scoped materials cache;
- Monaco editor detection and read-side bridge transport;
- in-page banner presentation;
- interception minimization policy;
- read-only diagnostics;
- browser-level fixture verification with unchanged DOM/control state.

Still intentionally legacy:

- Chrome message routing;
- write-side Monaco application path;
- course completion/media mutation flows;
- other mutation-oriented integration code.

## Next extraction candidates

The next safe refactors are:

1. add more sanitized fixture variants for selector fallback and malformed structures;
2. reduce remaining integration-only state duplication where it can be done without changing mutation behavior;
3. isolate generic Chrome message routing/error serialization from feature-specific actions;
4. continue shrinking `content.js` without expanding live assessment automation behavior.

Automatic assessment submission is intentionally outside the scope of this architecture work.
