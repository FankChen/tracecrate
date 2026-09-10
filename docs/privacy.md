# Privacy and sharing boundaries

[Home](../README.md) · [Security reporting](../SECURITY.md)

## What stays local

The current application has no backend, trace-upload API, analytics/telemetry integration, account system, or API-key requirement. File selection/drop is explicit. It does not crawl Claude/Codex storage, read arbitrary directories, call models, execute commands, or follow links inside trace content. Text is rendered as text, not interpreted as HTML/code.

The import hook sends selected `File` objects to a Web Worker bundled inline with the app. No separate worker HTTP request is needed on the first import after loading the app. Reading and parsing happen there; normalized traces return to React state. Imports are sequential and sessions are memory-only, with no app persistence in localStorage/IndexedDB. **Clear sessions** terminates pending workers and drops session state; reload drops imports and loads fresh synthetic demos. This is not secure memory erasure, protection against OS swap/crash dumps, or deletion of the selected original/downloads.

## What “no uploads” does not cover

- Serving the app still makes ordinary asset requests. A host/CDN can observe IP address, user agent, request time, and other request metadata; it has its own retention policy. Development tooling and package/browser installation also make network requests.
- A malicious browser extension, compromised browser/OS, screen recorder, or modified hosted JavaScript can expose content. Worker isolation is not a security boundary against the page that created it.
- Dependency and hosting supply chains remain trusted. Running a reviewed build locally reduces hosting exposure but does not prove isolation. No offline-install or PWA caching guarantee is claimed.
- Downloaded reports persist, may enter cloud-synced folders/backups, and are readable by their recipients. Do not use sensitive imports during CI/screenshots: browser test traces may capture page content.

For sensitive work use an approved browser profile/device, review extensions, serve a reviewed build locally, and follow organizational policy. Never send real histories to maintainers to diagnose a format problem; recreate a synthetic minimal case.

## Two export modes

Implementation: [sharing transforms](../src/core/export.ts) and [export dialog](../src/components/ExportDialog.tsx).

| Field group | Structure only — default | Pattern redaction — opt-in |
| --- | --- | --- |
| Content, input, output, arbitrary free text | Removed/replaced by fixed text through an allowlist | Preserved after best-effort pattern scrubbing |
| Original trace/event IDs and parents | Generic IDs; known parent links remapped | Same generic IDs and remapped known parents |
| Trace name/source | Fixed generic labels | Fixed generic labels |
| Event names, model, original warnings | Generic names; model removed; fixed warning | Scrubbed but otherwise preserved |
| Event kind/status, count, relationships | Retained | Retained |
| Timestamps, durations, usage, demo flag | Retained when allowed | Retained |

**Strict structure-only removes arbitrary free text, but metrics/timing/relationships can still reveal business activity, workloads, working hours, or identifiable patterns.** This is data minimization, not guaranteed anonymity. Removing names also means exported tool breakdowns no longer retain original tool grouping.

Pattern mode recognizes selected secret assignments/keys, token-like strings, private-key blocks, bearer values, email addresses, and common home-directory paths. It cannot identify all confidential code, prompts, names, URLs, paths, proprietary facts, encodings, or new secret formats. It is not a security guarantee; never treat a pattern-exported real history as an acceptable public test fixture.

JSON is a transformed native report, not a raw backup. HTML is generated from the transformed trace with escaped fields, no scripts/external assets, and a restrictive embedded CSP. This reduces active-content risk, not information-disclosure risk. Download generation occurs on the main thread; large files may be slow. The transform leaves the original in-memory trace unchanged.

## Before sharing

1. Prefer a newly authored synthetic reproduction whenever possible.
2. Choose structure-only unless you have an explicit reason and authorization to disclose text.
3. Inspect the preview, then the **entire downloaded file**: preview display stops at 50,000 characters but the download contains the full transformed report.
4. Review metrics, timestamps, statuses, relationships, and all text. If remaining metadata is sensitive, do not share; neither mode removes all metadata.
5. Share only with the intended recipients through an approved channel. Remove local downloads/backups according to your own retention policy.

No compliance certification, independent security audit, or guaranteed redaction coverage is claimed.