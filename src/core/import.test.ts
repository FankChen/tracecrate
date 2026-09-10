import { describe, expect, it, vi } from 'vitest';
import { MAX_EVENTS, MAX_FILE_BYTES, parseTrace } from './import';
import { getAdapters } from './registry';
import claudeFixture from '../../examples/claude.jsonl?raw';
import codexFixture from '../../examples/codex.jsonl?raw';
import otlpFixture from '../../examples/otlp.json?raw';

const event = { id: 'e1', kind: 'assistant', name: 'Assistant', content: 'Synthetic', status: 'unknown' };
const native = () => ({ schemaVersion: 1, id: 'trace1', name: 'Synthetic', source: 'synthetic', events: [{ ...event }], warnings: [] });
const jsonl = (...records: unknown[]) => records.map((item) => JSON.stringify(item)).join('\n');
const claude = (content: unknown, usage?: unknown, id = 'm1') => ({ type: 'assistant', message: { id, content, usage } });
const response = (payload: unknown, timestamp?: number) => ({ type: 'response_item', payload, timestamp });
const tokens = (input: number, output: number, cached = 0) => ({ type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: input, output_tokens: output, cached_input_tokens: cached } } } });
const otlp = (...spans: unknown[]) => ({ resourceSpans: [{ scopeSpans: [{ spans }] }] });

