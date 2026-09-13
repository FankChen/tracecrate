import { describe, expect, it } from 'vitest';
import { compareEvents, MAX_COMPARE_EVENTS } from './compare';
import type { TraceEvent } from './types';

const event = (id: string, name = id, extra: Partial<TraceEvent> = {}): TraceEvent => ({
  id, kind: 'tool', name, content: '', status: 'unknown', ...extra,
});

describe('bounded event sequence comparison', () => {
  it('handles empty sequences and preserves zero counts', () => {
    expect(compareEvents([], [])).toEqual({ rows: [], counts: { unchanged: 0, changed: 0, added: 0, removed: 0 }, leftCount: 0, rightCount: 0 });
  });
  it('aligns inserted and removed events without shifting subsequent matches', () => {
    const a = [event('a'), event('b'), event('c')];
    const b = [event('x', 'a'), event('y', 'inserted'), event('z', 'c')];
    const result = compareEvents(a, b);
    expect(result.counts).toEqual({ unchanged: 2, changed: 0, added: 1, removed: 1 });
    expect(result.rows.flatMap((row) => row.left ? [row.left.id] : [])).toEqual(['a', 'b', 'c']);
    expect(result.rows.flatMap((row) => row.right ? [row.right.id] : [])).toEqual(['x', 'y', 'z']);
    expect(result.rows.at(-1)).toMatchObject({ leftIndex: 2, rightIndex: 2, change: 'unchanged' });
  });
  it('ignores run-local IDs, parents and absolute timestamp offsets', () => {
    const result = compareEvents([event('a', 'Read', { timestamp: 0, parentId: 'parent-a' })], [event('b', 'Read', { timestamp: 1000, parentId: 'parent-b' })]);
    expect(result.rows[0].change).toBe('unchanged');
    expect(result.rows[0].changedFields).toEqual([]);
  });
  it.each(['content', 'input', 'output', 'status', 'model', 'durationMs', 'usage'] as const)('identifies changes to %s', (field) => {
    const value = field === 'durationMs' ? 0 : field === 'usage'
      ? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } : field === 'status' ? 'ok' : 'new value';
    const result = compareEvents([event('a', 'Read')], [event('b', 'Read', { [field]: value })]);
    expect(result.rows[0]).toMatchObject({ change: 'changed', changedFields: [field] });
  });
  it('distinguishes missing and empty strings, but ignores usage property ordering', () => {
    expect(compareEvents([event('a')], [event('a', 'a', { input: '' })]).rows[0].change).toBe('changed');
    const usage = { input: 4, output: 0, cacheRead: 1, cacheWrite: 0 };
    expect(compareEvents([event('a', 'Read', { usage })], [event('b', 'Read', { usage: { output: 0, input: 4, cacheWrite: 0, cacheRead: 1 } })]).rows[0].change).toBe('unchanged');
  });
  it('matches exact kind and name, with no unsafe delimiter concatenation', () => {
    expect(compareEvents([event('a', 'tool:Read')], [event('b', 'Read')]).counts).toMatchObject({ added: 1, removed: 1, unchanged: 0 });
    expect(compareEvents([event('a', 'Read')], [event('b', 'Read', { kind: 'assistant' })]).counts).toMatchObject({ added: 1, removed: 1 });
    expect(compareEvents([event('a', 'Read')], [event('b', 'read')]).counts.unchanged).toBe(0);
  });
  it('retains original event indexes in tools-only scope', () => {
    const a = [event('a', 'Prompt', { kind: 'user' }), event('b', 'Read')];
    const b = [event('c', 'Read'), event('d', 'Answer', { kind: 'assistant' })];
    const result = compareEvents(a, b, 'tools');
    expect(result).toMatchObject({ leftCount: 1, rightCount: 1 });
    expect(result.rows[0]).toMatchObject({ leftIndex: 1, rightIndex: 0, change: 'unchanged' });
  });
  it('is deterministic for repeated names, without duplicating/dropping events', () => {
    const a = [event('a1', 'Read'), event('a2', 'Read'), event('a3', 'Write')];
    const b = [event('b1', 'Read'), event('b2', 'Write')];
    const result = compareEvents(a, b);
    expect(compareEvents(a, b)).toEqual(result);
    expect(result.rows.flatMap((row) => row.left ? [row.left.id] : [])).toEqual(a.map((e) => e.id));
    expect(result.rows.flatMap((row) => row.right ? [row.right.id] : [])).toEqual(b.map((e) => e.id));
  });
  it('refuses oversize input, never presenting a silently truncated result', () => {
    const a = Array.from({ length: MAX_COMPARE_EVENTS + 1 }, (_, i) => event(`e${i}`, 'Prompt', { kind: 'user' }));
    expect(compareEvents(a, [])).toMatchObject({ unavailable: 'size', rows: [], leftCount: MAX_COMPARE_EVENTS + 1 });
    expect(compareEvents(a, [], 'tools')).toMatchObject({ rows: [], leftCount: 0, rightCount: 0 });
  });
  it('aborts dissimilar sequences beyond the edit budget without inventing matches', () => {
    const a = Array.from({ length: 250 }, (_, i) => event(`a${i}`));
    const b = Array.from({ length: 250 }, (_, i) => event(`b${i}`));
    expect(compareEvents(a, b)).toMatchObject({ unavailable: 'budget', rows: [], leftCount: 250, rightCount: 250 });
  });
  it('compares 2,000 equal events without changing frozen source records', () => {
    const a = Object.freeze(Array.from({ length: MAX_COMPARE_EVENTS }, (_, i) => Object.freeze(event(`e${i}`, 'Read'))));
    expect(compareEvents(a, a).counts.unchanged).toBe(MAX_COMPARE_EVENTS);
    expect(a[0]).toEqual(event('e0', 'Read'));
  });
});