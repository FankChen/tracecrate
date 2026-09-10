# Verification record

## 0.1.0 candidate · 2026-09-10

- Local `npm run check`: lint, 107 unit tests, TypeScript and production build passed.
- Core/adapters coverage: 96.58% lines, 93.95% statements, 87.83% branches. UI coverage is not included in these numbers.
- `npm audit --omit=dev`: no known production dependency vulnerabilities reported at verification time; not a security guarantee.
- Playwright: 36 desktop/mobile cases discovered. Local browser execution unavailable because the development network blocks the browser download. GitHub CI is the browser verification gate; consult the actual run before claiming a pass.
- All fixtures and demonstrations are synthetic. No private agent histories were read, uploaded, or committed.
- The parser worker is inlined into the application bundle, avoiding a separate first-import HTTP request after page load. Offline and zero-network behavior have browser regression tests.

## Important accounting decisions

Claude's source `input_tokens` excludes its separately reported cache reads/writes. The adapter adds these exactly once *after* per-message snapshot deduplication. Native `Usage.input` includes them; downstream statistics do not add them again.

OTLP GenAI usage describes individual operations. Those counters are summed, not treated as Codex-style cumulative snapshots. Exports that repeat rollup totals on parent and child spans are not equivalent to per-operation accounting.

Repeated tool inputs are observations, not proof of wasted work. Comparisons are descriptive, not benchmark results. Unreported statuses and timings remain unknown.

## Release checks

Use [CI](https://github.com/FankChen/tracecrate/actions/workflows/ci.yml) and [Pages](https://github.com/FankChen/tracecrate/actions/workflows/pages.yml) for the current commit. The deployment workflow requires both unit and browser tests to pass before uploading the site.