describe('format dispatch and bounded decoding', () => {
  it('auto-discovers self-registering adapters', () => {
    expect(getAdapters().map((adapter) => adapter.id).sort()).toEqual(['claude', 'codex', 'native', 'otlp']);
  });

  it('reads synthetic JSONL/JSON fixtures and reimports native reports', () => {
    for (const fixture of [claudeFixture, codexFixture, otlpFixture]) {
      const trace = parseTrace(fixture, 'fixture');
      expect(trace.events.length).toBeGreaterThan(0);
      expect(parseTrace(JSON.stringify(trace))).toEqual(trace);
    }
  });

  it('handles BOM, JSON object, arrays and object-valued body envelopes', () => {
    expect(parseTrace('\uFEFF' + JSON.stringify(native())).source).toBe('synthetic');
    const message = claude([{ type: 'text', text: 'Hi' }]);
    expect(parseTrace(JSON.stringify([message])).events).toHaveLength(1);
    expect(parseTrace(JSON.stringify({ body: { body: message } })).events).toHaveLength(1);
  });

  it('skips malformed JSONL without echoing payload and preserves original line numbers', () => {
    const trace = parseTrace('\uFEFF\n' + JSON.stringify(claude('ok')) + '\n{"private-secret": BAD}\nnull\n');
    expect(trace.warnings).toEqual(['Skipped malformed JSONL line 3.', 'Skipped non-object JSONL line 4.']);
    expect(trace.warnings.join()).not.toContain('private-secret');
  });

  it.each(['', '   ', '{bad}', '{}', '[]', 'null', '[1,2]', '{"arbitrary":"data"}', 'not json\nnot json'])('rejects empty, malformed or unrecognized input %s', (value) => {
    expect(() => parseTrace(value)).toThrow();
  });

  it('provides an actionable unsupported-format error', () => {
    expect(() => parseTrace('{}')).toThrow(/Claude Code.*Codex.*OTLP/);
  });

  it('bounds records including invalid JSONL records', () => {
    expect(() => parseTrace(JSON.stringify(Array.from({ length: MAX_EVENTS + 1 }, () => ({}))))).toThrow(/20000 records/);
    expect(() => parseTrace('bad\n'.repeat(MAX_EVENTS + 1))).toThrow(/20000 records/);
  });

  it('bounds UTF-8 bytes, not JS character count', () => {
    expect(MAX_FILE_BYTES).toBe(20 * 1024 * 1024);
    const multibyte = '汉'.repeat(Math.floor(MAX_FILE_BYTES / 3) + 1);
    expect(multibyte.length).toBeLessThan(MAX_FILE_BYTES);
    expect(() => parseTrace(multibyte)).toThrow(/20 MiB/);
  });

  it('rejects nesting over 60 before JSON parse and ignores brackets inside strings', () => {
    expect(() => parseTrace('['.repeat(61) + '0' + ']'.repeat(61))).toThrow(/depth of 60/);
    expect(parseTrace(JSON.stringify(claude('['.repeat(100) + '\\"'))).events).toHaveLength(1);
    const bounded = { ...native(), ignored: JSON.parse('['.repeat(59) + '0' + ']'.repeat(59)) };
    expect(parseTrace(JSON.stringify(bounded)).events).toHaveLength(1);
  });

  it('resets depth after 61 malformed opening lines and keeps warning line numbers', () => {
    const trace = parseTrace('{\n'.repeat(61) + JSON.stringify(claude('survives')));
    expect(trace.events.map((item) => item.content)).toEqual(['survives']);
    expect(trace.warnings).toEqual(Array.from({ length: 61 }, (_, i) => `Skipped malformed JSONL line ${i + 1}.`));
  });

  it.each([false, true])('rejects valid deep native JSON before parsing (pretty=%s)', (pretty) => {
    const source = JSON.stringify({ ...native(), ignored: JSON.parse('['.repeat(60) + '0' + ']'.repeat(60)) }, null, pretty ? 2 : undefined);
    const parse = vi.spyOn(JSON, 'parse');
    try {
      expect(() => parseTrace(source)).toThrow(/depth of 60/);
      expect(parse).not.toHaveBeenCalled();
    } finally {
      parse.mockRestore();
    }
  });

  it('does not import a supported interior line of a valid deep multiline document', () => {
    const source = '{"ignored":\n' + '[\n'.repeat(61) + JSON.stringify(claude('not a JSONL record')) + '\n]'.repeat(61) + '\n}';
    expect(() => parseTrace(source)).toThrow(/depth of 60/);
  });

  it('rejects a valid deep JSONL record without parsing it', () => {
    const deep = '{"ignored":' + '['.repeat(60) + '0' + ']'.repeat(60) + '}';
    const source = JSON.stringify(claude('ok')) + '\n' + deep;
    const parse = vi.spyOn(JSON, 'parse');
    try {
      expect(() => parseTrace(source)).toThrow(/depth of 60/);
      expect(parse.mock.calls.some(([value]) => value === deep || value === source)).toBe(false);
    } finally {
      parse.mockRestore();
    }
  });

  it.each([
    '{'.repeat(61),
    '['.repeat(61) + '0,' + ']'.repeat(61),
    '['.repeat(61) + '01' + ']'.repeat(61),
    '['.repeat(61) + '{"key":true,}' + ']'.repeat(61),
    '['.repeat(61) + '"bad\\xescape"' + ']'.repeat(61),
    '['.repeat(61) + '}' + ']'.repeat(61),
  ])('skips malformed over-depth lines without parsing them: %s', (bad) => {
    const source = bad + '\n' + JSON.stringify(claude('ok'));
    const parse = vi.spyOn(JSON, 'parse');
    try {
      const trace = parseTrace(source);
      expect(trace.events[0].content).toBe('ok');
      expect(trace.warnings).toEqual(['Skipped malformed JSONL line 1.']);
      expect(parse.mock.calls.some(([value]) => value === bad || value === source)).toBe(false);
    } finally {
      parse.mockRestore();
    }
  });

  it('recognizes deep valid JSON syntax without materializing its values', () => {
    const leaf = '{"escaped\\\"key":[true,false,null,-1.25e+2,"\\u1234",{},[]]}';
    expect(() => parseTrace('[\n'.repeat(61) + leaf + '\n]'.repeat(61))).toThrow(/depth of 60/);
  });

  it('treats scripts and prototype keys as inert text/data', () => {
    const payload = '<script>globalThis.tracecrateExecuted = true</script>';
    const trace = parseTrace(JSON.stringify(claude(payload)));
    expect(trace.events[0].content).toBe(payload);
    expect(Reflect.get(globalThis, 'tracecrateExecuted')).toBeUndefined();
    const report = JSON.stringify(native()).replace('"schemaVersion":1', '"__proto__":{"polluted":true},"schemaVersion":1');
    expect(Object.hasOwn(parseTrace(report), '__proto__')).toBe(false);
    expect(Reflect.get({}, 'polluted')).toBeUndefined();
  });
});

