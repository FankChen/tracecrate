import { useMemo, useState } from 'react';
import { ArrowRight, GitCompareArrows, Info } from 'lucide-react';
import { getStats, getToolBreakdown } from '../core/analysis';
import type { Trace } from '../core/types';
import { clip, duration, number } from './format';

export default function Compare({ sessions }: { sessions: Trace[] }) {
  const [leftId, setLeftId] = useState(sessions[0]?.id ?? '');
  const [rightId, setRightId] = useState(sessions[1]?.id ?? '');
  const left = sessions.find((trace) => trace.id === leftId) ?? sessions[0];
  const right = sessions.find((trace) => trace.id === rightId) ?? sessions.find((trace) => trace.id !== left?.id);
  const a = useMemo(() => left ? getStats(left) : undefined, [left]);
  const b = useMemo(() => right ? getStats(right) : undefined, [right]);
  const at = useMemo(() => left ? getToolBreakdown(left) : [], [left]);
  const bt = useMemo(() => right ? getToolBreakdown(right) : [], [right]);
  if (!left || !right || !a || !b) return <div className="empty-inline"><GitCompareArrows size={28} aria-hidden="true" /><h3>Two runs. A clearer picture.</h3><p>Import a second session to compare recorded metrics side by side.</p></div>;
  const metrics = [
    { name: 'Reported tokens', a: a.usage ? a.usage.input + a.usage.output : undefined, b: b.usage ? b.usage.input + b.usage.output : undefined, format: number },
    { name: 'Tool calls', a: a.tools, b: b.tools, format: number },
    { name: 'Elapsed', a: a.durationMs, b: b.durationMs, format: duration },
    { name: 'Reported errors', a: a.errors, b: b.errors, format: number },
  ];
  const toolNames = [...new Set([...at.map((tool) => tool.name), ...bt.map((tool) => tool.name)])].sort();
  return <section className="compare-panel" aria-label="Session comparison">
    <div className="compare-selects"><label><span className="eyebrow">Session A</span><select aria-label="Session A" value={left.id} onChange={(event) => setLeftId(event.target.value)}>{sessions.map((trace) => <option key={trace.id} value={trace.id}>{clip(trace.name, 100)}{trace.demo ? ' (synthetic)' : ''}</option>)}</select></label><ArrowRight size={20} aria-hidden="true" /><label><span className="eyebrow">Session B</span><select aria-label="Session B" value={right.id} onChange={(event) => setRightId(event.target.value)}>{sessions.map((trace) => <option key={trace.id} value={trace.id}>{clip(trace.name, 100)}{trace.demo ? ' (synthetic)' : ''}</option>)}</select></label></div>
    <p className="comparison-notice"><Info size={16} aria-hidden="true" /><span><strong>Descriptive comparison, not a controlled benchmark.</strong>{(left.demo || right.demo) && <span> Synthetic demo pair: manufactured sequences, tokens, and timings. No speed or efficiency claim.</span>}{left.id === right.id && <span> You are comparing the same session.</span>}</span></p>
    <div className="table-wrap"><table><caption>Recorded metrics · difference is B − A</caption><thead><tr><th scope="col">Metric</th><th scope="col">Session A</th><th scope="col">Session B</th><th scope="col">Difference</th></tr></thead><tbody>{metrics.map((metric) => {
      const delta = metric.a !== undefined && metric.b !== undefined ? metric.b - metric.a : undefined;
      return <tr key={metric.name}><th scope="row">{metric.name}</th><td>{metric.format(metric.a)}</td><td>{metric.format(metric.b)}</td><td className="delta">{delta !== undefined && delta > 0 ? '+' : ''}{metric.format(delta)}</td></tr>;
    })}</tbody></table></div>
    <p className="footnote">Tokens are reported input + output; cached input is already included. Missing values remain unknown (—). Elapsed uses recorded timestamps and known ends.</p>
    <div className="table-wrap"><table><caption>Tool call counts</caption><thead><tr><th scope="col">Tool</th><th scope="col">Session A</th><th scope="col">Session B</th><th scope="col">Difference</th></tr></thead><tbody>{toolNames.slice(0, 100).map((name) => {
      const av = at.find((tool) => tool.name === name)?.calls ?? 0;
      const bv = bt.find((tool) => tool.name === name)?.calls ?? 0;
      return <tr key={name}><th scope="row" className="tool-name">{clip(name, 100)}</th><td>{number(av)}</td><td>{number(bv)}</td><td>{bv - av > 0 ? '+' : ''}{number(bv - av)}</td></tr>;
    })}</tbody></table></div>{!toolNames.length && <p className="muted">Neither session contains tool calls.</p>}{toolNames.length > 100 && <p className="footnote">First 100 tool names shown.</p>}
  </section>;
}