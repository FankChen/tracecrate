# Changelog

Published releases receive dated version headings; later documentation updates are listed separately.

## Unreleased

- V0.2 candidate: status/minimum-duration filters, stable longest-first ordering, metadata search and keyboard focus return.
- Bounded event-sequence comparison with changed fields, scope/filter controls, pagination and original-event navigation.
- Optional structure-only timing/token metadata minimization with preview/JSON/HTML agreement and schema-1 compatibility. Missing tool durations now remain unknown.
- Independent import cancellation, ordinal progress, per-file deadline and stale-result cleanup.
- Structured OTLP attributes, strict integer decoding and current cache-write alias with legacy fallback.
- 225 synthetic unit tests, 64 configured browser cases, browser-test typechecking, and manual validated-release packaging with licenses/checksums. Browser/Pages/release evidence is pending at this candidate revision.
- [Research and V0.2 design](docs/v0.2-design.md), [release notes](docs/releases/v0.2.0.md) and [keyboard walkthrough](docs/keyboard.md).

### V0.1 documentation follow-up

- Documentation follow-up: replace both README illustrations with the visually reviewed [live-site synthetic demo screenshot](docs/screenshots/tracecrate-desktop.png); add release/Pages badges and current evidence links.
- Synchronize release, verification, architecture, security, and launch-draft status. The [roadmap](docs/roadmap.md) links contribution issues #4, #5, and #6; #5/#6 are addressed in the V0.2 candidate, while #4 remains a proposal.

## [0.1.0](https://github.com/FankChen/tracecrate/releases/tag/v0.1.0) — 2026-09-10

Created at tested commit `52d9ae9b73f815c264a3eb39f5fc3eedc5cb9715`.

### Features

- Client-side trace exploration with Claude normal-message, Codex rollout, OTLP JSON subset, and native schema adapters.
- Worker-based imports with size/count/depth limits; in-memory sessions and synthetic demo pair.
- Searchable paginated timeline, heuristic findings, descriptive comparison, and structure/pattern JSON and standalone HTML exports.

### Documentation and automation

- English and Simplified Chinese project guides, original SVG product illustration, MIT license, contribution/security guidance, format/privacy/architecture documentation.
- Publication checklist, phased launch drafts, and explicitly proposed roadmap issue seeds.
- Read-only CI checks and Chromium E2E configuration; manually dispatched default-branch Pages deployment with actual public-site smoke; grouped weekly Dependabot updates and issue/PR templates.

### Verification · 2026-09-10

- Local lint, 107 unit tests, TypeScript and production build passed. Core/adapters line coverage: 96.58%, excluding UI.
- [CI run 34462095959](https://github.com/FankChen/tracecrate/actions/runs/34462095959) succeeded with 107 unit tests and 36 desktop Chromium / Pixel 7 emulation browser tests.
- [Pages run 34462098830](https://github.com/FankChen/tracecrate/actions/runs/34462098830) succeeded in build, deployment, and actual [public-site](https://fankchen.github.io/tracecrate/) Playwright smoke: subpath assets, cold offline first import with a synthetic Claude fixture after page load, default structure-only HTML download, and no console/page errors.
- The live-site evidence artifact was downloaded; its 1440 × 2026 full-page synthetic demo screenshot was visually reviewed.

### Remaining verification and publication limits

- Local browser downloads remain blocked. The 36-test suite uses a production preview server; separate Pages smoke verifies the actual public site. No Firefox/WebKit or screen-reader certification is claimed.
- Launch posts and the interaction video are not published; no npm package is published. See the [verification record](docs/verification.md).