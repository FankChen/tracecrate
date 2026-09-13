import { diffArrays } from 'diff';
import type { TraceEvent } from './types';

export const MAX_COMPARE_EVENTS = 2000;
export const MAX_COMPARE_EDITS = 400;
export const COMPARE_TIMEOUT_MS = 200;
export type ComparisonScope = 'all' | 'tools';
export type EventChange = 'unchanged' | 'changed' | 'added' | 'removed';

export interface ComparisonRow {
  id: string;
  change: EventChange;
  left?: TraceEvent;
  right?: TraceEvent;
  /** Original zero-based event indexes, not indexes within tools-only scope. */
  leftIndex?: number;
  rightIndex?: number;
  changedFields: string[];
}

export interface EventComparison {
  rows: ComparisonRow[];
  counts: Record<EventChange, number>;
  leftCount: number;
  rightCount: number;
  unavailable?: 'size' | 'budget';
}

const fields = ['content', 'input', 'output', 'status', 'model', 'durationMs'] as const;
const usageFields = ['input', 'output', 'cacheRead', 'cacheWrite'] as const;

/** IDs/timestamps/parents are not cross-run identities; compare recorded fields only. */
function changedFields(left: TraceEvent, right: TraceEvent): string[] {
  const changed: string[] = fields.filter((field) => left[field] !== right[field]);
  if (usageFields.some((field) => left.usage?.[field] !== right.usage?.[field])) changed.push('usage');
  return changed;
}

/** Bounded name/kind sequence alignment. A match does not establish causal identity. */
export function compareEvents(left: readonly TraceEvent[], right: readonly TraceEvent[], scope: ComparisonScope = 'all'): EventComparison {
  const select = (events: readonly TraceEvent[]) => events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => scope !== 'tools' || event.kind === 'tool');
  const a = select(left);
  const b = select(right);
  const result: EventComparison = {
    rows: [], counts: { unchanged: 0, changed: 0, added: 0, removed: 0 },
    leftCount: a.length, rightCount: b.length,
  };
  if (a.length > MAX_COMPARE_EVENTS || b.length > MAX_COMPARE_EVENTS) return { ...result, unavailable: 'size' };
  const key = ({ event }: { event: TraceEvent }) => JSON.stringify([event.kind, event.name]);
  const changes = diffArrays(a.map(key), b.map(key), { maxEditLength: MAX_COMPARE_EDITS, timeout: COMPARE_TIMEOUT_MS });
  if (!changes) return { ...result, unavailable: 'budget' };
  let ai = 0;
  let bi = 0;
  for (const change of changes) {
    for (let i = 0; i < change.count; i++) {
      const av = change.added ? undefined : a[ai++];
      const bv = change.removed ? undefined : b[bi++];
      const changed = av && bv ? changedFields(av.event, bv.event) : [];
      const type: EventChange = change.added ? 'added' : change.removed ? 'removed' : changed.length ? 'changed' : 'unchanged';
      result.rows.push({
        id: `alignment-${result.rows.length + 1}`, change: type,
        left: av?.event, leftIndex: av?.index, right: bv?.event, rightIndex: bv?.index,
        changedFields: changed,
      });
      result.counts[type]++;
    }
  }
  return result;
}