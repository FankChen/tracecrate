# Security policy

TraceCrate processes potentially sensitive, untrusted files in a browser. It is not a sandbox for executing their contents, a guaranteed anonymizer, or a forensic secure-erasure tool. See [privacy boundaries](docs/privacy.md).

## Reporting

Do **not** open a public issue with an exploit payload, secret, real trace, or private code. Once a repository is published, use GitHub's **Security → Report a vulnerability** if the maintainer has enabled private vulnerability reporting. That channel is pending publication/configuration; no private contact address is claimed here.

If that option is unavailable, open only a content-free request asking maintainers to enable a private reporting channel. Withhold vulnerability details until one is available. Never paste access tokens into issues, chat, or diagnostic logs. If a credential was exposed, revoke/rotate it with its issuer; deleting a post is not sufficient.

In the private report, include affected revision, browser/OS, impact, reproduction steps using a new synthetic fixture, and expected vs observed behavior. Avoid actual histories even in private reports unless there is a separately agreed, authorized need.

## Scope and support

- Relevant issues include unintended network transmission, script/HTML injection, redaction allowlist bypass, sensitive error disclosure, resource-limit bypass, and CI/deployment trust-boundary failures.
- Pattern matching can miss secrets by design; it must not be advertised as guaranteed safe. A failure of the strict structure-only boundary is especially important to report.
- No published release or security audit is claimed. Review targets the current default branch; there is no promised support window, response SLA, or bounty program.
- Fixes should receive a synthetic regression test, review, and coordinated disclosure after an appropriate fix is available. Never reproduce by importing someone else's private files.

## Maintainer publication prerequisites

Enable private vulnerability reporting before public launch, review dependency alerts, restrict the Pages environment to the default branch, and inspect built assets for accidental private fixtures. CI receives only synthetic test data. Do not introduce `pull_request_target` or expose deployment credentials to PR code.