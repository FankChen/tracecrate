# Security policy

TraceCrate processes potentially sensitive, untrusted files in a browser. It is not a sandbox for executing their contents, a guaranteed anonymizer, or a forensic secure-erasure tool. See [privacy boundaries](docs/privacy.md).

## Reporting

Do **not** open a public issue with an exploit payload, secret, real trace, or private code. Use [Security → Report a vulnerability](https://github.com/FankChen/tracecrate/security/advisories/new). Private vulnerability reporting was confirmed enabled on 2026-09-10.

If that option is unavailable, open only a content-free request asking maintainers to enable a private reporting channel. Withhold vulnerability details until one is available. Never paste access tokens into issues, chat, or diagnostic logs. If a credential was exposed, revoke/rotate it with its issuer; deleting a post is not sufficient.

In the private report, include affected revision, browser/OS, impact, reproduction steps using a new synthetic fixture, and expected vs observed behavior. Avoid actual histories even in private reports unless there is a separately agreed, authorized need.

## Scope and support

- Relevant issues include unintended network transmission, script/HTML injection, redaction allowlist bypass, sensitive error disclosure, resource-limit bypass, and CI/deployment trust-boundary failures.
- Pattern matching can miss secrets by design; it must not be advertised as guaranteed safe. A failure of the strict structure-only boundary is especially important to report.
- [v0.1.0](https://github.com/FankChen/tracecrate/releases/tag/v0.1.0) is published; no security audit is claimed. Reports should identify the affected release or default-branch revision. There is no promised support window, response SLA, or bounty program.
- Fixes should receive a synthetic regression test, review, and coordinated disclosure after an appropriate fix is available. Never reproduce by importing someone else's private files.

## Maintainer publication prerequisites

Enable private vulnerability reporting before public launch, review dependency alerts, restrict the Pages environment to the default branch, and inspect built assets for accidental private fixtures. CI receives only synthetic test data. Do not introduce `pull_request_target` or expose deployment credentials to PR code.