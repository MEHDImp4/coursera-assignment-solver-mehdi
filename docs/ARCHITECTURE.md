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
- The progressive adapter currently uses this module for editor detection and **read-model** requests.
- The legacy write path remains in `content.js` for now to avoid changing mutation behavior during this refactor.

### Browser integration

- `content.js` — legacy integration layer. It still owns Chrome messaging, legacy state capture, mutation actions, write-side Monaco behavior, completion flows, and banners.
- `content-adapters.js` — transition layer loaded after `content.js`. It delegates parsing, course metadata normalization, course-scoped read cache, course-material URL construction, and Monaco read inspection to the extracted modules.
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
6. `content.js`
7. `content-adapters.js`

The extracted modules are available before the legacy script executes, and the adapter then replaces selected legacy entry points with tested implementations.

## Course-scoped cache

The legacy `capturedCourseMaterials` variable is global to the content-script lifetime. Coursera can navigate between course routes without a full tab reload, so reusing that cache without checking the active course can return stale materials.

`coursera-state.js` associates cached materials with a `courseSlug`. Changing the active slug invalidates a mismatched cache. The adapter keeps the legacy variables synchronized after a fresh fetch so existing integration code continues to function.

The modular state snapshot is deliberately metadata-only:

- current course slug;
- whether course materials are cached;
- names of observed allowlisted CSRF/request headers;
- whether a user-context response was observed.

It never returns header values, cookies, authorization data, CSRF values, or learner IDs.

## Why progressive extraction?

`content.js` mixes network state, course parsing, assessment parsing, Monaco integration, UI feedback, and mutation behavior. Rewriting it wholesale would create a large regression surface. Progressive extraction allows each responsibility to gain fixtures and tests first, then lets duplicated legacy implementations be removed in smaller follow-up changes.

## Fixtures

Sanitized regression fixtures live under `tests/fixtures/`.

- `course-materials-confirmed.json` represents a small course-material response with confirmed passable metadata.
- `assessment-basic.html` represents the structural markers for common assessment types without real course content, account identifiers, tokens, or answers.

Fixtures must never contain cookies, authorization headers, CSRF values, real learner IDs, real assessment answers, or copied private course content.

## Test strategy

The GitHub Actions workflow runs:

- `node --check` against extension JavaScript files;
- unit tests for provider request construction;
- unit tests for course requirements normalization;
- unit tests for assessment classification and selector strategy;
- course-state/cache isolation tests;
- Monaco bridge validation/transport tests;
- interception-policy tests;
- Dry Run diagnostics tests;
- popup/manifest/module-load contract tests.

## Current migration status

Extracted and covered by tests:

- course-requirement normalization;
- assessment selector strategy and question-shell parsing;
- course-material API URL/response helpers;
- read-side course state and course-scoped materials cache;
- Monaco editor detection and read-side bridge transport;
- interception minimization policy;
- read-only diagnostics.

Still intentionally legacy:

- Chrome message routing;
- banner/presentation helpers;
- write-side Monaco application path;
- course completion/media mutation flows;
- duplicated helper definitions inside `content.js` until browser smoke coverage is strong enough to remove them safely.

## Next extraction candidates

The next safe refactors are:

1. add browser smoke tests around the read-only fixture harness;
2. remove duplicated legacy course-requirement/API helper implementations after the browser harness proves the adapter path;
3. move banner/UI feedback into a small presentation adapter;
4. continue shrinking `content.js` without expanding live assessment automation behavior.

Automatic assessment submission is intentionally outside the scope of this architecture work.
