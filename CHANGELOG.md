# Changelog

Only published releases should receive a dated version heading. The package's current `0.1.0` value is development metadata, not evidence of a release.

## Unreleased

### Present in source

- Client-side trace exploration with Claude normal-message, Codex rollout, OTLP JSON subset, and native schema adapters.
- Worker-based imports with size/count/depth limits; in-memory sessions and synthetic demo pair.
- Searchable paginated timeline, heuristic findings, descriptive comparison, and structure/pattern JSON and standalone HTML exports.

### Documentation and automation

- English and Simplified Chinese project guides, original SVG product illustration, MIT license, contribution/security guidance, format/privacy/architecture documentation.
- Publication checklist, phased launch drafts, and explicitly proposed roadmap issue seeds.
- Read-only CI checks and Chromium E2E configuration; manually dispatched default-branch Pages deployment; grouped weekly Dependabot updates and issue/PR templates.

### Verification · 2026-09-10

- Local lint, 107 unit tests, TypeScript and production build passed. Core/adapters line coverage: 96.58%, excluding UI.
- [First successful CI run](https://github.com/FankChen/tracecrate/actions/runs/34461509021) passed the full job, including 36 desktop/mobile browser tests, at commit `07a87aba1e4f7778057eafc3dca6159118b0fe43`.
- [Hosted demo](https://fankchen.github.io/tracecrate/) and its JS/CSS assets confirmed HTTP 200; real demo links and dynamic CI badges added to the project guides.

### Remaining verification and publication limits

- Local browser downloads remain blocked by the development environment; browser tests passed in GitHub CI against a production preview server, not the hosted site.
- The [first Pages run](https://github.com/FankChen/tracecrate/actions/runs/34461509842) was still wrapping up at the recorded snapshot. Post-deployment interactive smoke and screenshot verification remain pending; no final Pages success or live interactive validation is claimed here.
- No release, launch post, or interaction video is claimed as published. All changes remain **Unreleased**; see the [verification record](docs/verification.md).