describe('native schema', () => {
  it('cannot bypass native validation by adding source-specific fields', () => {
    expect(() => parseTrace(JSON.stringify({ ...native(), ...claude('Hi'), schemaVersion: 2 }))).toThrow(/Invalid trace/);
  });

  it('strips unknown fields at every level', () => {
    const trace = parseTrace(JSON.stringify({ ...native(), ignored: true, usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, secret: 'x' }, events: [{ ...event, secret: 'x' }] }));
    expect(trace).not.toHaveProperty('ignored');
    expect(trace.events[0]).not.toHaveProperty('secret');
    expect(trace.usage).not.toHaveProperty('secret');
  });

  it.each([
    { schemaVersion: 2 }, { events: [] }, { events: [event, event] },
    { events: [{ ...event, kind: 'bad' }] }, { events: [{ ...event, status: 'success' }] },
    { events: [{ ...event, timestamp: -1 }] }, { events: [{ ...event, durationMs: -1 }] },
    { events: [{ ...event, name: '' }] }, { events: [{ ...event, id: 'x'.repeat(513) }] },
    { events: [{ ...event, input: {} }] }, { warnings: [42] },
    { usage: { input: 1, output: 0, cacheRead: 2, cacheWrite: 0 } },
    { usage: { input: 1, output: 0 } },
  ])('rejects invalid nested native data %j', (override) => {
    expect(() => parseTrace(JSON.stringify({ ...native(), ...override }))).toThrow(/Invalid trace/);
  });

  it('rejects nonfinite numbers and too many events', () => {
    expect(() => parseTrace(JSON.stringify(native()).replace('"content":"Synthetic"', '"timestamp":1e400,"content":"Synthetic"'))).toThrow(/Invalid trace/);
    expect(() => parseTrace(JSON.stringify({ ...native(), events: Array.from({ length: MAX_EVENTS + 1 }, (_, i) => ({ ...event, id: `e${i}` })) }))).toThrow(/Invalid trace/);
  });

  it('distinguishes zero usage/time from unknown', () => {
    const absent = parseTrace(JSON.stringify(native()));
    expect(absent.usage).toBeUndefined();
    expect(absent.events[0].timestamp).toBeUndefined();
    const present = parseTrace(JSON.stringify({ ...native(), events: [{ ...event, timestamp: 0, durationMs: 0 }], usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }));
    expect(present.usage?.input).toBe(0);
    expect(present.events[0].timestamp).toBe(0);
  });
});

