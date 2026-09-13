import { describe, expect, it } from 'vitest';
import { getStats, getToolBreakdown } from './analysis';
import { exportTraceHtml, exportTraceJson, redactTrace } from './export';
import { parseTrace } from './import';
import type { ExportOptions, RedactionMode } from './export';
import type { Trace } from './types';

const zero = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
const usage = { input: 20, output: 3, cacheRead: 5, cacheWrite: 2 };
const policies: ExportOptions[] = [
  { omitTiming: false, omitUsage: false },
  { omitTiming: true, omitUsage: false },
  { omitTiming: false, omitUsage: true },
  { omitTiming: true, omitUsage: true },
];
const exporters = [redactTrace, exportTraceJson, exportTraceHtml];

function fixture(): Trace {
  return {
    schemaVersion: 1, id: 'private-run', name: 'private-name', source: 'private-source',
    warnings: ['private-warning'], demo: false, usage: { ...usage },
    events: [
      { id: 'private-user', kind: 'user', name: 'private', content: 'private-content', status: 'ok', timestamp: 0, durationMs: 0, usage: { ...zero } },
      { id: 'private-tool', parentId: 'private-user', kind: 'tool', name: 'private', content: 'private-content', status: 'error', timestamp: 10, durationMs: 0, usage: { ...usage } },
      { id: 'private-assistant', parentId: 'private-tool', kind: 'assistant', name: 'private', content: 'private-content', status: 'unknown', timestamp: 20, durationMs: 5, usage: { ...usage } },
      { id: 'private-system', parentId: 'private-assistant', kind: 'system', name: 'private', content: 'private-content', status: 'ok', timestamp: 30, durationMs: 2, usage: { ...zero } },
      { id: 'private-unknown', parentId: 'private-external', kind: 'tool', name: 'private', content: '', status: 'unknown' },
    ],
  };
}

function expectMetric(html: string, label: string, value: number | undefined) {
  expect(html).toContain(`<span>${label}</span><strong>${value === undefined ? 'Unknown' : value}</strong>`);
}

