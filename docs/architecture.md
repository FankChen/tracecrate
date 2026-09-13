# Architecture: a local file-to-evidence pipeline

[Home](../README.md) · [Formats](formats.md) · [Privacy](privacy.md)

React + TypeScript provide the UI; Vite builds relative-path static assets (`base: './'`). Zod validates normalized traces. There is no application backend or collector service. This repository is an application, not a published SDK: [package.json](../package.json) is marked private and defines no public package exports.

## Flow and ownership

| Stage | Implementation | Responsibility |
| --- | --- | --- |
| File selection and session state | [App](../src/App.tsx), [import hook](../src/components/useTraceImport.ts) | Explicit selection/drop, session caps, busy lock, generation-based cancellation, in-memory traces |
| Background import | [worker](../src/components/import.worker.ts), [task lifecycle](../src/core/import-task.ts) | Read/parse in inline worker; AbortSignal, deadline and one-shot cleanup; no source logging |
| Decode/dispatch | [import](../src/core/import.ts), [registry](../src/core/registry.ts) | UTF-8 size/depth/record checks, JSON then JSONL, auto-discovery, first matching adapter |
| Normalize/validate | [adapters](../src/adapters), [helpers](../src/core/helpers.ts), [types](../src/core/types.ts) | Source-specific mapping into `Trace` / `TraceEvent` / `Usage`, common runtime schema |
| Analyze/render | [analysis](../src/core/analysis.ts), [query](../src/core/query.ts), [sequence comparison](../src/core/compare.ts), [timeline](../src/components/Timeline.tsx), [comparison UI](../src/components/Compare.tsx) | Pure statistics/findings and filters, bounded jsdiff alignment, selection/pagination, descriptive deltas |
| Transform/download | [export](../src/core/export.ts), [dialog](../src/components/ExportDialog.tsx) | `redactTrace`, `exportTraceJson`, `exportTraceHtml`, local Blob downloads and URL cleanup |

Files are imported one at a time with a fresh inline module worker for each file; workers terminate on completion, errors, explicit cancellation, clear, unmount or a 30-second per-file deadline. Browser timer throttling can delay enforcement. The task removes message/error/abort handlers and its timer exactly once. A generation token prevents late results from repopulating a cleared/cancelled workspace. Cancel discards all uncommitted results in the pending batch but preserves existing sessions; clear removes those too. Progress is file ordinal, not fabricated bytes/percent. Imported session IDs become local random IDs.

This is whole-file parsing, not incremental streaming. There is no guaranteed memory ceiling: input copies, normalization, main-thread analysis, comparison and exports also consume memory. The browser is still trusted to run scheduled cancellation callbacks.

## Add an adapter without editing the dispatcher

1. Add one module in the existing adapters directory whose filename ends in `.adapter.ts`.
2. Import `registerAdapter` from [registry](../src/core/registry.ts) and the `Adapter` type from [types](../src/core/types.ts).
3. Implement an object with a unique `id`, accurate `label`, `detect(ParsedInput): boolean`, and `parse(ParsedInput, filename): Trace`. Register it at module scope with `registerAdapter(adapter)`.
4. [Import discovery](../src/core/import.ts) uses `import.meta.glob('../adapters/*.adapter.ts', { eager: true })`; the new module is discovered automatically. **Do not change the dispatcher or add source-name conditionals there.** Runtime external plugin loading is not implemented.
5. Keep detection narrow and mutually distinguishable. First match wins; there is no ambiguity resolution UI or explicit priority API. Native `schemaVersion` input should not be captured by another adapter. Duplicate registry IDs throw.
6. Use `TraceBuilder` and shared helpers for bounded output, notices, timestamps, status and usage. `parseTrace` applies final `validateTrace`; unknown schema fields are stripped. Preserve unknown values, do not infer failure from prose, and never include source strings in errors/logs.
7. Add synthetic positive, unsupported-shape, malformed, limit, duplicate-ID, usage/cache, and out-of-order pairing tests as relevant. Confirm noninterference with existing adapters. Update [format documentation](formats.md) with actual mappings and public references; adding docs/tests does not require dispatcher edits.

Core functions are internal source APIs, not a promised semver-stable library interface. A new format must preserve the common contract: `Usage.input` includes cache subcounts; trace-level usage takes precedence; optional timings remain optional.

## Resource and presentation limits

