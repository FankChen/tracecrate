# Verification record

## 0.1.0 candidate · 2026-09-10

- Local `npm run check`: lint, 107 unit tests, TypeScript and production build passed.
- Core/adapters coverage: 96.58% lines, 93.95% statements, 87.83% branches. UI coverage is not included in these numbers.
- `npm audit --omit=dev`: no known production dependency vulnerabilities reported at verification time; not a security guarantee.
- GitHub CI: [run 34461509021](https://github.com/FankChen/tracecrate/actions/runs/34461509021) is the first successful run, at commit `07a87aba1e4f7778057eafc3dca6159118b0fe43`. The full job passed, including all 36 Playwright desktop Chromium / Pixel 7 emulation tests against the production preview server.
- Local browser execution remains unavailable because the development network blocks the browser download. This local limitation does not negate the successful GitHub browser run; CI preview tests do not establish hosted-site interactive behavior.
- All fixtures and demonstrations are synthetic. No private agent histories were read, uploaded, or committed.
- The parser worker is inlined into the application bundle, avoiding a separate first-import HTTP request after page load. Offline and zero-network behavior have browser regression tests.

## Hosted demo snapshot · 2026-09-10

- [Actual hosted demo](https://fankchen.github.io/tracecrate/): HTTP 200 confirmed, including JavaScript asset `index-B4YGU00B.js` and CSS asset `index-BCxFfHrI.css`. These hashed names identify this checked build, not permanent asset URLs.
- [First Pages run 34461509842](https://github.com/FankChen/tracecrate/actions/runs/34461509842) was still wrapping up at this snapshot. Site availability is confirmed; final workflow success is not yet recorded here.
- Post-deployment smoke against the actual site and its screenshot artifact are being added separately. No passed live interactive validation or verified screenshot artifact is claimed yet. The README SVG remains a labeled illustration, not a screenshot.
- The [repository](https://github.com/FankChen/tracecrate) is public, but no release exists. Version `0.1.0` remains a candidate; the changelog stays **Unreleased**. Launch posts and the interaction video remain drafts/plans, not completed distribution.

## Important accounting decisions

Claude's source `input_tokens` excludes its separately reported cache reads/writes. The adapter adds these exactly once *after* per-message snapshot deduplication. Native `Usage.input` includes them; downstream statistics do not add them again.

OTLP GenAI usage describes individual operations. Those counters are summed, not treated as Codex-style cumulative snapshots. Exports that repeat rollup totals on parent and child spans are not equivalent to per-operation accounting.

Repeated tool inputs are observations, not proof of wasted work. Comparisons are descriptive, not benchmark results. Unreported statuses and timings remain unknown.

## Release checks

Use [CI](https://github.com/FankChen/tracecrate/actions/workflows/ci.yml) and [Pages](https://github.com/FankChen/tracecrate/actions/workflows/pages.yml) for the current commit. The deployment workflow requires both unit and browser tests to pass before uploading the site.