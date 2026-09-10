import { z } from 'zod';
import type { EventStatus, Trace, TraceEvent, Usage } from './types';

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_EVENTS = 20_000;
export const MAX_DEPTH = 60;
const MAX_CONTENT = 2 * 1024 * 1024;
const nonnegative = z.number().finite().nonnegative();
const identifier = z.string().min(1).max(512);
const content = z.string().max(MAX_CONTENT);

export const usageSchema = z.object({
  input: nonnegative,
  output: nonnegative,
  cacheRead: nonnegative,
  cacheWrite: nonnegative,
}).strip().refine((usage) => usage.cacheRead + usage.cacheWrite <= usage.input, {
  message: 'Cached input must be a subset of total input.',
});

export const traceSchema = z.object({
  schemaVersion: z.literal(1),
  id: identifier,
  name: z.string().min(1).max(1024),
  source: identifier,
  events: z.array(z.object({
    id: identifier,
    parentId: identifier.optional(),
    kind: z.enum(['user', 'assistant', 'tool', 'system']),
    name: z.string().min(1).max(1024),
    content,
    input: content.optional(),
    output: content.optional(),
    timestamp: nonnegative.optional(),
    durationMs: nonnegative.optional(),
    status: z.enum(['ok', 'error', 'unknown']),
    model: identifier.optional(),
    usage: usageSchema.optional(),
  }).strip()).min(1).max(MAX_EVENTS),
  warnings: z.array(z.string().max(2048)).max(MAX_EVENTS),
  usage: usageSchema.optional(),
  demo: z.boolean().optional(),
}).strip().refine((trace) => new Set(trace.events.map((event) => event.id)).size === trace.events.length, {
  message: 'Event IDs must be unique.',
});

export function validateTrace(value: unknown): Trace {
  const result = traceSchema.safeParse(value);
  if (!result.success) {
    // Never include Zod paths/values: imported IDs and keys can contain secrets.
    throw new Error('Invalid trace: require schemaVersion 1, unique event IDs, 1–20000 events, valid enums, bounded strings, and finite nonnegative numbers (cached tokens must be a subset of input).');
  }
  return result.data;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

/** Object-valued collector envelopes only; never evaluate encoded bodies. */
export function unwrapBody(value: Record<string, unknown>): Record<string, unknown> {
  let current = value;
  for (let depth = 0; depth < MAX_DEPTH && isRecord(current.body); depth++) {
    const { body, ...outer } = current;
    current = { ...outer, ...body };
  }
  return current;
}

export function string(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function number(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return '';
  return JSON.stringify(value);
}

/** Lexical preflight ignores brackets inside JSON strings and escaped quotes. */
export function checkDepth(value: string): void {
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '{' || char === '[') {
      if (++depth > MAX_DEPTH) throw new Error('Import nesting exceeds the maximum depth of 60. Export a flatter JSON/JSONL trace.');
    } else if (char === '}' || char === ']') depth = Math.max(0, depth - 1);
  }
}

export function timestamp(value: unknown): number | undefined {
  const numeric = number(value);
  if (numeric !== undefined) return numeric;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return undefined;
  return number(Date.parse(value));
}

export function emptyUsage(): Usage {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
}

export function sumUsage(values: Usage[]): Usage | undefined {
  if (!values.length) return undefined;
  return values.reduce((sum, usage) => ({
    input: sum.input + usage.input,
    output: sum.output + usage.output,
    cacheRead: sum.cacheRead + usage.cacheRead,
    cacheWrite: sum.cacheWrite + usage.cacheWrite,
  }), emptyUsage());
}

/** For sources whose input field already includes cached tokens. */
export function totalUsage(input: unknown, output: unknown, cacheRead?: unknown, cacheWrite?: unknown): Usage | undefined {
  const fields = [input, output, cacheRead, cacheWrite].map(number);
  if (fields.every((field) => field === undefined)) return undefined;
  return {
    input: fields[0] ?? ((fields[2] ?? 0) + (fields[3] ?? 0)),
    output: fields[1] ?? 0,
    cacheRead: fields[2] ?? 0,
    cacheWrite: fields[3] ?? 0,
  };
}

/** Only structured, explicit success/failure indicators; prose is not a status. */
export function explicitStatus(...values: unknown[]): EventStatus {
  let success = false;
  for (const value of values) {
    const item = record(value);
    if (item.is_error === true || item.success === false) return 'error';
    if (['error', 'failed', 'failure', 'cancelled', 'incomplete'].includes(String(item.status))) return 'error';
    const code = item.exit_code ?? item.exitCode;
    if (typeof code === 'number' && Number.isFinite(code)) {
      if (code !== 0) return 'error';
      success = true;
    }
    if (item.is_error === false || item.success === true || ['ok', 'success', 'completed'].includes(String(item.status))) success = true;
  }
  return success ? 'ok' : 'unknown';
}

export function structuredOutput(value: unknown): Record<string, unknown> {
  if (isRecord(value)) return value;
  if (typeof value !== 'string' || !value.trimStart().startsWith('{')) return {};
  try {
    checkDepth(value);
    return record(JSON.parse(value));
  } catch {
    return {};
  }
}

export function finishTool(event: TraceEvent, output: unknown, status: EventStatus, end?: number): void {
  event.output = text(output);
  event.content = event.output;
  event.status = status;
  if (event.timestamp !== undefined && end !== undefined && end >= event.timestamp) {
    event.durationMs = end - event.timestamp;
  }
}

export class TraceBuilder {
  readonly trace: Trace;
  private readonly ids = new Set<string>();

  constructor(source: string, filename: string, warnings: string[]) {
    this.trace = {
      schemaVersion: 1,
      id: `${source}-import`,
      name: filename.slice(0, 1024) || 'imported-trace',
      source,
      events: [],
      warnings: [...warnings],
    };
  }

  warn(message: string): void {
    if (!this.trace.warnings.includes(message) && this.trace.warnings.length < MAX_EVENTS) this.trace.warnings.push(message);
  }

  add(event: Omit<TraceEvent, 'id'> & { id?: string }): TraceEvent {
    if (this.trace.events.length >= MAX_EVENTS) throw new Error('Import exceeds the maximum of 20000 events. Split the export into smaller files.');
    const id = event.id ?? `${this.trace.source}-${this.trace.events.length + 1}`;
    if (this.ids.has(id)) throw new Error('Duplicate event IDs in source trace. Export spans with unique IDs.');
    this.ids.add(id);
    const result = { ...event, id };
    this.trace.events.push(result);
    return result;
  }
}