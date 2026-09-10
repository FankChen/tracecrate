import type { ParsedInput, Trace } from './types';
import { checkDepth, isRecord, MAX_EVENTS, MAX_FILE_BYTES, validateTrace } from './helpers';
import { getAdapters } from './registry';

export { MAX_EVENTS, MAX_FILE_BYTES } from './helpers';

// Modules register themselves; adding a source never changes this dispatcher.
import.meta.glob('../adapters/*.adapter.ts', { eager: true });

const unsupported = () => new Error('Unsupported trace format. Import a Tracecrate schemaVersion 1 report, Claude Code message JSONL, Codex rollout JSONL, or OTLP JSON with resourceSpans/scopeSpans/spans. Export JSON/JSONL rather than prose, protobuf, or an MCP transcript.');

/** Syntax-only fallback for depth failures: iterative, without constructing JSON values. */
function isJsonDocument(source: string): boolean {
  // States: value, first key/end, key, colon, object comma/end,
  // first array value/end, array comma/end, document end.
  let state = 0;
  const parents: number[] = [];
  // JSON forbids unescaped control characters inside strings.
  // eslint-disable-next-line no-control-regex
  const token = /[ \t\r\n]*("(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[{}[\]:,])/y;
  let offset = 0;
  for (;;) {
    token.lastIndex = offset;
    const match = token.exec(source);
    if (!match) return state === 7 && /^[ \t\r\n]*$/.test(source.slice(offset));
    offset = token.lastIndex;
    const value = match[1];
    const close = () => {
      parents.pop();
      state = parents.at(-1) ?? 7;
    };
    if (state === 1 || state === 2) {
      if (state === 1 && value === '}') close();
      else if (value.startsWith('"')) state = 3;
      else return false;
    } else if (state === 3) {
      if (value !== ':') return false;
      state = 0;
    } else if (state === 4 || state === 6) {
      if (value === (state === 4 ? '}' : ']')) close();
      else if (value === ',') state = state === 4 ? 2 : 0;
      else return false;
    } else if (state === 5 && value === ']') {
      close();
    } else if (state === 0 || state === 5) {
      if (value === '{') {
        parents.push(4);
        state = 1;
      } else if (value === '[') {
        parents.push(6);
        state = 5;
      } else if (/^["\dtfn-]/.test(value)) {
        state = parents.at(-1) ?? 7;
      } else return false;
    } else return false;
  }
}

function decode(text: string): ParsedInput {
  if (text.length > MAX_FILE_BYTES || new TextEncoder().encode(text).byteLength > MAX_FILE_BYTES) {
    throw new Error('File exceeds the 20 MiB UTF-8 limit. Split the export into smaller files.');
  }
  const source = text.replace(/^\uFEFF/, '');
  if (!source.trim()) throw new Error('Trace is empty. Choose a JSON or JSONL trace export.');
  let depthError: unknown;
  try {
    checkDepth(source);
  } catch (error) {
    depthError = error;
    // A valid deep document must not be mistaken for JSONL, even if one of
    // its interior lines happens to be a supported record.
    if (isJsonDocument(source)) throw error;
  }
  let parsed: unknown;
  let wholeDocument = false;
  if (!depthError) {
    try {
      parsed = JSON.parse(source);
      wholeDocument = true;
    } catch {
      // JSONL is attempted only after whole-document JSON fails.
    }
  }
  const input: ParsedInput = { records: [], warnings: [] };
  if (wholeDocument) {
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    if (entries.length > MAX_EVENTS) throw new Error('Import exceeds the maximum of 20000 records. Split the export.');
    entries.forEach((entry, index) => {
      if (isRecord(entry)) input.records.push(entry);
      else input.warnings.push(`Skipped non-object record ${index + 1}.`);
    });
  } else {
    let count = 0;
    // Iterate instead of splitting: a 20 MiB file can contain millions of blank lines.
    const lines = source.matchAll(/[^\n]*(?:\n|$)/g);
    let lineNumber = 0;
    for (const match of lines) {
      lineNumber++;
      const line = match[0].trim();
      if (!line) continue;
      if (++count > MAX_EVENTS) throw new Error('Import exceeds the maximum of 20000 records. Split the export.');
      try {
        checkDepth(line);
      } catch (error) {
        // Reset the preflight per line. Malformed deep lines are skippable,
        // but valid over-depth records are rejected without JSON.parse.
        if (isJsonDocument(line)) throw error;
        input.warnings.push(`Skipped malformed JSONL line ${lineNumber}.`);
        continue;
      }
      try {
        const entry: unknown = JSON.parse(line);
        if (isRecord(entry)) input.records.push(entry);
        else input.warnings.push(`Skipped non-object JSONL line ${lineNumber}.`);
      } catch {
        input.warnings.push(`Skipped malformed JSONL line ${lineNumber}.`);
      }
    }
  }
  if (!input.records.length) throw depthError ?? unsupported();
  return input;
}

export function parseTrace(text: string, filename = 'imported-trace'): Trace {
  const input = decode(text);
  const adapter = getAdapters().find((candidate) => candidate.detect(input));
  if (!adapter) throw unsupported();
  const trace = adapter.parse(input, filename);
  if (!trace.events.length) throw new Error('No supported events found. Partial streaming deltas and metadata alone are not a complete trace; export normal messages or spans.');
  return validateTrace(trace);
}