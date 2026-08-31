# Extension architecture

This fork uses progressive extraction: testable read-only, diagnostic, state, selector, and presentation responsibilities are isolated from the original integration-heavy `content.js` without expanding live assessment automation behavior.

## Runtime layers

### Pure/read-side modules

- `course-requirements.js` — normalizes course-material metadata into a stable list of grade-relevant activities.
- `assessment-parser.js` — owns assessment selectors, question-block discovery, option extraction, and question-type classification. It supports semantic, legacy, mixed, and malformed layouts.
- `coursera-api.js` — builds and validates course-material requests and course slugs.
- `coursera-state.js` — owns course-scoped read state and materials caching. It tracks SPA route revisions without exposing token/header values or learner IDs.
- `diagnostics.js` — builds metadata-only Dry Run reports.
- `intercept-policy.js` — constrains which Coursera traffic and request-header names may cross from the MAIN world.
- `read-message-router.js` — handles only read-only Chrome actions and serializes failures to message-only error objects.

These modules can be required directly by Node tests where browser APIs are not needed.

### Monaco bridge

- `monaco-bridge.js` identifies the editable model, validates model URIs/actions, and provides the window-message transport used by read-side editor inspection.
- The modular read runtime uses only `read-model`.
- Existing write-side Monaco behavior remains in the legacy integration boundary and was not expanded by this refactor.

### Presentation

- `presentation.js` owns the in-page status banner, spinner style, show/hide timing, and accessibility attributes.
- Dynamic messages use text nodes / `textContent`, not `innerHTML`.
- Refreshing a banner cancels an older hide timer so stale timers cannot remove a newer status.

### Browser integration

- `content-adapters.js` creates `globalThis.CourseraReadRuntime`, owns modular course reads/parsing/diagnostics, synchronizes SPA route state, and registers the dedicated read-only message router.
- `content.js` retains the existing mutation-oriented integration boundary plus only the read delegates still required by that legacy code.
- `intercept.js` is the MAIN-world network hook and is constrained by `intercept-policy.js`.

### Popup

- `popup.js` contains the existing popup/provider behavior.
- `dry-run.js` provides the read-only diagnostics action.
- `diagnostics.js` sanitizes Dry Run output.

## Content-script load order

The isolated-world scripts load in this order:

1. `course-requirements.js`
2. `assessment-parser.js`
3. `coursera-api.js`
4. `coursera-state.js`
5. `monaco-bridge.js`
6. `presentation.js`
7. `read-message-router.js`
8. `content.js`
9. `content-adapters.js`

`intercept-policy.js` and `intercept.js` run separately in the MAIN world at `document_start`.

## SPA navigation and course-scoped state

Coursera can move between `/learn/<slug>/...` routes without reloading the tab. A cache tied only to the content-script lifetime can therefore become stale.

`coursera-state.js` now provides:

- `syncLocation(url)` to derive the current course from navigation;
- `clearCourse()` when navigation leaves a course route;
- `courseRevision`, incremented only when the course context changes;
- cache invalidation when the active slug changes;
- `onCourseRoute` and `hasCourseMaterials` metadata in diagnostics.

`content-adapters.js` synchronizes state on initial load, `popstate`, `hashchange`, and DOM changes observed through `MutationObserver`. The observer performs only URL/state comparison; it does not modify the page.

Legacy cached materials are imported into the modular state only when their captured course ID exactly matches the current route slug.

The state snapshot never returns cookies, authorization data, CSRF/header values, or learner IDs.

## Read-only message boundary

Read-only Chrome actions are no longer implemented inside the large legacy message listener.

`read-message-router.js` owns exactly these read actions:

- `getSelection`;
- `getCourseRequirements`;
- `getGradedAssignments` (compatibility alias);
- `getParserDiagnostics`.

Unknown actions are ignored by this router. Mutation-oriented action names and DOM mutation primitives are contract-tested to stay out of the module. Errors are reduced to `{ error: message }` and do not include stack traces.

The course-loading/normalization helper delegates that existed only to support those read messages were also removed from `content.js`. Assessment/Monaco read delegates still referenced by existing legacy integration remain thin wrappers around `CourseraReadRuntime`.

## Selector resilience

`assessment-parser.js` supports partially migrated pages instead of assuming the whole page is either semantic or legacy. It:

- accepts semantic and legacy blocks with valid prompts;
- combines distinct questions from both families;
- removes dual-matched or nested duplicates;
- preserves DOM order where available;
- filters promptless candidates before extraction;
- safely handles incomplete option structures;
- reports `semanticCandidates`, `semanticPrompts`, `legacyCandidates`, `legacyPrompts`, `invalidCandidates`, and `selectedBlocks`.

Selector strategy is reported as `semantic`, `legacy`, `mixed`, or `none`.

## Fixtures and browser smoke coverage

Sanitized fixtures under `tests/fixtures/` contain synthetic structure only:

- `course-materials-confirmed.json`;
- `assessment-basic.html`;
- `assessment-legacy.html`;
- `assessment-mixed.html`;
- `assessment-malformed.html`.

They must never contain cookies, authorization headers, CSRF values, real learner IDs, real assessment answers, or copied private course content.

`tests/browser/read-only-smoke.html` runs the parser/Monaco read inspection in real Chrome/Chromium against the sanitized assessment fixtures. `tests/browser/run-smoke.sh` serves the repository only on `127.0.0.1`.

The browser smoke suite verifies expected semantic/legacy/mixed/malformed behavior and snapshots every fixture before/after inspection. CI fails if read-side inspection changes the DOM or form-control state.

## Security and repository hygiene

The permanent GitHub Actions workflow has `contents: read` only. Temporary write-enabled mechanical cleanup workflows are removed after use.

`tests/repo-hygiene.test.js` permanently enforces that:

- no checked-in workflow grants `contents: write`;
- no temporary/one-shot cleanup workflow remains;
- the manifest keeps only the currently required extension permissions (`activeTab`, `storage`);
- the unused `scripting` permission does not return;
- content scripts remain scoped to Coursera learning routes;
- sanitized fixtures do not contain credential-like material.

Interception remains restricted by `intercept-policy.js`; request bodies and unrelated sensitive headers are not forwarded to the isolated world.

## Test strategy

Normal CI runs:

- `node --check` across extension JavaScript, including every extracted module;
- all `node:test` unit/contract/hygiene suites;
- the real Chrome/Chromium read-only smoke harness.

Coverage includes providers, course requirements, selector parsing, malformed fixtures, SPA state/cache transitions, Monaco read transport, presentation safety/timers, interception policy, diagnostics, manifest/module order, read-runtime cleanup, read-message routing, repository hygiene, and browser-level no-mutation checks.

## Final safe refactor boundary

Completed and covered:

- Dry Run diagnostics and metadata sanitization;
- interception minimization;
- course-requirement, API, assessment, state, and Monaco read extraction;
- course-scoped cache and SPA navigation consistency;
- semantic/legacy/mixed/malformed selector resilience;
- presentation extraction and safe text rendering;
- dedicated read-only Chrome message routing;
- duplicate read-only cleanup from `content.js`;
- manifest permission reduction;
- permanent CI, fixture, browser, and repository-hygiene gates.

Intentionally left in the legacy boundary:

- existing write-side Monaco application;
- existing answer-filling / assessment mutation flows;
- existing course-completion/media mutation flows;
- other mutation-oriented integration state required by those legacy paths.

Those mutation-oriented areas were deliberately not enhanced or further optimized in this PR. The safe refactor scope is complete.
