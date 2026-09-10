# Contributing to TraceCrate

Useful contributions make one local trace easier to understand without weakening its privacy boundary. Discuss larger changes first; small fixes and synthetic regression cases are welcome. Keep reviews respectful and specific.

## Local checks

Use Node.js ≥22.12 (24 recommended). The scripts below are defined in [package.json](package.json):

```sh
npm ci
npm run dev
```

Before proposing a change:

```sh
npm run check
npx playwright install --with-deps chromium
npm run test:e2e
```

`check` runs Oxlint, Vitest, then TypeScript + Vite build. `test:coverage` produces a Vitest coverage report; no coverage percentage is promised. Playwright is configured for desktop Chromium and Pixel 7 emulation, using the production preview server. Emulation is not testing on physical Android hardware; Firefox/WebKit coverage is not claimed. Browser installation may need network access and system-package privileges; use an approved machine/CI rather than weakening firewall or TLS protections.

**Current verification boundary:** the enterprise firewall blocked the browser download in the development environment. Browser E2E has not run there; GitHub CI has not yet executed these new workflows. A configured check is not a passing check. Report exactly which commands ran, their results, and anything blocked; do not infer passes from existing build output. This documentation task does not certify current lint/unit/build status.

## Keep changes reviewable

- Explain the user-visible problem, scope, and evidence. Add regression tests using hand-authored synthetic data only.
- Never attach real Claude/Codex histories, credentials, customer prompts/code, personal paths, or raw error dumps. Recreate the minimal shape from scratch; pattern-redacted real logs are not acceptable public fixtures.
- Preserve unknown timing/usage; do not turn absent fields into claims of zero cost or success. `Usage.input` includes cached subcounts.
- Add source formats through `registerAdapter` and automatic module discovery, not dispatcher branches. Follow [architecture](docs/architecture.md) and update [formats](docs/formats.md) with limitations and upstream references.
- Keep imported strings inert: no evaluation, command execution, unsafe HTML, remote image loading, telemetry, or new uploads. Test export escaping, allowlists, and resource limits when touched.
- UI work should check keyboard navigation, dialog focus return, narrow viewports, long content, and accessibility. Mark manual checks as performed or pending, never implied.
- Document behavioral changes in [CHANGELOG.md](CHANGELOG.md); proposed features belong in [roadmap](docs/roadmap.md), not implemented lists.

PRs run with read-only repository permissions. Do not add privileged PR triggers or deployment from PRs. Only maintainers can choose to publish the reviewed default branch through the manual Pages workflow. Do not include private data in browser artifacts: Playwright traces may capture rendered content.

Contributions are submitted under the [MIT license](LICENSE). Use only material you have the right to contribute; preserve required third-party notices. For vulnerabilities, follow [SECURITY.md](SECURITY.md), not a public reproduction dump.