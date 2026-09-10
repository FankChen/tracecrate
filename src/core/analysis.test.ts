import { describe, expect, it } from 'vitest';
import { getFindings, getStats, getToolBreakdown } from './analysis';
import type { Trace, TraceEvent } from './types';

const event = (extra: Partial<TraceEvent> = {}): TraceEvent => ({
  id: 'a', kind: 'tool', name: 'shell', content: '', status: 'ok', ...extra,
});
const trace = (events: TraceEvent[] = []): Trace => ({
  schemaVersion: 1, id: 'run', name: 'Run', source: 'test', warnings: [], events,
});
const usage = { input: 100, output: 10, cacheRead: 60, cacheWrite: 20 };

describe('getStats', () => {
  it('keeps absent usage and duration unknown, but counts empty traces', () => {
    expect(getStats(trace())).toEqual({ events: 0, tools: 0, errors: 0, models: [] });
  });
  it('sums event usage without adding cache subsets to input', () => {
    const run = trace([event({ usage }), event({ usage, model: 'z' }), event({ model: 'a', status: 'error' })]);
    expect(getStats(run)).toMatchObject({
      events: 3, tools: 3, errors: 1, models: ['a', 'z'],
      usage: { input: 200, output: 20, cacheRead: 120, cacheWrite: 40 },
    });
  });
  it('uses cumulative trace usage instead of summing it with events, including zeros', () => {
    const run = { ...trace([event({ usage })]), usage: { ...usage } };
    expect(getStats(run).usage).toEqual(usage);
    run.usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
    expect(getStats(run).usage).toEqual(run.usage);
    expect(getStats(run).usage).not.toBe(run.usage);
    expect(getStats(trace([event({ usage: run.usage })])).usage).toEqual(run.usage);
  });
  it('does not invent wall time from unanchored durations or a lone timestamp', () => {
    expect(getStats(trace([event({ durationMs: 80 }), event({ durationMs: 90 })])).durationMs).toBeUndefined();
    expect(getStats(trace([event({ timestamp: 0 })])).durationMs).toBeUndefined();
    expect(getStats(trace([event({ timestamp: NaN, durationMs: 40 })])).durationMs).toBeUndefined();
  });
  it('uses real temporal bounds, known ends, and zero, without summing overlaps', () => {
    expect(getStats(trace([event({ timestamp: 100 }), event({ timestamp: 0 })])).durationMs).toBe(100);
    expect(getStats(trace([event({ timestamp: 0, durationMs: 100 }), event({ timestamp: 10, durationMs: 100 })])).durationMs).toBe(110);
    expect(getStats(trace([event({ timestamp: 0, durationMs: 0 })])).durationMs).toBe(0);
    expect(getStats(trace([event({ timestamp: 0 }), event({ timestamp: 0 })])).durationMs).toBe(0);
  });
});

describe('getFindings', () => {
  it('requires three EXACT name/input matches, without parsing or normalizing input', () => {
    const run = trace([
      event({ id: '1', input: '{"x":1}' }), event({ id: '2', input: '{"x":1}' }),
      event({ id: '3', input: '{ "x": 1 }' }), event({ id: '4', name: 'Shell', input: '{"x":1}' }),
    ]);
    expect(getFindings(run)).toEqual([]);
    run.events.push(event({ id: '5', input: '{"x":1}' }));
    const findings = getFindings(run);
    expect(findings).toHaveLength(1);
    expect(findings[0].eventIds).toEqual(['1', '2', '5']);
    expect(findings[0].description).toContain('does not establish retries');
    expect(getFindings(run)).toEqual(findings);
  });
  it('distinguishes missing input from explicit empty input', () => {
    expect(getFindings(trace([event(), event(), event()]))).toEqual([]);
    expect(getFindings(trace([event({ input: '' }), event({ input: '' }), event({ input: '' })]))).toHaveLength(1);
  });
  it('uses inclusive thresholds and tool-only error/duration warnings', () => {
    const run = trace([
      event({ id: '1', durationMs: 9_999, output: 'x'.repeat(11_999) }),
      event({ id: '2', status: 'error', durationMs: 10_000, output: 'x'.repeat(12_000) }),
      event({ id: '3', kind: 'user', status: 'error', durationMs: 20_000, content: 'x'.repeat(12_000) }),
    ]);
    const findings = getFindings(run);
    expect(findings).toHaveLength(3);
    expect(findings.every((finding) => finding.eventIds[0] === '2')).toBe(true);
    expect(new Set(findings.map((finding) => finding.id)).size).toBe(3);
  });
  it('checks assistant output represented as content', () => {
    expect(getFindings(trace([event({ kind: 'assistant', content: 'x'.repeat(12_000) })]))).toHaveLength(1);
  });
});

describe('getToolBreakdown', () => {
  it('groups exact names, sorts counts then names, and sums durations, not wall time', () => {
    const run = trace([
      event({ name: 'b', durationMs: 100, timestamp: 0 }),
      event({ name: 'a', durationMs: 40 }),
      event({ name: 'b', durationMs: 100, timestamp: 10, status: 'error' }),
      event({ name: 'c', durationMs: -5 }),
      event({ name: 'b', kind: 'assistant', durationMs: 900 }),
    ]);
    const before = structuredClone(run);
    expect(getToolBreakdown(run)).toEqual([
      { name: 'b', calls: 2, errors: 1, durationMs: 200 },
      { name: 'a', calls: 1, errors: 0, durationMs: 40 },
      { name: 'c', calls: 1, errors: 0, durationMs: 0 },
    ]);
    getStats(run);
    getFindings(run);
    expect(run).toEqual(before);
  });
});