describe('Claude normal messages', () => {
  it('keeps distinct blocks sharing an ID, dedups snapshots and takes per-field usage maxima', () => {
    const one = claude([{ type: 'text', text: 'one' }], { input_tokens: 10, output_tokens: 1, cache_read_input_tokens: 3 });
    const two = claude([{ type: 'text', text: 'two' }], { input_tokens: 8, output_tokens: 5, cache_creation_input_tokens: 2 });
    const trace = parseTrace(jsonl(one, one, two, two));
    expect(trace.events.map((item) => item.content)).toEqual(['one', 'two']);
    expect(trace.usage).toEqual({ input: 15, output: 5, cacheRead: 3, cacheWrite: 2 });
    expect(trace.events.filter((item) => item.usage)).toHaveLength(1);
  });

  it('preserves identical repeated blocks within a message', () => {
    const block = { type: 'text', text: 'repeat' };
    expect(parseTrace(JSON.stringify(claude([block, block]))).events).toHaveLength(2);
  });

  it('pairs tools and only reports explicit success; never fabricates missing times', () => {
    const call = claude([{ type: 'tool_use', id: 't', name: 'lookup', input: { key: 1 } }]);
    const result = { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't', content: 'error is a word here' }] } };
    const trace = parseTrace(jsonl(call, result));
    expect(trace.events).toHaveLength(1);
    expect(trace.events[0]).toMatchObject({ kind: 'tool', status: 'unknown', output: 'error is a word here' });
    expect(trace.events[0].timestamp).toBeUndefined();
    expect(trace.events[0].durationMs).toBeUndefined();
    expect(parseTrace(claudeFixture).events.find((item) => item.kind === 'tool')).toMatchObject({ status: 'ok', durationMs: 1000 });
  });

  it('pairs out-of-order results and keeps orphan results', () => {
    const result = { type: 'user', timestamp: 1, message: { content: [{ type: 'tool_result', tool_use_id: 't', content: 'no', is_error: true }] } };
    const call = { ...claude([{ type: 'tool_use', id: 't', name: 'lookup', input: {} }]), timestamp: 0 };
    expect(parseTrace(jsonl(result, call)).events[0]).toMatchObject({ status: 'error', durationMs: 1, timestamp: 0 });
    expect(parseTrace(jsonl(result)).events[0].name).toBe('Unpaired tool result');
  });

  it('ignores partial stream events with a warning and retains meaningful errors', () => {
    const partial = { type: 'stream_event', event: { type: 'content_block_delta', delta: { text: 'partial' } } };
    const trace = parseTrace(jsonl(partial, claude('complete'), { type: 'error', error: 'Synthetic failure' }));
    expect(trace.events.map((item) => item.content)).toEqual(['complete', 'Synthetic failure']);
    expect(trace.events[1].status).toBe('error');
    expect(trace.warnings.join()).toContain('Partial stream_event');
    expect(() => parseTrace(jsonl(partial))).toThrow(/No supported events/);
  });

  it('distinguishes zero usage from absent and ignores aggregate result usage', () => {
    expect(parseTrace(JSON.stringify(claude('no usage'))).usage).toBeUndefined();
    const trace = parseTrace(jsonl(claude('zero', { input_tokens: 0, output_tokens: 0 }), { type: 'result', is_error: false, result: 'done', usage: { input_tokens: 100 } }));
    expect(trace.usage).toEqual({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
  });

  it('bounds expansion into events independently of records', () => {
    expect(() => parseTrace(JSON.stringify(claude(Array.from({ length: MAX_EVENTS + 1 }, (_, i) => ({ type: 'text', text: String(i) })))))).toThrow(/20000 events/);
  });
});

describe('Codex rollout', () => {
  it('uses last cumulative snapshot only, never mirrored onto messages', () => {
    const trace = parseTrace(jsonl(response({ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'hi' }] }), tokens(100, 10, 20), tokens(50, 5, 10)));
    expect(trace.usage).toEqual({ input: 50, output: 5, cacheRead: 10, cacheWrite: 0 });
    expect(trace.events.every((item) => item.usage === undefined)).toBe(true);
  });

  it('pairs function/custom tools conservatively and does not classify prose containing error', () => {
    const trace = parseTrace(jsonl(
      response({ type: 'function_call', call_id: 'a', name: 'shell', arguments: '{}', status: 'completed' }, 0),
      response({ type: 'function_call_output', call_id: 'a', output: 'error count: 0' }, 5),
      response({ type: 'custom_tool_call', call_id: 'b', name: 'patch', input: 'synthetic' }),
      response({ type: 'custom_tool_call_output', call_id: 'b', output: '{"metadata":{"exit_code":0},"output":"error word"}' }),
      response({ type: 'function_call', call_id: 'c', name: 'shell', arguments: '{}' }),
      response({ type: 'function_call_output', call_id: 'c', output: { exit_code: 1, stdout: 'failed' } }),
      response({ type: 'function_call', call_id: 'd', name: 'pending', status: 'completed' }),
    ));
    expect(trace.events.map((item) => item.status)).toEqual(['unknown', 'ok', 'error', 'unknown']);
    expect(trace.events[0]).toMatchObject({ timestamp: 0, durationMs: 5 });
    expect(trace.events[1].durationMs).toBeUndefined();
    expect(trace.events[3].output).toBeUndefined();
  });

  it('retains explicit error events and zero token snapshots', () => {
    const trace = parseTrace(jsonl({ type: 'session_meta', payload: { id: 'synthetic' } }, { type: 'event_msg', payload: { type: 'error', message: 'Synthetic' } }, tokens(0, 0)));
    expect(trace.events[1].status).toBe('error');
    expect(trace.usage?.input).toBe(0);
  });
});

