# Extension architecture

This fork is moving away from a single large `content.js` file through a progressive extraction strategy. The goal is to keep runtime behavior stable while moving pure logic into modules that can be tested without a browser.

## Runtime layers

### Pure modules

- `course-requirements.js` — normalizes Coursera course-material metadata into a stable list of grade-relevant activities.
- `assessment-parser.js` — owns assessment DOM selectors, question-block discovery, option extraction, and question-type classification.
- `coursera-api.js` — builds and validates course-material API requests and course slugs.
- `diagnostics.js` — converts parser results into metadata-only read-only reports.
- `intercept-policy.js` — defines which Coursera traffic and headers are safe to expose to the isolated extension world.

These modules are written so they can be loaded in the browser and required directly by Node tests.

### Browser integration

- `content.js` — legacy integration layer. It still owns Chrome messaging, page-state capture, Monaco bridge calls, mutation actions, and banners.
- `content-adapters.js` — transition layer loaded after `content.js`. It delegates parsing, course metadata normalization, and course-material URL construction to the pure modules while preserving the legacy browser integration points.
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
4. `content.js`
5. `content-adapters.js`

The extracted modules are available before the legacy script executes, and the adapter then replaces selected legacy entry points with the tested implementations.

## Why progressive extraction?

`content.js` mixes network state, course parsing, assessment parsing, Monaco integration, UI feedback, and mutation behavior. Rewriting it wholesale would create a large regression surface. Progressive extraction allows each pure responsibility to gain fixtures and tests first, then lets duplicated legacy implementations be removed in smaller follow-up changes.

## Fixtures

Sanitized regression fixtures live under `tests/fixtures/`.

- `course-materials-confirmed.json` represents a small course-material response with confirmed passable metadata.
- `assessment-basic.html` represents the structural markers for common assessment types without real course content, account identifiers, tokens, or answers.

Fixtures must never contain cookies, authorization headers, CSRF values, real learner IDs, real assessment answers, or copied private course content.

## Test strategy

The GitHub Actions workflow runs:

- `node --check` against the extension JavaScript files;
- unit tests for provider request construction;
- unit tests for course requirements normalization;
- unit tests for assessment classification and selector strategy;
- interception-policy tests;
- Dry Run diagnostics tests;
- popup/manifest/module-load contract tests.

## Next extraction candidates

The next safe refactors are:

1. move Monaco read/write bridge plumbing into a dedicated adapter;
2. move course-material cache/state handling out of `content.js`;
3. replace duplicated legacy helper implementations once browser smoke tests confirm the adapters are stable;
4. add a browser-based fixture harness for `assessment-basic.html` so real selector behavior can be exercised in CI.

Automatic assessment submission is intentionally outside the scope of this architecture work.
