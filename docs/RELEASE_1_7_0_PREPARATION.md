# Courtside v1.7.0 — Release preparation and human validation

**PR:** https://github.com/xbwtyz/Courtside/pull/1 (draft). **Branch:** `refactor/modular-1.7`. **No merge, tag, or GitHub Release until separately authorized.**

## Release identity

The app's visible browser title, header, Settings footer, What's New current release / history, and JSON Data Log export all identify **v1.7.0**. The historical v1.6.1 source template and frozen legacy fragments are immutable. `src/release/version.mjs` owns runtime release metadata; package and lockfile use the same version. The new What's New entry is *Modular Architecture & Stability*; the historical 1.6.1 release viewer is preserved as a selectable entry.

## Reproducible distribution

1. `npm ci`
2. `npm run check:syntax && npm test && npm run verify:baseline && npm run test:browser`
3. `npm run release:prepare` — build and copy `dist/courtside.html` to repository-root `courtside.html`.
4. `npm run release:verify` — rebuild and verify exact file contents, SHA-256, version identity, single inline script and style.
5. GitHub Actions runs these gates and, **only on pushes to the refactor branch after green tests**, can commit the prepared root file. No automated main-branch mutation.

## Verified and outstanding checks

- [x] 47 / 47 source modules accounted for, with immutable legacy backups (automated)
- [x] Baseline 1.6.1 byte reconstruction (automated)
- [x] Modular Node, syntax, and offline Chromium regression suites (automated prior to release stamping; rerun required)
- [x] Firefox standalone startup, screens, player stats, leaderboard, viewer/source selection, and settings persistence (six smoke cases **reported by owner**)
- [ ] All historical manual checks in `docs/REGRESSION_CHECKLIST_1.6.1.md` (not reported complete)
- [ ] Review regenerated v1.7.0 artifact checksum and executable source-vs-root parity
- [ ] Review PR and provide separate merge approval
- [ ] Upon approval only: merge, tag v1.7.0, publish a GitHub Release and verify artifact link

**External API/stream-provider checks are point-in-time; availability can change.**
