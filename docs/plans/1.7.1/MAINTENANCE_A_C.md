# Courtside 1.7.1 — Consolidated Maintenance A–C

**Approved 2026-11-19.** Branch: `maintenance/1.7.1-a-c`. Status: candidate pending full PR CI and owner review.
The approved workflow is one branch, one PR, no merge, tag, public Pages update, or GitHub Release without separate authorization.

## A. Automation and release safety

- [x] Run full CI on pull requests targeting `main` and ordinary pushes to `main`.
- [x] Cancel superseded PR/branch runs to conserve CI minutes.
- [x] Validate JS syntax, Node/architecture suites, frozen 1.6.1 HTML, Chromium regressions and root-candidate parity.
- [x] Upload the compiled `dist/courtside.html` as a review artifact (30-day retention).
- [x] Replace the obsolete v1.7.0-only release workflow with a reusable **manual** workflow.
- [x] Validate approved release input against both package and runtime versions; refuse duplicate tag/release.
- [x] Update the live Pages `index.html` **only during** the explicitly authorized release workflow.
- [ ] Full CI green for this PR and owner review before merge.
- [ ] Firefox smoke checks before v1.7.1 public release.

**Safeguards:** No CI step commits to Pages. `release:prepare` changes only the temporary GitHub Actions checkout in CI. The manual release workflow runs from `main`, refuses stale main HEADs, never force-pushes, and commits `index.html` and `courtside.html` together before creating the GitHub Release. If partial publication fails, investigate rather than automatically retry.

## B. Documentation and distribution

- [x] Document 1/2/4-screen viewer, PPV.st/AuraSports/Matchora, and PPV.st-first ordering.
- [x] Correct ESPN refresh documentation to 10-second live scores, 15-second selected live game stats, 60-second idle.
- [x] Keep historical v1.7.0 published checksum and download links unchanged.
- [x] Clarify that candidate 1.7.1 source differs from published v1.7.0 root HTML until release.
- [x] Update v1.7.1 version identity and in-app What's New history.
- [x] Label pre-merge audit/release preparation documents as historical snapshots.

## C. Verified redundancies and architecture

- [x] Replace the manually duplicated 100+ path syntax command with recursive inventory of source, scripts, tests.
- [x] Test inventory coverage, including frozen legacy code and new modules.
- [x] Retire the pinned one-off v1.7.0 publishing workflow; use a reusable workflow.
- [x] Replace the mutable 1.7.0 candidate checksum pin with two independently hashed identical builds. Continue pinning immutable 1.6.1 baseline SHA.
- [x] Preserve the 47-fragment architecture contract and no-runtime-import single-file distribution.
- [ ] Inspect PR CI output and approve before merge.

**Deliberate boundaries:** No changes to ESPN request cadence, rate limiting, provider matching/priorities, settings data, iframe lifecycle, or user controls. `.legacy.js` backups and transitional adapters are not removed without proof they are unnecessary. The 1.6.1 baseline remains byte-identical.

## Acceptance and follow-up

1. CI runs successfully with a downloadable single-file 1.7.1 candidate.
2. Current GitHub Pages and GitHub Release remain v1.7.0.
3. No required historical Firefox checks are falsely marked completed.
4. Owner reviews the PR, then explicitly authorizes any merge.
5. Once merged, the owner runs Firefox checks and separately approves/manually triggers any actual public 1.7.1 release.

Published v1.7.0 HTML SHA-256 (historical): `c07f7066f02df59eff14d9da826ba3d8a793b8dca4bd33197c8cee7a8edc4526`.
