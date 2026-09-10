import { useMemo } from 'react';
import { ArrowUpRight, CircleAlert, Fingerprint, Terminal } from 'lucide-react';
import { getFindings, getToolBreakdown } from '../core/analysis';
import type { Trace } from '../core/types';
import { clip, duration, number } from './format';

export default function Insights({ trace, onSelect }: { trace: Trace; onSelect: (id: string) => void }) {
  const findings = useMemo(() => getFindings(trace), [trace]);
  const tools = useMemo(() => getToolBreakdown(trace), [trace]);
  const maxCalls = Math.max(1, ...tools.map((tool) => tool.calls));
  return <div className="insights-layout">
    <section><div className="section-title"><Fingerprint size={18} aria-hidden="true" /><h3>Signals in the sequence</h3><span className="count-badge">{findings.length}</span></div><p className="muted section-description">Deterministic observations, linked to recorded evidence. Not inferred intent or root causes.</p>
      <div className="finding-list">{findings.slice(0, 100).map((finding) => <article className="finding" key={finding.id}><CircleAlert size={18} aria-hidden="true" /><div><span className="eyebrow">{finding.severity === 'warning' ? 'Worth a look' : 'Observation'}</span><h4>{finding.title}</h4><p>{clip(finding.description, 800)}</p><div className="finding-links">{finding.eventIds.slice(0, 8).map((id, index) => <button type="button" key={id} onClick={() => onSelect(id)}>Inspect event {index + 1}<ArrowUpRight size={13} aria-hidden="true" /></button>)}{finding.eventIds.length > 8 && <span className="muted">+{finding.eventIds.length - 8} more occurrences</span>}</div></div></article>)}</div>
      {!findings.length && <div className="empty-inline"><Fingerprint size={26} aria-hidden="true" /><h3>No matching signals</h3><p>No configured finding rules matched. This does not establish that the run is correct or efficient.</p></div>}
      {findings.length > 100 && <p className="muted">Showing the first 100 findings. Use Timeline filters to inspect further events.</p>}
    </section>
    <section className="tool-breakdown"><div className="section-title"><Terminal size={18} aria-hidden="true" /><h3>Tool breakdown</h3></div><p className="muted section-description">Recorded calls, not estimated activity.</p>{tools.slice(0, 100).map((tool) => {
      const timed = trace.events.some((event) => event.kind === 'tool' && event.name === tool.name && event.durationMs !== undefined);
      return <button type="button" className="tool-breakdown-row" key={tool.name} onClick={() => onSelect(trace.events.find((event) => event.kind === 'tool' && event.name === tool.name)!.id)}><span className="tool-line"><strong>{clip(tool.name, 80)}</strong><span>{number(tool.calls)} calls</span></span><span className="tool-meter"><span style={{ width: `${tool.calls / maxCalls * 100}%` }} /></span><span className="tool-line muted"><span>{tool.errors} reported errors</span><span>{timed ? duration(tool.durationMs) : '—'} recorded</span></span></button>;
    })}{!tools.length && <p className="muted">No tool calls recorded.</p>}{tools.length > 100 && <p className="muted">First 100 tool names shown.</p>}<p className="footnote">Duration sums include only known values and may overlap. They are not wall-clock elapsed time.</p></section>
  </div>;
}