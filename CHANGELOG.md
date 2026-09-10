# Changelog

Published releases receive dated version headings; later documentation updates are listed separately.

## Unreleased

- Documentation follow-up: replace both README illustrations with the visually reviewed [live-site synthetic demo screenshot](docs/screenshots/tracecrate-desktop.png); add release/Pages badges and current evidence links.
- Synchronize release, verification, architecture, security, and launch-draft status. The [roadmap](docs/roadmap.md) links open contribution issues #4, #5, and #6; those proposals are not implemented features.

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