describe('OTLP JSON subset', () => {
  it('preserves parent spans, model, usage and optional tool data', () => {
    const trace = parseTrace(otlpFixture);
    expect(trace.usage).toEqual({ input: 12, output: 3, cacheRead: 0, cacheWrite: 0 });
    expect(trace.events[0].model).toBe('synthetic-model');
    expect(trace.events[0].id).toBe('00000000000000000000000000000001:0000000000000001');
    expect(trace.events[1]).toMatchObject({ parentId: trace.events[0].id, kind: 'tool', status: 'error', output: 'not found', durationMs: 1 });
    expect(JSON.parse(trace.events[1].content).callId).toBe('call-1');
  });

  it('preserves original span and parent IDs when traceId is absent', () => {
    const trace = parseTrace(JSON.stringify(otlp(
      { spanId: 'parent', name: 'root' },
      { spanId: 'child', parentSpanId: 'parent', name: 'child' },
    )));
    expect(trace.events.map((item) => item.id)).toEqual(['parent', 'child']);
    expect(trace.events[1].parentId).toBe('parent');
  });

  it('subtracts nanoseconds before conversion and accepts timestamp zero', () => {
    const trace = parseTrace(JSON.stringify(otlp(
      { spanId: 'a', name: 'precise', startTimeUnixNano: '1767225600000000001', endTimeUnixNano: '1767225600000000101' },
      { spanId: 'b', name: 'zero', startTimeUnixNano: '0', endTimeUnixNano: '0' },
      { spanId: 'c', name: 'missing' },
      { spanId: 'd', name: 'unsafe', startTimeUnixNano: 1767225600000000000 },
    )));
    expect(trace.events[0].durationMs).toBe(0.0001);
    expect(trace.events[0].status).toBe('unknown');
    expect(trace.events[1]).toMatchObject({ timestamp: 0, durationMs: 0 });
    expect(trace.events[2].durationMs).toBeUndefined();
    expect(trace.events[3].timestamp).toBeUndefined();
    expect(trace.warnings.join()).toContain('unsafe OTLP');
  });

  it('rejects duplicate span IDs', () => {
    const span = { spanId: 'duplicate', name: 'test' };
    expect(() => parseTrace(JSON.stringify(otlp(span, span)))).toThrow(/Duplicate event IDs/);
  });

  it('namespaces reused span IDs and parents by trace while summing operation usage', () => {
    const traceIds = ['a'.repeat(32), 'b'.repeat(32)];
    const parent = '0000000000000001';
    const child = '0000000000000002';
    const spans = traceIds.flatMap((traceId, index) => [
      { traceId, spanId: parent, name: 'root' },
      { traceId, spanId: child, parentSpanId: parent, name: 'operation', attributes: [
        { key: 'gen_ai.usage.input_tokens', value: { intValue: String(10 + index) } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: '2' } },
        { key: 'gen_ai.usage.cache_read.input_tokens', value: { intValue: '3' } },
      ] },
    ]);
    const trace = parseTrace(JSON.stringify(otlp(...spans)));
    expect(trace.events.map((item) => item.id)).toEqual(traceIds.flatMap((id) => [`${id}:${parent}`, `${id}:${child}`]));
    expect(trace.events.filter((item) => item.parentId).map((item) => item.parentId)).toEqual(traceIds.map((id) => `${id}:${parent}`));
    expect(trace.usage).toEqual({ input: 21, output: 4, cacheRead: 6, cacheWrite: 0 });
    expect(trace.events.filter((item) => item.usage).map((item) => item.usage?.input)).toEqual([10, 11]);
    expect(parseTrace(JSON.stringify(trace))).toEqual(trace);
    expect(() => parseTrace(JSON.stringify(otlp(...spans, spans[1])))).toThrow(/Duplicate event IDs/);
  });
});