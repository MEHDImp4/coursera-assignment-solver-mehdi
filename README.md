# Coursera Assignment Solver (Mehdi fork)

This fork is currently focused on making the extension safer to inspect, easier to test, and easier to maintain.

## Current development branch

Active refactor work lives on `feat/dry-run-foundations` and is tracked in PR #1.

### Added in the refactor

- read-only Dry Run diagnostics;
- sanitized interception policy;
- extracted assessment parser;
- extracted course-requirement normalization;
- extracted Coursera API helpers;
- course-scoped read cache/state;
- extracted Monaco editor detection/read bridge;
- sanitized fixtures and regression tests;
- GitHub Actions syntax + test checks;
- architecture documentation in `docs/ARCHITECTURE.md`.

The refactor deliberately avoids expanding automatic live-assessment submission behavior. The goal is to stabilize parsing, diagnostics, state handling, and testability first.

## Development

Run the existing Node test suite with:

```bash
node --test tests/*.test.js
```

Run syntax checks with:

```bash
node --check assessment-parser.js
node --check course-requirements.js
node --check coursera-api.js
node --check coursera-state.js
node --check monaco-bridge.js
node --check content-adapters.js
```

See `docs/ARCHITECTURE.md` for the current module boundaries and migration plan.
