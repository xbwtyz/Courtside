# Courtside 1.7 — Phase 2 build foundation

## Scope

This is **source separation only**: HTML markup, the existing CSS, and the existing application JavaScript have been extracted into three files. No function, API endpoint, interval, stylesheet rule, event handler or UI behavior has been intentionally edited. **Feature-level JavaScript modules are a later, separately approved phase.**

The generated end-user artifact is a single HTML file. Node.js is required only to develop/build, **not** to run the distributed HTML.

## Source of truth

| Path | Purpose |
| --- | --- |
| `baseline/courtside_1.6.1.html` | Frozen 1.6.1 reference; never modify |
| `src/index.html` | Original HTML with one CSS and one JS insertion token |
| `src/styles/main.css` | Exactly the original inline CSS contents |
| `src/scripts/app.js` | Exactly the original inline application JavaScript; not yet refactored |
| `scripts/build.mjs` | Dependency-free Node build that inlines CSS and JS |
| `tests/build.test.mjs` | Byte-parity and standalone-output tests |
| `dist/courtside.html` | Generated release candidate; ignored by Git |

## Build and validate

Use Node.js 20 or later:

```bash
npm run check:syntax
npm test
npm run verify:baseline
```

`npm run build` always writes the current modular source as `dist/courtside.html` without requiring it to match 1.6.1. The `verify:baseline` command intentionally *does* require byte-exact equality and is valid for **Phase 2 only**. Replace this golden test with behavior-level regression tests once intentional changes begin in Phase 3.

No npm dependencies, CDN build tools, or server are needed for this phase. The original CSS includes an optional Google Fonts import, retained unmodified; the generated HTML uses local fallback fonts if offline.

## Proven baseline

- Frozen reference length: **374,363 bytes**.
- Frozen reference SHA-256: **`0f52ad272cd3fe2259b62ad81464868573c4f1a9dbe8c37607b6bb53a243629e`**.
- Compiled HTML is required to be **byte-identical** to that reference. This proves no output-code change for the Phase 2 build, without claiming that all third-party services or browser-specific behavior have been retested.

## Boundaries

- Do not edit GitHub `main`.
- Do not change `baseline/courtside_1.6.1.html`.
- Do not refactor the existing JavaScript into feature modules without separate approval.
- Continue using `docs/REGRESSION_CHECKLIST_1.6.1.md` for future regression validation.
