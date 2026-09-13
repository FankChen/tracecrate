import { describe, expect, it } from 'vitest';
import { filterEvents } from './query';
import type { TraceEvent } from './types';

const events: TraceEvent[] = [
  { id: 'e1', kind: 'user', name: 'Prompt', content: 'SYNTHETIC [query]', status: 'ok' },
  { id: 'e2', parentId: 'e1', kind: 'tool', name: 'Search', content: '', input: 'synthetic', output: 'no result', status: 'error', durationMs: 0 },
  { id: 'e3', kind: 'tool', name: 'Search', content: '', model: 'test-model', status: 'unknown', durationMs: 10000 },
  { id: 'e4', kind: 'assistant', name: 'Answer', content: 'synthetic', status: 'ok', durationMs: 10000 },
  { id: 'e5', kind: 'tool', name: 'Read', content: '', status: 'error', durationMs: 500 },
];
const ids = (value: TraceEvent[]) => value.map((event) => event.id);

describe('local event queries', () => {
  it('defaults to recorded order and does not mutate even frozen inputs', () => {
    const frozen = Object.freeze(events.map((event) => Object.freeze({ ...event })));
    expect(ids(filterEvents(frozen))).toEqual(['e1', 'e2', 'e3', 'e4', 'e5']);
    expect(ids(filterEvents(frozen, { order: 'longest' }))).toEqual(['e3', 'e4', 'e5', 'e2', 'e1']);
    expect(ids([...frozen])).toEqual(['e1', 'e2', 'e3', 'e4', 'e5']);
  });
  it('combines kind, status, duration and search with AND', () => {
    expect(ids(filterEvents(events, { kind: 'tool', status: 'error', minDurationMs: 0, search: 'SYNTHETIC' }))).toEqual(['e2']);
    expect(filterEvents(events, { kind: 'tool', status: 'error', minDurationMs: 1, search: 'synthetic' })).toEqual([]);
  });
  it('distinguishes a recorded zero from unknown duration', () => {
    expect(ids(filterEvents(events, { minDurationMs: 0 }))).toEqual(['e2', 'e3', 'e4', 'e5']);
    expect(ids(filterEvents(events, { minDurationMs: 10000 }))).toEqual(['e3', 'e4']);
    expect(ids(filterEvents(events, { minDurationMs: 10000.1 }))).toEqual([]);
  });
  it.each([-1, NaN, Infinity])('ignores invalid internal minimum %s', (minimum) => {
    expect(filterEvents(events, { minDurationMs: minimum })).toEqual(events);
  });
  it.each([
    ['[query]', ['e1']], ['NO RESULT', ['e2']], ['test-model', ['e3']], ['e1', ['e1', 'e2']], ['.*', []],
  ])('searches literal text, metadata and payloads: %s', (search, expected) => {
    expect(ids(filterEvents(events, { search: search as string }))).toEqual(expected);
  });
  it('keeps equal-duration and unknown-duration events in recorded order', () => {
    expect(ids(filterEvents([...events, { ...events[0], id: 'e6' }], { order: 'longest' })))
      .toEqual(['e3', 'e4', 'e5', 'e2', 'e1', 'e6']);
  });
  it('filters explicit unknown status without interpreting error prose', () => {
    expect(ids(filterEvents(events, { status: 'unknown' }))).toEqual(['e3']);
    expect(filterEvents([], { status: 'error' })).toEqual([]);
  });
});