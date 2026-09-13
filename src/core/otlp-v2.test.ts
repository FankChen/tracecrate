import { describe, expect, it } from 'vitest';
import { parseTrace } from './import';

// All payloads are synthetic OTLP JSON, exercised through public import dispatch.
const attr = (key: string, value: unknown) => ({ key, value });
const str = (stringValue: string) => ({ stringValue });
const int = (intValue: unknown) => ({ intValue });
const array = (...values: unknown[]) => ({ arrayValue: { values } });
const object = (...values: unknown[]) => ({ kvlistValue: { values } });
const span = (attributes: unknown[], extra: Record<string, unknown> = {}) => ({ spanId: 'synthetic-span', name: 'Synthetic operation', attributes, ...extra });
const document = (spans: unknown[], resourceAttributes: unknown[] = []) => ({ resourceSpans: [{ resource: { attributes: resourceAttributes }, scopeSpans: [{ spans }] }] });
const read = (attributes: unknown[]) => parseTrace(JSON.stringify(document([span(attributes)])));
const currentCache = 'gen_ai.usage.cache_write.input_tokens';
const legacyCache = 'gen_ai.usage.cache_creation.input_tokens';
const conflictWarning = 'Conflicting OTLP cache-write aliases; current cache-write value preferred.';

describe('OTLP V2 structured AnyValue import', () => {
  it('preserves nested input/output messages as inert JSON text and round-trips native traces', () => {
    const message = (role: string, value: unknown) => object(
      attr('role', str(role)),
      attr('parts', array(object(attr('type', str('text')), attr('content', value)))),
    );
    const trace = read([
      attr('gen_ai.operation.name', str('chat')),
      attr('gen_ai.input.messages', array(message('user', str('Synthetic question')))),
      attr('gen_ai.output.messages', array(message('assistant', str('Synthetic answer')))),
    ]);
    const event = trace.events[0];
    expect(event.kind).toBe('assistant');
    expect(JSON.parse(event.input!)).toEqual([{ role: 'user', parts: [{ type: 'text', content: 'Synthetic question' }] }]);
    expect(JSON.parse(event.output!)).toEqual([{ role: 'assistant', parts: [{ type: 'text', content: 'Synthetic answer' }] }]);
    expect(event.content).toBe(event.output);
    expect(parseTrace(JSON.stringify(trace))).toEqual(trace);
  });

  it('preserves structured tool arguments/results and primitives without inferring status', () => {
    const input = object(
      attr('query', str('Synthetic lookup')),
      attr('options', object(attr('enabled', { boolValue: false }), attr('offset', int('-2')))),
      attr('values', array(str(''), int(0), { boolValue: true }, { doubleValue: -1.25 }, array(int('3')))),
      attr('emptyObject', object()),
      attr('emptyArray', array()),
    );
    const output = object(attr('success', { boolValue: true }), attr('items', array(object(attr('id', int(7))))));
    const trace = read([
      attr('gen_ai.tool.name', str('synthetic_lookup')),
      attr('gen_ai.tool.call.id', str('synthetic-call')),
      attr('gen_ai.tool.call.arguments', input),
      attr('gen_ai.tool.call.result', output),
    ]);
    const event = trace.events[0];
    const expectedInput = { query: 'Synthetic lookup', options: { enabled: false, offset: -2 }, values: ['', 0, true, -1.25, [3]], emptyObject: {}, emptyArray: [] };
    const expectedOutput = { success: true, items: [{ id: 7 }] };
    expect(event).toMatchObject({ kind: 'tool', name: 'synthetic_lookup', status: 'unknown' });
    expect(JSON.parse(event.input!)).toEqual(expectedInput);
    expect(JSON.parse(event.output!)).toEqual(expectedOutput);
    expect(JSON.parse(event.content)).toEqual({ callId: 'synthetic-call', input: expectedInput, output: expectedOutput });
  });

  it('keeps prototype-shaped keys and scripts inert at resource, span and nested levels', () => {
    const marker = 'tracecrateOtlpV2SyntheticPollution';
    const script = '<script>globalThis.tracecrateOtlpV2SyntheticExecuted = true</script>';
    const dangerous = object(
      attr('__proto__', object(attr(marker, { boolValue: true }))),
      attr('constructor', object(attr('prototype', object(attr(marker, { boolValue: true }))))),
      attr('prototype', str('inert')),
      attr('toJSON', str('not callable')),
      attr('hasOwnProperty', str('also inert')),
      attr('script', str(script)),
    );
    const before = Object.getOwnPropertyDescriptors(Object.prototype);
    const trace = parseTrace(JSON.stringify(document([span([
      attr('__proto__', object(attr('gen_ai.tool.name', str('must not inherit')))),
      attr('constructor', dangerous),
      attr('gen_ai.input.messages', array(dangerous)),
    ])], [attr('__proto__', dangerous), attr('toString', dangerous)])));
    const decoded = JSON.parse(trace.events[0].input!)[0];
    expect(trace.events[0].kind).toBe('system');
    expect(Object.hasOwn(decoded, '__proto__')).toBe(true);
    expect(decoded.__proto__).toEqual({ [marker]: true });
    expect(decoded.constructor).toEqual({ prototype: { [marker]: true } });
    expect(decoded.prototype).toBe('inert');
    expect(decoded.toJSON).toBe('not callable');
    expect(decoded.hasOwnProperty).toBe('also inert');
    expect(decoded.script).toBe(script);
    expect(Reflect.get({}, marker)).toBeUndefined();
    expect(Reflect.get(globalThis, 'tracecrateOtlpV2SyntheticExecuted')).toBeUndefined();
    expect(Object.getOwnPropertyDescriptors(Object.prototype)).toEqual(before);
    expect(parseTrace(JSON.stringify(trace))).toEqual(trace);
  });

  it('omits unsupported nested values rather than fabricating nulls or empty strings', () => {
    const unsupported: unknown[] = [
      null, false, 12, 'unwrapped', {}, { bytesValue: 'c3ludGhldGlj' }, { futureValue: {} },
      { stringValue: 3 }, { boolValue: 'false' }, { doubleValue: '1.5' },
      { arrayValue: {} }, { arrayValue: { values: {} } },
      { kvlistValue: {} }, { kvlistValue: { values: null } },
    ];
    const trace = read([
      attr('gen_ai.tool.call.arguments', object(
        ...unsupported.map((value, index) => attr(`unsupported-${index}`, value)),
        attr('kept', str('synthetic')),
        attr('list', array(...unsupported, int(0), { boolValue: false }, str(''))),
        attr('allUnsupported', array(...unsupported)),
        { key: 42, value: str('invalid key') },
        null,
      )),
      attr('gen_ai.tool.call.result', { bytesValue: 'c3ludGhldGlj' }),
    ]);
    expect(JSON.parse(trace.events[0].input!)).toEqual({ kept: 'synthetic', list: [0, false, ''], allUnsupported: [] });
    expect(trace.events[0].output).toBeUndefined();
    expect(trace.events[0].content).toBe('');
    expect(trace.usage).toBeUndefined();
  });

  it('omits nonfinite double values from objects and arrays', () => {
    const source = JSON.stringify(document([span([
      attr('gen_ai.input.messages', object(attr('bad', { doubleValue: 'NONFINITE' }), attr('kept', int(1)))),
      attr('gen_ai.output.messages', array({ doubleValue: 'NONFINITE' }, { doubleValue: 0.5 })),
    ])])).replaceAll('"NONFINITE"', '1e400');
    const event = parseTrace(source).events[0];
    expect(JSON.parse(event.input!)).toEqual({ kept: 1 });
    expect(JSON.parse(event.output!)).toEqual([0.5]);
  });

  it('retains serialized legacy aliases and span overrides of resource attributes', () => {
    const trace = parseTrace(JSON.stringify(document([span([
      attr('gen_ai.tool.input', str('{"query":"synthetic"}')),
      attr('gen_ai.tool.output', str('synthetic output')),
      attr('gen_ai.request.model', str('span-model')),
    ])], [attr('gen_ai.tool.name', str('synthetic_tool')), attr('gen_ai.request.model', str('resource-model'))])));
    expect(trace.events[0]).toMatchObject({ kind: 'tool', model: 'span-model', input: '{"query":"synthetic"}', output: 'synthetic output' });
    const legacy = read([attr('gen_ai.prompt', str('synthetic prompt')), attr('gen_ai.completion', str('synthetic completion'))]);
    expect(legacy.events[0]).toMatchObject({ input: 'synthetic prompt', output: 'synthetic completion' });
  });
});

