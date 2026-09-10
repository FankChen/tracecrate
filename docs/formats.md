# Formats and normalization

[Home](../README.md) · [Architecture](architecture.md) · [Privacy](privacy.md)

TraceCrate accepts selected JSON/JSONL shapes, not everything produced by the named tools. The authoritative contract is [types](../src/core/types.ts), [validation](../src/core/helpers.ts), and the [import pipeline](../src/core/import.ts). Upstream formats can change independently.

## Shared import behavior

- Maximum 20 MiB UTF-8 per file; maximum 20,000 top-level input records and 20,000 normalized events; nesting depth at most 60.
- A whole JSON object/array is attempted first, then JSONL. Depth is checked before parsing, and resets per JSONL line: malformed lines cannot consume a later record's depth allowance. Valid over-depth documents or individual records are rejected. A leading BOM is handled. Malformed JSONL lines and non-object records may be skipped with warnings: successful import does **not** imply complete coverage.
- One detected adapter handles each file; unrelated formats are not merged. Object-valued `body` envelopes are unwrapped by the Claude/Codex/OTLP adapters, not decoded from encoded strings.
- Unsupported records/blocks may be omitted. Empty results, duplicate normalized event IDs, invalid usage, and invalid native schemas are rejected. Review the import notices; the UI shows at most 50 notices.
- Native content/input/output strings are each limited to 2,097,152 JavaScript string units. IDs/source/model are bounded at 512, names at 1,024, warnings at 2,048. JSON size is separately measured in UTF-8 bytes.
- Plain prose, compressed archives, binary protobuf, arbitrary MCP transcripts, and live collector connections are not supported.

## Claude Code normal messages

[Adapter](../src/adapters/claude.adapter.ts) · [Synthetic example](../examples/claude.jsonl)

Understands `user`/`assistant` records with `message.content` text or content blocks (`text`, `tool_use`, `tool_result`), plus selected system/error/result records. Tool results pair by call ID, including results preceding calls. Missing pairs produce notices and unpaired result events. Replayed blocks sharing a message identity are deduplicated; this is not full session-tree reconstruction.

Partial `stream_event` deltas are ignored with a warning; they are not assembled. For an existing normal-message export, partial messages are unnecessary. A delta-only file is not a complete trace. Thinking, images, and other unsupported blocks are not imported. Missing timestamps/statuses remain unknown. Aggregate result usage is not added as another billable message.

Claude local transcript files, often kept beneath the user's `.claude/projects` directory, are **private implementation-dependent files**, not a bundled dataset or universally stable public interchange contract. The user must explicitly select an authorized file; TraceCrate does not enumerate, watch, or copy that directory. Do not collect or commit actual histories. A plain CLI history index may not contain supported message content. No agent command needs to be run to try TraceCrate.

