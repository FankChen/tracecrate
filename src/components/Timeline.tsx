import { useMemo, useRef, useState } from 'react';
import { ArrowDownLeft, Bot, Check, ChevronLeft, ChevronRight, Clock3, Search, Settings2, Terminal, User, X } from 'lucide-react';
import type { EventKind, Trace, TraceEvent } from '../core/types';
import { clip, duration, number } from './format';

const icons = { user: User, assistant: Bot, tool: Terminal, system: Settings2 };
const PAGE_SIZE = 100;
const DETAIL_LIMIT = 50000;

interface Props {
  trace: Trace;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export default function Timeline({ trace, selectedId, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<EventKind | 'all'>('all');
  const [page, setPage] = useState(() => Math.floor(Math.max(0, trace.events.findIndex((event) => event.id === selectedId)) / PAGE_SIZE));
  const detail = useRef<HTMLElement>(null);
  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return trace.events.filter((event) => (kind === 'all' || event.kind === kind) &&
      (!query || [event.name, event.content, event.input, event.output].some((text) => text?.toLowerCase().includes(query))));
  }, [trace, search, kind]);
  const selected = trace.events.find((event) => event.id === selectedId);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const maxDuration = useMemo(() => trace.events.reduce((max, event) => Math.max(max, event.durationMs ?? 0), 1), [trace]);
  const start = useMemo(() => trace.events.reduce<number | undefined>((min, event) => event.timestamp === undefined ? min : Math.min(min ?? event.timestamp, event.timestamp), undefined), [trace]);
  const choose = (event: TraceEvent) => {
    onSelect(event.id);
    if (window.matchMedia('(max-width: 1000px)').matches) requestAnimationFrame(() => detail.current?.focus());
  };
  let remaining = DETAIL_LIMIT;
  let truncated = false;
  const fields = selected ? [
    ['Content', selected.content], ['Tool input', selected.input], ['Tool output', selected.output],
    ['Metadata', JSON.stringify({ id: selected.id, parentId: selected.parentId, kind: selected.kind, status: selected.status, model: selected.model, timestamp: selected.timestamp, durationMs: selected.durationMs, usage: selected.usage }, null, 2)],
  ].flatMap(([label, value]) => {
    if (value === undefined) return [];
    const shown = value.slice(0, remaining);
    if (value.length > remaining) truncated = true;
    remaining -= shown.length;
    return [{ label, text: shown }];
  }) : [];

  return <div className={`timeline-layout ${selected ? 'has-detail' : ''}`}>
    <section className="timeline-list" aria-label="Event timeline">
      <div className="filterbar">
        <div className="search-field"><Search size={16} aria-hidden="true" /><label className="sr-only" htmlFor="trace-search">Search events</label><input id="trace-search" type="search" placeholder="Search events, tools, or content…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} /><kbd aria-hidden="true">⌕</kbd></div>
        <label className="kind-filter"><Settings2 size={14} aria-hidden="true" /><span className="sr-only">Event kind</span><select aria-label="Event kind" value={kind} onChange={(event) => { setKind(event.target.value as EventKind | 'all'); setPage(0); }}><option value="all">All events</option><option value="tool">Tool</option><option value="assistant">Assistant</option><option value="user">User</option><option value="system">System</option></select></label>
      </div>
      <div className="timeline-columns"><span>EVENT / RECORDED ORDER</span><span>RELATIVE TIME</span></div>
      <div className="event-rows">
        {filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map((event) => {
          const Icon = icons[event.kind];
          return <button type="button" key={event.id} data-testid="event-row" data-event-id={event.id} aria-pressed={selectedId === event.id} className={`event-row kind-${event.kind} ${selectedId === event.id ? 'selected' : ''} ${event.status === 'error' ? 'event-error' : ''}`} onClick={() => choose(event)}>
            <span className={`event-icon ${event.kind}`}><Icon size={16} aria-hidden="true" /></span>
            <span className="event-copy"><span className="event-title">{clip(event.name, 100)} <span className={`event-label ${event.kind}`}>{event.kind}</span>{event.status === 'error' && <span className="error-label">Error</span>}</span><span className="event-snippet">{clip(event.content || event.input || event.output || 'No content recorded', 120)}</span></span>
            <span className="event-timing"><span>{event.timestamp !== undefined && start !== undefined ? `+${duration(event.timestamp - start)}` : '—'}</span><span className="duration-track" aria-hidden="true">{event.durationMs !== undefined && <span style={{ width: `${Math.max(2, event.durationMs / maxDuration * 100)}%` }} />}</span><span className="duration-value">{duration(event.durationMs)}</span></span>
            <ChevronRight className="row-chevron" size={14} aria-hidden="true" />
          </button>;
        })}
        {!filtered.length && <div className="empty-inline"><Search size={24} aria-hidden="true" /><h3>No matching events</h3><p>Try another search or event kind.</p><button type="button" onClick={() => { setSearch(''); setKind('all'); setPage(0); }}>Clear filters</button></div>}
      </div>
      <div className="pagination"><span role="status">{number(filtered.length)} events · page {currentPage + 1} of {pages} · max 100 per page</span><div><button type="button" aria-label="Previous page" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={16} /></button><button type="button" aria-label="Next page" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}><ChevronRight size={16} /></button></div></div>
    </section>
    <aside className="event-detail" aria-label="Event details" tabIndex={-1} ref={detail}>
      <div className="detail-top"><span><ArrowDownLeft size={15} aria-hidden="true" /> EVENT INSPECTOR</span>{selected && <button type="button" className="icon-button" aria-label="Close event details" onClick={() => onSelect(null)}><X size={16} /></button>}</div>
      {selected ? <>
        <div className="detail-heading"><span className={`event-label ${selected.kind}`}>{selected.kind}</span><h3>{clip(selected.name, 200)}</h3><div className="detail-status"><span className={selected.status === 'error' ? 'text-error' : ''}>{selected.status === 'ok' ? <Check size={13} aria-hidden="true" /> : null}{selected.status === 'unknown' ? 'Status unknown' : selected.status === 'error' ? 'Reported error' : 'Reported OK'}</span><span><Clock3 size={13} aria-hidden="true" /> {duration(selected.durationMs)}</span></div></div>
        {truncated && <p className="warning detail-warning" role="status">Detail text truncated to 50,000 characters across all fields. Remaining content is not rendered.</p>}
        <div className="detail-fields">{fields.map((field) => <section key={field.label}><h4>{field.label}</h4><pre tabIndex={0}>{field.text || (truncated ? '[Omitted: detail limit reached]' : '(empty)')}</pre></section>)}</div>
      </> : <div className="inspector-empty"><Terminal size={28} aria-hidden="true" /><h3>Follow the details.</h3><p>Select an event to inspect its recorded input, output, and metadata.</p><span>Nothing executed. Just evidence.</span></div>}
    </aside>
  </div>;
}