| Boundary | Current value |
| --- | --- |
| Selection | ≤5 files; ≤20 MiB per file; reject oversize selections before reading |
| Workspace | ≤10 sessions including the two demos |
| Parser | ≤20,000 input records; ≤20,000 events; nesting ≤60 |
| Import lifetime | 30 seconds per file; cancel entire pending batch without dropping prior sessions |
| Timeline | 100 rows/page; 50,000 detail characters across fields; AND-combined literal/kind/status/duration filters |
| Export preview | 50,000 displayed characters; full transformed download |
| Comparison | First 100 sorted tool names; sequence: 2,000 selected events/side, 400 edits, 200 ms alignment budget, 50 rows/page |

Web Workers are required for UI imports; no synchronous fallback is provided. A worker protects responsiveness during parsing, not during all analysis/search/export work. Caps are guardrails, not measured capacity guarantees across browsers.

## Heuristics, not root-cause analysis

`getFindings` reports explicit tool errors, tool duration ≥10,000 ms, recorded output ≥12,000 JavaScript string units, and at least 3 calls with exactly equal event names and input text. Missing input is not evidence of identical input. Equivalent JSON with different whitespace is not equal text. Findings link to observed events, not explanations of intent.

`getStats` uses reported usage and timestamp endpoints; `getToolBreakdown` sums observed durations, which can overlap. Comparison is B − A for recorded values, not experimental control, statistical inference, scoring, or cost estimation. The built-in [demo generator](../src/demo.ts) manufactures sequences, token counts, and timings; its “optimized” label is illustrative only.

## V0.2 event comparison and sharing policy

`filterEvents` is a pure stable filter/sort, with missing durations last in longest-first order; minimum zero is different from no minimum. The timeline returns focus to search on reset and to the originating row (or search if unavailable) on inspector close.

`compareEvents` uses jsdiff `diffArrays` with exact JSON-encoded `(kind, name)` keys. Aligned events compare content/input/output/status/model/duration/usage; original IDs, parent links and absolute timestamps are not cross-run identities. Repeated names can align ambiguously. Exceeded size/edit/time bounds return an explicit unavailable state, never a partial diff. Work still occurs on the UI thread; the budget is a guardrail, not a strict latency guarantee.

The export functions accept an optional third `ExportOptions` argument, with `omitTiming` and `omitUsage`. True flags are valid only for structure mode; pattern mode plus minimization throws. The existing strict allowlist removes original text and unknown fields; omitted metrics are absent, never zero. The dialog shares options/serialization across preview and downloads. Native schema stays 1. See [field contracts and research](v0.2-design.md) and [privacy](privacy.md).

## Tests and deployment

Core Vitest tests reside alongside core modules. [Playwright configuration](../playwright.config.ts) targets desktop Chromium and Pixel 7 emulation using the production preview server. `check` also typechecks browser tests. [CI](../.github/workflows/ci.yml) runs checks and E2E; [Pages](../.github/workflows/pages.yml) independently gates a manual default-branch deployment and runs smoke against the actual public URL, including a version marker and V0.2 controls. The separate [manual Release workflow](../.github/workflows/release.yml) validates, packages a static archive with licenses/checksums, then grants contents-write only to a publication job that does not execute checked-out project code. Existing tags are never overwritten.

V0.2 corrected candidate: [CI 34747596321](https://github.com/FankChen/tracecrate/actions/runs/34747596321) passed 225 unit and 64 browser tests. See [verification](verification.md) for exact revision and V0.2 deployment/release evidence; the following V0.1 results are historical only.

The [v0.1.0 release](https://github.com/FankChen/tracecrate/releases/tag/v0.1.0) was created at tested commit `52d9ae9b73f815c264a3eb39f5fc3eedc5cb9715`. [CI run 34462095959](https://github.com/FankChen/tracecrate/actions/runs/34462095959) passed with 107 unit tests and 36 desktop Chromium / Pixel 7 emulation browser tests. Recorded core/adapters line coverage is 96.58%, not UI coverage. Local browser downloads remain blocked by an enterprise firewall.

[Pages run 34462098830](https://github.com/FankChen/tracecrate/actions/runs/34462098830) succeeded in build, deploy, and actual [public-site](https://fankchen.github.io/tracecrate/) smoke: subpath assets, cold offline first import using a synthetic Claude fixture after page load, default structure-only HTML download, and no console/page errors. The inline worker permits that offline first import without a separate worker fetch; this is not a claim that a fresh page can load offline. The downloaded [synthetic demo screenshot](screenshots/tracecrate-desktop.png) was visually reviewed. See [verification](verification.md) for evidence and coverage limits, and [release gates](release.md) for future revisions.