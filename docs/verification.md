# Verification record

## V0.2 candidate · 2026-09-13

- Research baseline: clean `1c92be40abb75114033ba2624e386e55e51f42e2`, synchronized with main; original 107 unit tests, lint, TypeScript and production build reproduced successfully before changes.
- Candidate `bf3a2da308eb0f900b91eae5b1a3ff6a4a8ca863`: 225 unit tests, lint, application/browser TypeScript checks and production build passed locally on Node 24.21.0. Core/adapters coverage: **97.51% lines (589/604), 95.62% statements, 91.67% branches**; not React UI coverage. Machine-readable summary includes query/comparison/import-task modules.
- `npm audit` (including development dependencies) reported zero known vulnerabilities at verification time. This is not a security audit or guarantee.
- First candidate [CI 34747381885](https://github.com/FankChen/tracecrate/actions/runs/34747381885): **62/64 browser cases passed**, with only the keyboard modal-boundary test failing in both projects. Shift+Tab from the first modal button did not return to the last button in Chromium 153.0.8010.12 on Ubuntu. Explicit first/last focus wrapping was added; the original assertions remain. A new pass is required before release. Local Chromium is missing and enterprise download restrictions are not bypassed.
- Corrected candidate `29bfa6ff462b112030cb1af3035d7a1002704908`: [CI 34747596321](https://github.com/FankChen/tracecrate/actions/runs/34747596321) **passed 225 unit tests and all 64 browser tests (50.9 s)**, with no failed/flaky cases reported. Chromium 153.0.8010.12, GitHub-hosted Ubuntu, desktop and Pixel 7 emulation. Keyboard focus wrapping passed without removing assertions. Real-parser/offline/export tests remain separate from controlled worker lifecycle tests.
- Release packaging smoke succeeded with only static assets, synthetic demo data, build/deploy metadata, application license and runtime dependency notices. Local dirty-checkout packages are development smoke artifacts, **not published releases**; publication packages must use a clean tested revision and include SHA-256 checksums.
- V0.2 browser validation is complete for the corrected candidate; no V0.2 release or Pages pass is claimed yet. V0.1 evidence below is historical only.

## v0.1.0 released · 2026-09-10

- [Release v0.1.0](https://github.com/FankChen/tracecrate/releases/tag/v0.1.0) was actually created at tested commit `52d9ae9b73f815c264a3eb39f5fc3eedc5cb9715`.
- Local `npm run check`: lint, 107 unit tests, TypeScript and production build passed.
- Core/adapters coverage: 96.58% lines, 93.95% statements, 87.83% branches. UI coverage is not included in these numbers.
- `npm audit --omit=dev`: no known production dependency vulnerabilities reported at verification time; not a security guarantee.
- GitHub CI: [run 34462095959](https://github.com/FankChen/tracecrate/actions/runs/34462095959) succeeded at the tested release commit, including 107 unit tests and all 36 Playwright desktop Chromium / Pixel 7 emulation tests against the production preview server.
- Local browser execution remains unavailable because the development network blocks the browser download. Browser evidence comes from GitHub CI and the separate actual public-site smoke below, not a local browser run.
- All fixtures and demonstrations are synthetic. No private agent histories were read, uploaded, or committed.
- The parser worker is inlined into the application bundle, avoiding a separate first-import HTTP request after page load. Offline and zero-network behavior have browser regression tests.

## Hosted demo snapshot · 2026-09-10

- [Pages run 34462098830](https://github.com/FankChen/tracecrate/actions/runs/34462098830) **succeeded**, including build, deploy, and Playwright smoke against the [actual public demo](https://fankchen.github.io/tracecrate/), not just the production preview server.
- Public-site smoke passed project-subpath asset loading; cold offline first import of a synthetic Claude fixture after page load and before any earlier import; default structure-only HTML download; and absence of console/page errors. This does not promise a fresh offline page load.
- Its `live-site-evidence` artifact was downloaded. The [actual synthetic demo screenshot](screenshots/tracecrate-desktop.png) is a 1440 × 2026 full-page PNG, visually reviewed and displayed in both READMEs. It is not an illustration or a benchmark.
- The [repository](https://github.com/FankChen/tracecrate) and [v0.1.0 release](https://github.com/FankChen/tracecrate/releases/tag/v0.1.0) are public. Launch posts and the interaction video remain unpublished drafts/plans; no npm package is published.
- No Firefox/WebKit or screen-reader certification is claimed. Pattern redaction can miss secrets; structure-only metrics and timestamps can still be sensitive. Review full exports.

## Important accounting decisions

Claude's source `input_tokens` excludes its separately reported cache reads/writes. The adapter adds these exactly once *after* per-message snapshot deduplication. Native `Usage.input` includes them; downstream statistics do not add them again.

OTLP GenAI usage describes individual operations. Those counters are summed, not treated as Codex-style cumulative snapshots. Exports that repeat rollup totals on parent and child spans are not equivalent to per-operation accounting.

Repeated tool inputs are observations, not proof of wasted work. Comparisons are descriptive, not benchmark results. Unreported statuses and timings remain unknown.

## Release checks

For future revisions, use [CI](https://github.com/FankChen/tracecrate/actions/workflows/ci.yml) and [Pages](https://github.com/FankChen/tracecrate/actions/workflows/pages.yml). Pages requires unit and browser tests before uploading the site, then verifies the deployed public URL in a separate job. The recorded successes above apply to the tested release revision, not automatically to later documentation or code changes.