Public references: [Claude programmatic output and normal/partial streaming](https://code.claude.com/docs/en/headless), [CLI reference](https://code.claude.com/docs/en/cli-reference). These explain public output options, not a compatibility promise for every private transcript version.

## Codex rollout JSONL

[Adapter](../src/adapters/codex.adapter.ts) · [Synthetic example](../examples/codex.jsonl)

Recognizes `session_meta`, `turn_context`, and `response_item` payloads for messages, `function_call` / `custom_tool_call` and their output records. Call IDs pair inputs with outputs. Selected `event_msg` errors/warnings are represented; `token_count` uses the last supplied `info.total_token_usage` snapshot as the trace total, not the sum of cumulative snapshots.

Other notifications, reasoning blocks, and streaming deltas are omitted with notices. Structured status/exit metadata can establish tool success/failure; words such as “error” in prose alone cannot. Session metadata may contain private paths and context even when message text looks harmless.

Public context: [Codex CLI reference](https://developers.openai.com/codex/cli/reference/) and [non-interactive JSON output](https://developers.openai.com/codex/noninteractive/). Public `codex exec --json` event output is **not the same contract** as local rollout records. Support here is shape-based for the rollout subset above, not a claim of generic Codex JSON support or a stable private-file API. Use existing authorized files, or the synthetic fixture; do not run an agent just to generate a demo.

## OTLP JSON subset

[Adapter](../src/adapters/otlp.adapter.ts) · [Synthetic example](../examples/otlp.json)

Reads `resourceSpans[].scopeSpans[].spans[]`. Requires a span name and `spanId`; `parentSpanId` is retained. Resource attributes are combined with span attributes (span values win). Simple string/bool/int/double and array attribute values are decoded; arbitrary key-value-list structures, span events/links, metrics/logs, and transport semantics are not implemented.

Selected mappings:

| Purpose | Attributes |
| --- | --- |
| Tool classification | `gen_ai.tool.name`, `gen_ai.tool.call.id`, or `gen_ai.operation.name = execute_tool` |
| Model | `gen_ai.response.model`, falling back to `gen_ai.request.model` |
| Usage | `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.usage.cache_read.input_tokens`, `gen_ai.usage.cache_creation.input_tokens` |
| Input | `gen_ai.tool.call.arguments`, `gen_ai.tool.input`, `gen_ai.input.messages`, `gen_ai.prompt` (in precedence order) |
| Output | `gen_ai.tool.call.result`, `gen_ai.tool.output`, `gen_ai.output.messages`, `gen_ai.completion` (in precedence order) |

Use decimal strings for nanosecond timestamps. Unsafe JSON numbers are omitted with warnings. Nanosecond differences use `BigInt` before conversion to milliseconds; invalid/reversed intervals have no fabricated duration. OTLP status 1/2 maps to OK/error (the adapter also tolerates named status strings); unset is unknown.

Span usage is summed as supplied, not treated as a last snapshot. Counters must be **per-operation, not cumulative**, with no duplicate parent/child rollups of the same usage; otherwise totals can double count. TraceCrate does not deduplicate by billing scope. Multiple trace IDs in a file become one imported session; when `traceId` is provided, event IDs are `traceId:spanId` and parents use the same trace namespace. Without `traceId`, original span IDs are preserved. Repeated IDs within the same trace are still rejected. No full distributed-trace reconstruction is claimed.

Public references: [OTLP specification and JSON encoding](https://opentelemetry.io/docs/specs/otlp/), [GenAI semantic conventions](https://github.com/open-telemetry/semantic-conventions-genai). GenAI conventions evolve; the supported keys above, including legacy fallbacks, are the implementation boundary—not a claim of complete standards compliance.

## TraceCrate native schema v1

[Adapter](../src/adapters/native.adapter.ts) · [Type contract](../src/core/types.ts) · [Runtime schema](../src/core/helpers.ts)

One object per file: required `schemaVersion: 1`, `id`, `name`, `source`, `events`, and `warnings`; optional trace-level `usage` and `demo`. Each event requires `id`, `kind`, `name`, `content`, and `status`. Optional fields are `parentId`, `input`, `output`, `timestamp`, `durationMs`, `model`, and `usage`.

Kinds: `user`, `assistant`, `tool`, `system`. Statuses: `ok`, `error`, `unknown`. Timestamps and durations are milliseconds; supplied numeric fields must be finite and nonnegative. There must be 1–20,000 events with unique IDs. Parent IDs are metadata, not proof of a complete acyclic tree. Unknown fields are stripped by validation.

To get a synthetic native sample, export the built-in demo as JSON and reimport it. Both sharing modes yield native reports; they do not preserve the original raw source. Standalone HTML is for reading, not import. Very large generated JSON can exceed the importer size limit even when the original source fit.

Pattern sharing bounds recursive redaction to 60 levels across containers and decoded JSON strings, with a depth preflight before decoding embedded JSON. Over-budget branches are replaced with `[REDACTED]`, never returned as original content. Ordinary text is not truncated by this guard. Pattern matching remains best effort and requires review; structure-only sharing is unchanged.

## Token and timing semantics

`Usage` has four required numeric fields when present: `input`, `output`, `cacheRead`, `cacheWrite`. **Input includes both cache subcounts** and validation requires `cacheRead + cacheWrite <= input`. Do not compute input + caches again. Total reported tokens = input + output; absence is unknown, not zero. Trace-level totals take precedence over event usage, even when explicitly all zero.

- Claude's uncached `input_tokens` is combined with cache-read/cache-creation counts. Per-message snapshot fields use maxima before combination, then messages are summed.
- Codex's cumulative input already includes cached input. The last supplied total is authoritative.
- OTLP input is treated as cache-inclusive and span usage is summed as reported.

Elapsed time is latest known timestamp/end minus earliest recorded timestamp, when enough timing exists. Unanchored durations are not summed into elapsed time. Tool duration sums can overlap and are **not** wall time. Missing values appear as “—”/“Unknown”; TraceCrate does not estimate cost, infer causality, or validate experimental controls.