describe.each(policies)('structure metadata policy %j', (options) => {
  it('uses absence on every event kind, retains zero when allowed, and preserves structure through reimport', () => {
    const run = fixture();
    const shared = redactTrace(run, 'structure', options);
    const json = exportTraceJson(run, 'structure', options);
    // The dialog uses this same serializer, truncating only the visible text.
    expect(json).toBe(JSON.stringify(shared, null, 2));
    expect(parseTrace(json)).toEqual(shared);
    expect(shared.schemaVersion).toBe(1);
    expect(shared.demo).toBe(false);
    expect(shared.events.map(({ kind, status }) => ({ kind, status }))).toEqual(
      run.events.map(({ kind, status }) => ({ kind, status })),
    );
    expect(shared.events.map(({ id }) => id)).toEqual(['event-1', 'event-2', 'event-3', 'event-4', 'event-5']);
    expect(shared.events.map(({ parentId }) => parentId)).toEqual([undefined, 'event-1', 'event-2', 'event-3', undefined]);
    expect(shared.events[4]).not.toHaveProperty('parentId');
    for (const [index, event] of shared.events.entries()) {
      for (const key of ['timestamp', 'durationMs', 'usage'] as const) {
        const omitted = key === 'usage' ? options.omitUsage : options.omitTiming;
        if (omitted || run.events[index][key] === undefined) expect(event).not.toHaveProperty(key);
        else expect(event[key]).toEqual(run.events[index][key]);
      }
    }
    if (options.omitUsage) expect(shared).not.toHaveProperty('usage');
    else expect(shared.usage).toEqual(usage);
    const stats = getStats(shared);
    expect(stats).toMatchObject({ events: 5, tools: 2, errors: 1, models: [] });
    expect(stats.durationMs).toBe(options.omitTiming ? undefined : 32);
    expect(stats.usage).toEqual(options.omitUsage ? undefined : usage);
  });

  it('does not mutate the trace or options or share mutable output references', () => {
    const run = fixture();
    const before = structuredClone(run);
    const policy = Object.freeze({ ...options });
    const shared = redactTrace(run, 'structure', policy);
    exportTraceJson(run, 'structure', policy);
    exportTraceHtml(run, 'structure', policy);
    expect(run).toEqual(before);
    expect(policy).toEqual(options);
    shared.events[0].status = 'error';
    shared.events.push({ ...shared.events[0], id: 'new-event' });
    shared.warnings.push('changed');
    if (shared.usage) shared.usage.input = 999;
    if (shared.events[0].usage) shared.events[0].usage.input = 999;
    expect(run).toEqual(before);
  });

  it('keeps the strict allowlist and uses fixed, accurate policy warnings', () => {
    const run = fixture();
    Object.assign(run, { metadata: { timestamp: 999, usage, secret: 'private-extra' } });
    Object.assign(run.usage!, { secret: 'private-extra' });
    for (const event of run.events) Object.assign(event, {
      input: 'private-input', output: 'private-output', model: 'private-model',
      metadata: { durationMs: 999, usage }, extra: 'private-extra',
    });
    const shared = redactTrace(run, 'structure', options);
    expect(JSON.stringify(shared)).not.toContain('private');
    expect(Object.keys(shared).sort()).toEqual([
      'schemaVersion', 'id', 'name', 'source', 'events', 'warnings', 'demo',
      ...(options.omitUsage ? [] : ['usage']),
    ].sort());
    for (const event of shared.events) {
      expect(Object.keys(event).every((key) => [
        'id', 'parentId', 'kind', 'name', 'content', 'status',
        ...(options.omitTiming ? [] : ['timestamp', 'durationMs']),
        ...(options.omitUsage ? [] : ['usage']),
      ].includes(key))).toBe(true);
    }
    expect(shared.warnings).toEqual(options.omitTiming || options.omitUsage ? [
      'Content removed. Event counts, kinds, statuses, order, remapped relationships and demo flag retained. Remaining metadata may still be sensitive. Review before sharing.',
      options.omitTiming ? 'Timing metadata omitted from every event.' : 'Recorded timing metadata retained when present.',
      options.omitUsage ? 'Token usage omitted from events and trace.' : 'Recorded token usage retained when present.',
    ] : ['Content removed. Metrics and event structure retained.']);
  });

  it('renders matching script-free HTML metrics, omitted details and unknown tool timing', () => {
    const run = fixture();
    const attack = '</script><img src="https://evil.example/x" onerror="alert(1)"><script>alert(2)</script>';
    Object.assign(run.events[0], { content: attack, name: attack, input: attack, output: attack, model: attack });
    run.warnings.push(attack);
    const html = exportTraceHtml(run, 'structure', options);
    const shared = parseTrace(exportTraceJson(run, 'structure', options));
    const stats = getStats(shared);
    for (const [label, value] of [
      ['Events', stats.events], ['Tool calls', stats.tools], ['Errors', stats.errors],
      ['Elapsed (ms)', stats.durationMs], ['Input tokens', stats.usage?.input],
      ['Output tokens', stats.usage?.output], ['Cache read (included)', stats.usage?.cacheRead],
      ['Cache write (included)', stats.usage?.cacheWrite],
    ] as const) expectMetric(html, label, value);
    for (const tool of getToolBreakdown(shared)) {
      expect(html).toContain(`<th scope="row">${tool.name}</th><td>${tool.calls}</td><td>${tool.errors}</td><td>${tool.durationMs ?? 'Unknown'}</td>`);
    }
    expect(html).toContain('<th scope="row">Tool 2</th><td>1</td><td>0</td><td>Unknown</td>');
    expect(html.includes('<h3>Timestamp (ms)</h3>')).toBe(!options.omitTiming);
    expect(html.includes('<h3>Duration (ms)</h3>')).toBe(!options.omitTiming);
    expect(html.includes('<h3>Usage (input includes cache)</h3>')).toBe(!options.omitUsage);
    expect(html).toContain('href="#event-1"');
    expect(html).toContain('Sums include only known durations and may be partial.');
    expect(html).toContain("default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'");
    expect(html).not.toMatch(/<\/?script\b|<img\b|<iframe\b|<link\b|<object\b|<embed\b|<svg\b/i);
    expect(html).not.toMatch(/\s(?:src|href)=["']https?:|url\(|@import/i);
    expect(html).not.toContain('alert(1)');
    expect(html).not.toContain('private');
    for (const warning of shared.warnings) expect(html).toContain(warning);
  });
});

describe('export policy compatibility and rejection', () => {
  it.each<RedactionMode>(['structure', 'patterns'])('preserves %s defaults with empty or false options', (mode) => {
    const run = fixture();
    for (const exportFn of exporters) {
      expect(exportFn(run, mode, {})).toEqual(exportFn(run, mode));
      expect(exportFn(run, mode, policies[0])).toEqual(exportFn(run, mode));
      expect(exportFn(run)).toEqual(exportFn(run, 'structure'));
    }
  });

  it.each([{ omitTiming: true }, { omitUsage: true }, { omitTiming: true, omitUsage: true }])(
    'fails closed for pattern mode with %j in all export entry points', (options) => {
      const run = fixture();
      run.events[0].content = 'timestamp=123 durationMs=456 input tokens=789';
      const before = structuredClone(run);
      for (const exportFn of exporters) expect(() => exportFn(run, 'patterns', options)).toThrow(
        'Metadata minimization requires structure-only mode. Preserved free text may contain timing and token usage.',
      );
      expect(run).toEqual(before);
    },
  );

  it('renders zero elapsed and usage as zero, not Unknown, when recorded and retained', () => {
    const run = fixture();
    run.events = [{ ...run.events[1], timestamp: 0, durationMs: 0 }];
    run.usage = { ...zero };
    const html = exportTraceHtml(run);
    expectMetric(html, 'Elapsed (ms)', 0);
    expectMetric(html, 'Input tokens', 0);
    expectMetric(html, 'Output tokens', 0);
    expect(html).toContain('<th scope="row">Tool 1</th><td>1</td><td>1</td><td>0</td>');
  });

  it('renders partial known tool duration sums in pattern HTML without counting unknown calls as timed', () => {
    const run = fixture();
    run.events = [
      { ...run.events[1], name: 'shell', durationMs: 12 },
      { ...run.events[4], name: 'shell' },
    ];
    expect(exportTraceHtml(run, 'patterns')).toContain('<th scope="row">shell</th><td>2</td><td>1</td><td>12</td>');
  });
});