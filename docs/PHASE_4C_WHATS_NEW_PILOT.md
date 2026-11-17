# Courtside 1.7 — Phase 4C pilot: first isolated runtime feature

**Status:** Development-only change on refactor/modular-1.7. No merge into main, no new product features, and no released version bump. The generated application still displays 1.6.1 intentionally.

## Scope

We migrated just the What's New controller to a self-contained, dependency-injected factory, while retaining its exact release-note content, storage keys, labels, navigation and Settings integration.

- src/features/whats-new/module.mjs: a **native JavaScript ES module** exporting createWhatsNew.
- The factory takes five explicit dependencies: DOM getter, HTML-escaping function, releases, current release identifier and a storage getter. Its selected release and read-state variables are now private to each factory instance.
- src/features/whats-new/controller.js: a small binding adapter. It exposes only initWhatsNew, renderWhatsNew, markWhatsNewRead and updateWhatsNewIndicators to existing Settings handlers.
- src/features/whats-new/controller.legacy.js: the original controller text, unchanged, solely for regression and rollback checks.
- scripts/build.mjs: imports the factory using Node's native ESM loader at **build time** and embeds the factory implementation in one original-style inline classic browser script. Runtime imports, separate JavaScript files, and a web server are not required.

**Architecture caveat:** this is a **one-module compilation bridge**, not a generic bundler. The bridge serializes the self-contained factory using Function.prototype.toString(). This is a deliberate, dependency-free transition and must not be generalized to a multi-file module dependency graph. A supported bundler such as esbuild or Rollup is the recommended next step before migrating multiple interdependent modules. The remaining source fragments retain their shared script scope.

## Builds and hashes

- npm run build creates **dist/courtside.html**: 375,017 bytes, SHA-256 9180e0a707bf64ceca80a3b58c506a2734b6cb1b7d5e8c0616b82b8c6c6a36cc.
- npm run verify:baseline creates **dist/courtside-legacy-proof.html**, byte-identical to the frozen v1.6.1 reference: 374,363 bytes, SHA-256 0f52ad272cd3fe2259b62ad81464868573c4f1a9dbe8c37607b6bb53a243629e.
- The legacy verification command deliberately **does not overwrite** the modern standalone build. The new HTML is intentionally **not** byte-identical because the implementation has changed. Validate actual behavior, not equality of new bytes.
- Neither build changes network endpoints, ESPN polling, provider matching, iframe behavior, alerts, charts or settings storage keys.

## Checks

Run from the repository root with Node.js 20 or newer:

    npm run check:syntax
    npm test
    npm run verify:baseline
    npm run build

Optional (requires Python Playwright and an installed Chromium binary):

    npm run test:browser

**Local result:** 22/22 Node tests pass. New tests compare old-versus-new What's New DOM markup, older/newer navigation, storage reads/writes and storage-denied handling; also verify two controller instances have independent mutable state. The Chromium smoke check passes Settings, What's New, Standings, synthetic scoreboard filtering and stable video iframe URL after redraw. An additional Chromium check compares old and new What's New UI over five interaction states without external requests, with no page-level errors.

GitHub Actions runs syntax checks, Node tests, frozen legacy reference verification and the modern build on the development branch. Python/Chromium smoke tests are not installed in CI; report their results only as **local**.

## Outstanding

The wider 104-check regression plan is not complete. Firefox Windows file:// testing, live ESPN/request totals, real third-party streams, and all Game Center/profile edge cases still need verification. Do not interpret tests performed with external traffic blocked as live-provider verification.

## Next migration gate

Keep main untouched. Add a supported module bundler, compare its single-file output against this checkpoint, and migrate additional low-coupling features one at a time with their own behavior tests. Seek explicit approval before merging or cutting a user-facing 1.7 release.
