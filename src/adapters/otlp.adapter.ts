import { number, record, string, sumUsage, text, totalUsage, TraceBuilder, unwrapBody } from '../core/helpers';
import { registerAdapter } from '../core/registry';
import type { Adapter, Usage } from '../core/types';

function attributeValue(value: unknown): unknown {
  const item = record(value);
  if (typeof item.stringValue === 'string') return item.stringValue;
  if (typeof item.boolValue === 'boolean') return item.boolValue;
  if (item.intValue !== undefined) {
    const n = Number(item.intValue);
    return Number.isSafeInteger(n) ? n : undefined;
  }
  if (typeof item.doubleValue === 'number' && Number.isFinite(item.doubleValue)) return item.doubleValue;
  if (Array.isArray(record(item.arrayValue).values)) return (record(item.arrayValue).values as unknown[]).map(attributeValue);
  return undefined;
}

function attributes(value: unknown): Record<string, unknown> {
  const result: Record<string, unknown> = Object.create(null);
  if (!Array.isArray(value)) return result;
  for (const entry of value) {
    const item = record(entry);
    if (typeof item.key === 'string') result[item.key] = attributeValue(item.value);
  }
  return result;
}

/** Integer nanoseconds must remain BigInt until division; unsafe JSON numbers are rejected. */
function nanos(value: unknown): bigint | undefined {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value >= 0 ? BigInt(value) : undefined;
  if (typeof value !== 'string' || !/^\d{1,20}$/.test(value)) return undefined;
  const result = BigInt(value);
  return result <= 18_446_744_073_709_551_615n ? result : undefined;
}

function milliseconds(value: bigint): number {
  return Number(value / 1_000_000n) + Number(value % 1_000_000n) / 1_000_000;
}

const adapter: Adapter = {
  id: 'otlp',
  label: 'OTLP JSON spans with selected GenAI attributes',
  detect: ({ records }) => !records.some((item) => Object.hasOwn(item, 'schemaVersion')) && records.some((raw) => Array.isArray(unwrapBody(raw).resourceSpans)),
  parse: ({ records, warnings }, filename) => {
    const builder = new TraceBuilder('otlp', filename, warnings);
    const usages: Usage[] = [];
    let recognized = 0;
    for (const raw of records) {
      const item = unwrapBody(raw);
      if (!Array.isArray(item.resourceSpans)) continue;
      recognized++;
      for (const resource of item.resourceSpans) {
        const group = record(resource);
        const resourceAttributes = attributes(record(group.resource).attributes);
        if (!Array.isArray(group.scopeSpans)) continue;
        for (const scope of group.scopeSpans) {
          const spans = record(scope).spans;
          if (!Array.isArray(spans)) continue;
          for (const rawSpan of spans) {
            const span = record(rawSpan);
            if (!string(span.spanId) || !string(span.name)) {
              builder.warn('OTLP span without a name or spanId ignored.');
              continue;
            }
            const attrs = { ...resourceAttributes, ...attributes(span.attributes) };
            const start = nanos(span.startTimeUnixNano);
            const end = nanos(span.endTimeUnixNano);
            if ((span.startTimeUnixNano !== undefined && start === undefined) || (span.endTimeUnixNano !== undefined && end === undefined)) builder.warn('Invalid or unsafe OTLP nanosecond timestamps omitted. Export nanoseconds as decimal strings.');
            if (start !== undefined && end !== undefined && end < start) builder.warn('OTLP span end precedes start; duration omitted.');
            const toolName = string(attrs['gen_ai.tool.name']);
            const callId = string(attrs['gen_ai.tool.call.id']);
            const isTool = !!(toolName || callId || attrs['gen_ai.operation.name'] === 'execute_tool');
            const status = record(span.status).code;
            const usage = totalUsage(number(attrs['gen_ai.usage.input_tokens']), number(attrs['gen_ai.usage.output_tokens']), number(attrs['gen_ai.usage.cache_read.input_tokens']), number(attrs['gen_ai.usage.cache_creation.input_tokens']));
            if (usage) usages.push(usage);
            const input = attrs['gen_ai.tool.call.arguments'] ?? attrs['gen_ai.tool.input'] ?? attrs['gen_ai.input.messages'] ?? attrs['gen_ai.prompt'];
            const output = attrs['gen_ai.tool.call.result'] ?? attrs['gen_ai.tool.output'] ?? attrs['gen_ai.output.messages'] ?? attrs['gen_ai.completion'];
            const traceId = string(span.traceId);
            const spanId = string(span.spanId)!;
            const parentSpanId = string(span.parentSpanId);
            // The contract has no callId field: retain it as inert JSON in content.
            builder.add({
              id: traceId ? `${traceId}:${spanId}` : spanId,
              parentId: traceId && parentSpanId ? `${traceId}:${parentSpanId}` : parentSpanId,
              kind: isTool ? 'tool' : (attrs['gen_ai.operation.name'] || attrs['gen_ai.request.model'] || attrs['gen_ai.response.model'] || usage ? 'assistant' : 'system'),
              name: toolName ?? string(span.name)!,
              content: callId ? text({ callId, input, output }) : text(output ?? record(span.status).message),
              input: input === undefined ? undefined : text(input),
              output: output === undefined ? undefined : text(output),
              timestamp: start === undefined ? undefined : milliseconds(start),
              durationMs: start !== undefined && end !== undefined && end >= start ? milliseconds(end - start) : undefined,
              status: status === 2 || status === 'STATUS_CODE_ERROR' ? 'error' : status === 1 || status === 'STATUS_CODE_OK' ? 'ok' : 'unknown',
              model: string(attrs['gen_ai.response.model']) ?? string(attrs['gen_ai.request.model']),
              usage,
            });
          }
        }
      }
    }
    builder.trace.usage = sumUsage(usages);
    builder.warn('OTLP JSON subset: resourceSpans/scopeSpans/spans and selected GenAI attributes only; not full OTLP or MCP support. Span token usage is summed as reported.');
    if (recognized < records.length) builder.warn('Unrecognized records ignored in OTLP import.');
    return builder.trace;
  },
};

registerAdapter(adapter);