# Verification record

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