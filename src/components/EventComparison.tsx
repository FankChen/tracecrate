import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, GitCompareArrows } from 'lucide-react';
import { compareEvents, MAX_COMPARE_EVENTS } from '../core/compare';
import type { ComparisonScope, EventChange } from '../core/compare';
import type { Trace, TraceEvent } from '../core/types';
import { clip, duration, number } from './format';

const PAGE_SIZE = 50;
const labels: Record<EventChange, string> = { unchanged: 'Unchanged', changed: 'Changed', added: 'Only in B', removed: 'Only in A' };
const fieldLabels: Record<string, string> = { content: 'Content', input: 'Input', output: 'Output', status: 'Status', model: 'Model', durationMs: 'Duration', usage: 'Tokens' };

interface Props {
  left: Trace;
  right: Trace;
  onInspect: (sessionId: string, eventId: string) => void;
}

export default function EventComparison({ left, right, onInspect }: Props) {
  const [scope, setScope] = useState<ComparisonScope>('all');
  const [differencesOnly, setDifferencesOnly] = useState(true);
  const [page, setPage] = useState(0);
  const comparison = useMemo(() => compareEvents(left.events, right.events, scope), [left, right, scope]);
  const rows = useMemo(() => comparison.rows.filter((row) => !differencesOnly || row.change !== 'unchanged'), [comparison, differencesOnly]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const cell = (event: TraceEvent | undefined, index: number | undefined, session: Trace, side: 'A' | 'B') => event && index !== undefined
    ? <button type="button" className="compare-event-link" aria-label={`Inspect session ${side} event ${index + 1}: ${clip(event.name, 100)}`} onClick={() => onInspect(session.id, event.id)}>
      <strong>{clip(event.name, 100)}</strong><small>#{index + 1} · {event.kind} · {event.status} · {duration(event.durationMs)}</small>
    </button>
    : <span className="muted">Not aligned</span>;

  return <section className="event-comparison" aria-label="Event sequence comparison">
    <div className="comparison-heading"><div><span className="eyebrow">FOLLOW THE DIFFERENCE</span><h3><GitCompareArrows size={18} aria-hidden="true" />Event-by-event comparison</h3></div><span className="feature-badge">V0.2</span></div>
    <p className="footnote">Aligned by exact event kind and name in recorded order. Repeated names can align ambiguously. Matches are not execution identities; IDs, parent links and absolute timestamps are not compared.</p>
    <div className="comparison-controls"><label>Compare<select aria-label="Comparison scope" value={scope} onChange={(event) => { setScope(event.target.value as ComparisonScope); setPage(0); }}><option value="all">All events</option><option value="tools">Tools only</option></select></label><label className="checkbox-label"><input type="checkbox" checked={differencesOnly} onChange={(event) => { setDifferencesOnly(event.target.checked); setPage(0); }} />Differences only</label></div>
    {comparison.unavailable ? <p className="warning comparison-limit" role="status">{comparison.unavailable === 'size'
      ? `Sequence comparison is limited to ${number(MAX_COMPARE_EVENTS)} events per side (selected: ${number(comparison.leftCount)} / ${number(comparison.rightCount)}). Try Tools only or a smaller trace.`
      : 'Sequence alignment exceeded its edit/time budget. Try Tools only or more similar traces.'} No partial diff is shown. Recorded metric comparison above is still available.</p>
      : <>
        <dl className="diff-summary">{(['changed', 'added', 'removed', 'unchanged'] as const).map((change) => <div key={change} className={`diff-${change}`}><dt>{labels[change]}</dt><dd>{number(comparison.counts[change])}</dd></div>)}</dl>
        {!!rows.length && <div className="table-wrap"><table className="sequence-table"><caption>Aligned events · inspect either original session</caption><thead><tr><th scope="col">Change</th><th scope="col">Session A</th><th scope="col">Session B</th><th scope="col">Changed fields</th></tr></thead><tbody>{rows.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map((row) => <tr key={row.id} data-testid="comparison-row"><th scope="row"><span className={`diff-label diff-${row.change}`}>{labels[row.change]}</span></th><td>{cell(row.left, row.leftIndex, left, 'A')}</td><td>{cell(row.right, row.rightIndex, right, 'B')}</td><td className="changed-fields">{row.changedFields.length ? row.changedFields.map((field) => <span key={field}>{fieldLabels[field]}</span>) : row.change === 'unchanged' ? 'No compared fields differ' : 'One-sided event'}</td></tr>)}</tbody></table></div>}
        {!rows.length && <p className="comparison-empty">{differencesOnly && comparison.rows.length ? 'No differences in compared fields. Uncheck Differences only to inspect aligned events.' : 'No events in this comparison scope.'}</p>}
        <div className="pagination"><span role="status">{number(rows.length)} alignment rows · page {currentPage + 1} of {pages} · max 50 per page</span><div><button type="button" aria-label="Previous comparison page" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={16} /></button><button type="button" aria-label="Next comparison page" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}><ChevronRight size={16} /></button></div></div>
      </>}
  </section>;
}