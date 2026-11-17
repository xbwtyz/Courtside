# Courtside 1.7 — Phase 4E: Statistical Glossary Module

Development-only milestone on refactor/modular-1.7; the main branch and public release are untouched.

## Changes

- The original statistical glossary dictionary, header decoration, tooltip position and UI handlers now execute inside a private createStatGlossary factory, exported by a native ESM source module.
- Its dependencies are explicit: document, window, Node, MutationObserver, requestAnimationFrame and safe.
- A new glossary entry file exposes the factory to esbuild. The glossary source adapter initializes it once at the original script position.
- A separate legacy copy preserves the exact original glossary source, including event handlers and first paint.
- scripts/build.mjs now uses a two-entry feature manifest instead of a one-off What's New special case. Both ES modules are bundled by esbuild as independent browser IIFEs, then inlined into the same classic script.

## Compatibility checks

- The frozen reference remains exactly 374,363 bytes, SHA-256 0f52ad272cd3fe2259b62ad81464868573c4f1a9dbe8c37607b6bb53a243629e. Verify with npm run verify:baseline.
- The modern single-file HTML intentionally differs because its internal implementation changed; verify with npm run build, npm test and npm run test:browser.
- The new Node test compares the old and modern glossary controllers across dictionary lookups, quarterly and overtime labels, hovering, clicking, pinning, focus, Escape, scrolling, mutation-based header decoration and duplicate prevention.
- The new Chromium comparison checks the complete old and new HTML against the same synthetic tables across 10 interaction states, including keyboard handling and sorting-click protection.
- No runtime JS modules, backend, CDN, new ESPN requests, streaming-provider changes or new features are added.
- The remaining 45 source fragments continue to use the original classic-script scope. This is the second isolated runtime feature, not an application-wide rewrite.

## Commands

    npm install --no-audit --no-fund
    npm run check:syntax
    npm test
    npm run verify:baseline
    npm run build
    npm run test:browser

GitHub Actions on this branch executes these checks, including offline Chromium, and uploads the generated modern HTML. Local browser tests used a temporary diagnostic factory stand-in because npm package downloads are unavailable in the container; GitHub CI runs the real esbuild package.

## Outstanding release gates

Complete the 104-point regression checklist, Windows Firefox local-file checks, real ESPN integration, and third-party stream playback verification before a 1.7 public release or merging to main. Continue migrating higher-coupling modules only with scoped contract tests and rollback plans.