describe('OTLP V2 cache-write aliases', () => {
  it.each([
    { label: 'current only', current: int('4'), legacy: undefined, expected: 4, conflict: false },
    { label: 'legacy only', current: undefined, legacy: int('3'), expected: 3, conflict: false },
    { label: 'current zero', current: int('0'), legacy: int('3'), expected: 0, conflict: true },
    { label: 'legacy zero', current: undefined, legacy: int(0), expected: 0, conflict: false },
    { label: 'equal aliases', current: int(4), legacy: int('4'), expected: 4, conflict: false },
    { label: 'conflicting aliases', current: int(4), legacy: int(3), expected: 4, conflict: true },
    { label: 'invalid current', current: int(null), legacy: int(3), expected: 3, conflict: false },
    { label: 'negative current', current: int(-1), legacy: int(3), expected: 3, conflict: false },
    { label: 'invalid legacy', current: int(4), legacy: int(true), expected: 4, conflict: false },
    { label: 'negative legacy', current: int(4), legacy: int(-1), expected: 4, conflict: false },
  ])('handles $label without adding aliases or caches to reported input', ({ current, legacy, expected, conflict }) => {
    const trace = read([
      attr('gen_ai.usage.input_tokens', int(10)),
      attr('gen_ai.usage.output_tokens', int(2)),
      attr('gen_ai.usage.cache_read.input_tokens', int(1)),
      attr(currentCache, current), attr(legacyCache, legacy),
    ]);
    const usage = { input: 10, output: 2, cacheRead: 1, cacheWrite: expected };
    expect(trace.events[0].usage).toEqual(usage);
    expect(trace.usage).toEqual(usage);
    expect(trace.warnings.includes(conflictWarning)).toBe(conflict);
  });

  it('distinguishes explicit zero cache-write usage from missing or invalid aliases', () => {
    expect(read([]).usage).toBeUndefined();
    expect(read([attr(currentCache, int(null)), attr(legacyCache, int(-1))]).usage).toBeUndefined();
    expect(read([attr(currentCache, int(0))]).usage).toEqual({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
    expect(read([attr(legacyCache, int('0'))]).usage).toEqual({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
  });

  it('keeps cache-only inference and validates cache subcounts against reported input', () => {
    expect(read([attr(currentCache, int(4)), attr('gen_ai.usage.cache_read.input_tokens', int(2))]).usage)
      .toEqual({ input: 6, output: 0, cacheRead: 2, cacheWrite: 4 });
    expect(() => read([attr('gen_ai.usage.input_tokens', int(1)), attr(currentCache, int(2))])).toThrow(/Invalid trace/);
  });

  it('sums parent/child and cross-trace reports without billing dedup and warns generically once', () => {
    const spans = ['synthetic-trace-a', 'synthetic-trace-b'].flatMap((traceId) => ['parent', 'child'].map((spanId) => span([
      attr('gen_ai.usage.input_tokens', int(100)),
      attr('gen_ai.usage.output_tokens', int(5)),
      attr('gen_ai.usage.cache_read.input_tokens', int(10)),
      attr(currentCache, int(23)), attr(legacyCache, int(17)),
    ], {
      traceId, spanId, parentSpanId: spanId === 'child' ? 'parent' : undefined,
      name: 'Synthetic private span name',
      startTimeUnixNano: '1767225600000000001', endTimeUnixNano: '1767225600000000101',
    })));
    const trace = parseTrace(JSON.stringify(document(spans)));
    expect(trace.events.map((event) => event.id)).toEqual([
      'synthetic-trace-a:parent', 'synthetic-trace-a:child', 'synthetic-trace-b:parent', 'synthetic-trace-b:child',
    ]);
    expect(trace.events.filter((event) => event.parentId).map((event) => event.parentId)).toEqual(['synthetic-trace-a:parent', 'synthetic-trace-b:parent']);
    expect(trace.events.every((event) => event.durationMs === 0.0001 && event.status === 'unknown')).toBe(true);
    expect(trace.events.map((event) => event.usage?.cacheWrite)).toEqual([23, 23, 23, 23]);
    expect(trace.usage).toEqual({ input: 400, output: 20, cacheRead: 40, cacheWrite: 92 });
    expect(trace.warnings).toEqual([
      conflictWarning,
      'OTLP JSON subset: resourceSpans/scopeSpans/spans and selected GenAI attributes only; not full OTLP or MCP support. Span token usage is summed as reported.',
    ]);
    expect(parseTrace(JSON.stringify(trace))).toEqual(trace);
  });
});

describe('OTLP V2 integer decoding', () => {
  it.each([
    null, true, false, '', ' ', '\t\n', ' 1', '1 ', '1\n', '-2\r', '1.0', '1.5', '1e2', '0x10', 'NaN', 'Infinity',
    [], {}, 1.5, Number.MAX_SAFE_INTEGER + 1, Number.MIN_SAFE_INTEGER - 1, '9007199254740992', '-9007199254740992',
  ].map((value) => ({ value })))('omits invalid intValue $value from general content and usage', ({ value }) => {
    const trace = read([
      attr('gen_ai.input.messages', object(attr('invalid', int(value)), attr('valid', int(2)))),
      attr('gen_ai.output.messages', array(int(value), int(3))),
      attr('gen_ai.tool.call.arguments', int(value)),
      attr('gen_ai.usage.input_tokens', int(value)),
      attr('gen_ai.usage.output_tokens', int(value)),
      attr('gen_ai.usage.cache_read.input_tokens', int(value)),
      attr(currentCache, int(value)), attr(legacyCache, int(value)),
    ]);
    expect(JSON.parse(trace.events[0].input!)).toEqual({ valid: 2 });
    expect(JSON.parse(trace.events[0].output!)).toEqual([3]);
    expect(trace.events[0].usage).toBeUndefined();
    expect(trace.usage).toBeUndefined();
    expect(trace.warnings).not.toContain(conflictWarning);
  });

  it.each([0, '0', 42, '42', Number.MAX_SAFE_INTEGER, '9007199254740991'])('accepts safe integer %j without string coercion in usage', (value) => {
    const trace = read([attr('gen_ai.tool.call.arguments', int(value)), attr('gen_ai.usage.input_tokens', int(value))]);
    expect(trace.events[0].input).toBe(String(Number(value)));
    expect(trace.usage).toEqual({ input: Number(value), output: 0, cacheRead: 0, cacheWrite: 0 });
  });

  it.each([-1, '-1', Number.MIN_SAFE_INTEGER, '-9007199254740991'])('preserves negative general attribute %j but filters negative usage', (value) => {
    const trace = read([
      attr('gen_ai.tool.call.arguments', int(value)),
      attr('gen_ai.tool.call.result', object(attr('offset', int(value)))),
      attr('gen_ai.usage.input_tokens', int(value)), attr('gen_ai.usage.output_tokens', int(value)),
      attr('gen_ai.usage.cache_read.input_tokens', int(value)), attr(currentCache, int(value)), attr(legacyCache, int(value)),
    ]);
    expect(trace.events[0].input).toBe(String(Number(value)));
    expect(JSON.parse(trace.events[0].output!)).toEqual({ offset: Number(value) });
    expect(trace.events[0].usage).toBeUndefined();
    expect(trace.usage).toBeUndefined();
  });
});