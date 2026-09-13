import type { EventKind, EventStatus, TraceEvent } from './types';

export interface EventQuery {
  search?: string;
  kind?: EventKind | 'all';
  status?: EventStatus | 'all';
  minDurationMs?: number;
  order?: 'recorded' | 'longest';
}

/** Literal local search; no regex execution, source mutation or missing-as-zero. */
export function filterEvents(events: readonly TraceEvent[], query: EventQuery = {}): TraceEvent[] {
  const search = query.search?.toLowerCase() ?? '';
  const minimum = query.minDurationMs !== undefined && Number.isFinite(query.minDurationMs) && query.minDurationMs >= 0
    ? query.minDurationMs : undefined;
  const filtered = events.filter((event) =>
    (!query.kind || query.kind === 'all' || event.kind === query.kind) &&
    (!query.status || query.status === 'all' || event.status === query.status) &&
    (minimum === undefined || (event.durationMs !== undefined && event.durationMs >= minimum)) &&
    (!search || [event.name, event.content, event.input, event.output, event.id, event.parentId, event.model]
      .some((text) => text?.toLowerCase().includes(search))),
  );
  if (query.order === 'longest') filtered.sort((a, b) => {
    if (a.durationMs === undefined) return b.durationMs === undefined ? 0 : 1;
    if (b.durationMs === undefined) return -1;
    return b.durationMs - a.durationMs;
  });
  return filtered;
}