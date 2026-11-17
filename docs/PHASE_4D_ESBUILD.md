# Courtside 1.7 — Phase 4D: esbuild module-aware build

## Scope
This development-only milestone replaces the temporary What’s New `createWhatsNew.toString()` bridge with the **real esbuild 0.28.2 bundler**. No ESPN polling, stream URLs, alert behavior, settings keys, or user-facing features are intentionally changed. The rest of the code remains in original-order build-time fragments; this does not yet convert all features to independent modules.

## Development commands
Requires Node.js 20 or newer to build (not to use Courtside):

```sh
npm install
npm run check:syntax
npm test
npm run verify:baseline
npm run build
npm run test:browser  # optional: Python Playwright and Chromium
```

The esbuild development dependency is pinned exactly to `0.28.2` in `package.json`. CI installs dependencies with `npm install --no-audit --no-fund`. A lockfile is not yet committed; this should be addressed as we mature the release pipeline.

## How the bundling works
- `src/features/whats-new/entry.mjs` re-exports `createWhatsNew` from `module.mjs` using **real ESM source imports**.
- `scripts/build.mjs` uses `esbuild.build({ bundle: true, format: 'iife', platform: 'browser', globalName: 'CourtsideWhatsNew', write: false })`.
- The resulting IIFE is embedded just before the What's New controller adapter in the existing classic inline script. That adapter calls `CourtsideWhatsNew.createWhatsNew({...})` with its existing injected dependencies.
- The generated `dist/courtside.html` still contains one inline stylesheet, one inline classic script, and **no runtime JS imports/CDN dependencies**, so it can be opened directly as an HTML file.
- All other original-order source fragments and their runtime coupling are unchanged. Further migration will happen incrementally.

## Legacy proof vs modern distribution
`npm run verify:baseline` separately builds `dist/courtside-legacy-proof.html` by reinserting the frozen original What's New controller. This must match exactly:
- 374,363 bytes
- SHA-256 `0f52ad272cd3fe2259b62ad81464868573c4f1a9dbe8c37607b6bb53a243629e`

`npm run build` writes **the new modularized** `dist/courtside.html`. Its output is expected to differ in size/hash, because implementation has intentionally changed. Running the legacy verification must never overwrite the modern build.

## Regression criteria
- Existing 22 automated build/behavior tests plus a new esbuild integration test must pass.
- The new bundle must parse as one classic browser script without `<script src>` or runtime ESM imports.
- What's New must keep the same content, navigation, saved selection, read indicators and storage-failure handling. Existing What’s New tests compare old/new behavior.
- Optional Chromium smoke and five-state old/new browser comparisons must pass.
- Real ESPN/stream providers, Windows Firefox `file://` and the full 104-point regression suite remain to be validated separately.

No production merge or Courtside 1.7 public release is authorized by this milestone.
