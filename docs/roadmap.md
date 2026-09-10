# Roadmap issue seeds — proposals, not implemented features

[Home](../README.md) · [Contributing](../CONTRIBUTING.md)

These are ready-to-discuss issue ideas, not existing GitHub issues, delivery commitments, or implemented capabilities. No issue numbers/URLs are invented. Current behavior is documented in [formats](formats.md) and [architecture](architecture.md).

| Proposed issue | User question | Suggested acceptance evidence |
| --- | --- | --- |
| Versioned synthetic adapter corpus | Which source shapes are actually covered? | Hand-authored version-labeled fixtures, public source references, positive/negative tests, explicit compatibility matrix; no actual histories |
| Privacy-preserving import diagnostics | Why was my file rejected without exposing it? | Generic stable error categories/counts; adversarial tests proving no source text in UI/logs; distinction between skipped and rejected records |
| Export metadata minimization | Can timing and metrics be excluded too? | Opt-in allowlist design, documented privacy tradeoffs, round-trip tests; do not claim this toggle exists today |
| Worker cancellation/deadline policy | What happens if a parse stalls? | Synthetic workload tests, cancellation/no-stale-state checks, documented deadline and memory limitations; no arbitrary capacity promises |
| Main-thread responsiveness | Can analysis/export block less on large inputs? | Matched synthetic workloads on declared hardware/browser, baseline before method, unchanged results and export safety tests; no synthetic demo performance claims |
| Additional browser/accessibility coverage | What works outside Chromium emulation? | Authorized real browser runs, keyboard/screen-reader review, versioned results with failures retained; not a present Firefox/WebKit guarantee |
| OTLP usage-scope clarity | Are overlapping aggregates counted twice? | Synthetic parent/child reporting cases, explicit semantics and notices, no silently guessed billing attribution |
| Comparison context notes | Are these runs meaningfully comparable? | User-visible provenance/context design and tests; do not claim controls can be inferred automatically from two files |

Prioritize one issue based on a reproducible user problem. Keep no-backend/no-telemetry and synthetic-fixture boundaries. New adapters should self-register via auto-discovered modules, not add dispatcher branches. No planned feature is a reason to overstate current format support or redaction guarantees.