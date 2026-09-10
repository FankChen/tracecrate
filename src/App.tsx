import { useMemo, useRef, useState } from 'react';
import { Activity, ArrowDownToLine, ArrowUpRight, Box, Braces, Check, ChevronRight, CircleAlert, Clock3, FileJson, Fingerprint, FlaskConical, GitCompareArrows, Layers3, LockKeyhole, Plus, RotateCcw, ShieldCheck, Terminal, Trash2, Upload } from 'lucide-react';
import { getStats } from './core/analysis';
import type { Trace } from './core/types';
import { createDemoSessions } from './demo';
import Timeline from './components/Timeline';
import Insights from './components/Insights';
import Compare from './components/Compare';
import ExportDialog from './components/ExportDialog';
import { useTraceImport } from './components/useTraceImport';
import { clip, duration, number } from './components/format';
import './App.css';

const tabs = [{ id: 'timeline', label: 'Timeline', icon: Activity }, { id: 'insights', label: 'Insights', icon: Fingerprint }, { id: 'compare', label: 'Compare', icon: GitCompareArrows }] as const;
type Tab = typeof tabs[number]['id'];

export default function App() {
  const [sessions, setSessions] = useState<Trace[]>(createDemoSessions);
  const [activeId, setActiveId] = useState('demo-baseline');
  const [selectedId, setSelectedId] = useState<string | null>('demo-baseline-3');
  const [tab, setTab] = useState<Tab>('timeline');
  const [exportOpen, setExportOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const inputGeneration = useRef(0);
  const dragDepth = useRef(0);
  const trace = sessions.find((session) => session.id === activeId) ?? sessions[0];
  const stats = useMemo(() => trace ? getStats(trace) : undefined, [trace]);
  const { busy, notice, importFiles, reset: resetImport } = useTraceImport((loaded) => {
    setSessions((previous) => [...previous, ...loaded]);
    setActiveId(loaded[0].id);
    setSelectedId(null);
    setTab('timeline');
  });
  const selectSession = (id: string) => { setActiveId(id); setSelectedId(null); setExportOpen(false); };
  const clear = () => {
    inputGeneration.current++;
    resetImport();
    setSessions([]); setActiveId(''); setSelectedId(null); setExportOpen(false); setTab('timeline'); setEpoch((value) => value + 1);
    setDragging(false); dragDepth.current = 0;
    if (input.current) input.current.value = '';
  };
  const loadDemo = () => {
    if (busy || sessions.some((session) => session.demo) || sessions.length > 8) return;
    const demos = createDemoSessions();
    setSessions((previous) => [...previous, ...demos]); setActiveId(demos[0].id); setSelectedId(demos[0].events[2].id); setTab('timeline');
  };
  const acceptFiles = async (files: File[]) => {
    const generation = ++inputGeneration.current;
    try { await importFiles(files, sessions.length); }
    finally { if (generation === inputGeneration.current && input.current) input.current.value = ''; }
  };
  const showEvent = (id: string) => { setSelectedId(id); setTab('timeline'); };
  const metrics = stats ? [
    { label: 'Reported tokens', value: number(stats.usage ? stats.usage.input + stats.usage.output : undefined), caption: stats.usage ? `${number(stats.usage.input)} in · ${number(stats.usage.output)} out` : 'Not present in this trace', icon: Braces, className: 'mint' },
    { label: 'Tool calls', value: number(stats.tools), caption: 'Observed in the sequence', icon: Terminal, className: 'purple' },
    { label: 'Elapsed time', value: duration(stats.durationMs), caption: stats.durationMs === undefined ? 'No usable timing recorded' : 'Recorded timestamps + ends', icon: Clock3, className: 'blue' },
    { label: 'Reported errors', value: number(stats.errors), caption: 'Explicit event error statuses', icon: CircleAlert, className: stats.errors ? 'amber' : 'mint' },
  ] : [];

  return <div className={`app-shell ${dragging ? 'is-dragging' : ''}`} onDragEnter={(event) => { event.preventDefault(); if (event.dataTransfer.types.includes('Files')) { dragDepth.current++; setDragging(true); } }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = busy ? 'none' : 'copy'; }} onDragLeave={(event) => { event.preventDefault(); dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); dragDepth.current = 0; void acceptFiles(Array.from(event.dataTransfer.files)); }}>
    <a href="#main-content" className="skip-link">Skip to workspace</a>
    <aside className="sidebar" aria-label="Sessions sidebar">
      <a className="brand" href="#main-content" aria-label="TraceCrate workspace"><span className="brand-mark"><Box size={23} strokeWidth={1.7} aria-hidden="true" /></span><span>Trace<span className="brand-light">Crate</span><span className="brand-dot">.</span></span></a>
      <div className="workspace-label"><span className="workspace-icon"><Layers3 size={15} aria-hidden="true" /></span><span>Local workspace<small>Only on this device</small></span><LockKeyhole size={12} aria-hidden="true" /></div>
      <button type="button" className="import-button" disabled={busy || sessions.length >= 10} onClick={() => input.current?.click()}><Plus size={17} aria-hidden="true" />Import trace<span>↗</span></button>
      <div className="sessions-heading"><h2>SESSIONS</h2><span>{sessions.length.toString().padStart(2, '0')}</span></div>
      <nav className="sessions" aria-label="Loaded sessions">{sessions.map((session) => <button type="button" key={session.id} className={`session-button ${session.id === trace?.id ? 'active' : ''}`} aria-current={session.id === trace?.id ? 'true' : undefined} onClick={() => selectSession(session.id)}><FileJson size={17} aria-hidden="true" /><span><strong>{clip(session.name, 64)}</strong><small>{session.demo ? 'Synthetic demo' : clip(session.source, 40)}<span> · {number(session.events.length)} events</span></small></span>{session.id === trace?.id && <span className="active-dot" />}</button>)}</nav>
      {!sessions.length && <p className="sidebar-empty">A clean slate.<br />Your next trace goes here.</p>}
      <button type="button" className="subtle-button load-demo" onClick={loadDemo} disabled={busy || sessions.some((session) => session.demo) || sessions.length > 8}><FlaskConical size={15} aria-hidden="true" />Load synthetic demo</button>
      <div className="sidebar-bottom"><div className="local-card"><ShieldCheck size={19} aria-hidden="true" /><h3>Your traces stay yours.</h3><p>No accounts. No telemetry.<br />No trace uploads to a server.</p><span><span className="status-dot" />LOCAL BY DESIGN</span></div><button type="button" className="subtle-button clear-button" onClick={clear}><Trash2 size={15} aria-hidden="true" />Clear sessions</button><div className="sidebar-footer"><span>TRACECRATE</span><span>LOCAL / 01</span></div></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="breadcrumb"><Layers3 size={15} aria-hidden="true" /><span>Workspace</span><ChevronRight size={12} aria-hidden="true" /><strong>Trace explorer</strong></div><span className="privacy-pill"><span className="status-dot" /><LockKeyhole size={12} aria-hidden="true" />Local only<span className="privacy-extra"> · private by default</span></span></header>
      <main id="main-content" tabIndex={-1}>
        <section className="hero"><div><span className="eyebrow hero-eyebrow"><span />THE AFTER-RUN WORKSPACE</span><h1>Your agent ran.<br /><span>Now understand why.</span></h1><p>Turn agent traces into a readable sequence.<br className="desktop-break" /> Inspect tool calls, spot repeated work, and compare what happened.</p></div><div className="hero-art" aria-hidden="true"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-core"><Box size={42} strokeWidth={1} /></div><span className="art-node node-one"><Braces size={18} /></span><span className="art-node node-two"><Terminal size={18} /></span><span className="art-node node-three"><Check size={18} /></span><span className="art-caption">SIGNAL, NOT GUESSWORK</span></div></section>
        <section className="import-strip" aria-label="Import a trace"><div className="upload-icon"><Upload size={20} aria-hidden="true" /></div><div className="import-description"><label htmlFor="trace-upload">Drop a trace. See the whole story.</label><p>Claude Code · Codex · OpenTelemetry · TraceCrate JSON</p><small id="upload-limits">JSON / JSONL · up to 5 files per selection · 20 MiB each · 10 sessions in memory</small></div><div className="upload-control"><input ref={input} id="trace-upload" type="file" accept=".json,.jsonl,.ndjson,application/json,application/x-ndjson" multiple disabled={busy} aria-describedby="upload-limits" onChange={(event) => { void acceptFiles(Array.from(event.currentTarget.files ?? [])); }} /><button type="button" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Importing…' : 'Choose files'}<ArrowUpRight size={15} aria-hidden="true" /></button></div></section>
        <p className={`import-status ${notice ? 'visible' : ''}`} role="status" aria-live="polite">{notice}</p>
        {trace && stats ? <>
          <section className="run-heading"><div><div className="run-kicker"><span className="eyebrow">SESSION OVERVIEW</span>{trace.demo && <span className="demo-badge"><FlaskConical size={12} aria-hidden="true" />Synthetic demo</span>}</div><h2>{clip(trace.name, 160)}</h2><p>{clip(trace.source, 100)}<span> / </span>{number(stats.events)} recorded events<span> / </span>{stats.models.length ? clip(stats.models.join(', '), 100) : 'Model not reported'}</p></div><button type="button" className="export-button" onClick={() => setExportOpen(true)}><ArrowDownToLine size={15} aria-hidden="true" />Export report</button></section>
          {trace.demo && <div className="demo-notice"><span>EXAMPLE DATA</span>Manufactured runs, synthetic tokens and timings. Explore the baseline and optimized sample—not a performance claim.</div>}
          <section className="metrics-grid" aria-label="Session metrics">{metrics.map(({ label, value, caption, icon: Icon, className }) => <article className={`metric-card ${className}`} key={label}><div><h3>{label}</h3><Icon size={16} aria-hidden="true" /></div><strong>{value}</strong><p>{caption}</p></article>)}</section>
          <p className="metrics-note">{trace.demo ? 'Synthetic token values. ' : ''}Input includes cached tokens. Missing data is shown as —. No costs estimated.</p>
          {!!trace.warnings.length && !trace.demo && <details className="parse-warnings"><summary>{number(trace.warnings.length)} import {trace.warnings.length === 1 ? 'notice' : 'notices'} · review coverage</summary><ul>{trace.warnings.slice(0, 50).map((warning, index) => <li key={index}>{clip(warning, 600)}</li>)}</ul>{trace.warnings.length > 50 && <p>First 50 notices shown.</p>}</details>}
          <section className="explorer"><div className="explorer-top"><div className="tabs" role="tablist" aria-label="Trace views">{tabs.map(({ id, label, icon: Icon }, index) => <button type="button" key={id} role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={tab === id ? `panel-${id}` : undefined} tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)} onKeyDown={(event) => {
            const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
            if (next >= 0) { event.preventDefault(); setTab(tabs[next].id); document.getElementById(`tab-${tabs[next].id}`)?.focus(); }
          }}><Icon size={16} aria-hidden="true" />{label}{id === 'timeline' && <span className="count-badge">{number(stats.events)}</span>}</button>)}</div><span className="explorer-caption"><span className="status-dot" />READ-ONLY EXPLORER</span></div>
            <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} key={`${epoch}-${trace.id}-${tab}`} tabIndex={0}>{tab === 'timeline' && <Timeline trace={trace} selectedId={selectedId} onSelect={setSelectedId} />}{tab === 'insights' && <Insights trace={trace} onSelect={showEvent} />}{tab === 'compare' && <Compare sessions={sessions} />}</div>
          </section>
        </> : <section className="empty-workspace"><span className="empty-cube"><Box size={40} strokeWidth={1.3} aria-hidden="true" /></span><span className="eyebrow">NOTHING RETAINED</span><h2>A fresh workspace.</h2><p>Import a trace to begin, or explore the synthetic demo.<br />Your sessions live in memory and disappear on reload or clear.</p><button type="button" className="primary" disabled={busy} onClick={loadDemo}><RotateCcw size={16} aria-hidden="true" />Load synthetic demo</button></section>}
        <footer className="main-footer"><span><LockKeyhole size={12} aria-hidden="true" />Processed in your browser. Gone when you leave.</span><span>Evidence first. Always.</span></footer>
      </main>
    </div>
    {dragging && <div className="drop-overlay" aria-hidden="true"><Upload size={36} /><strong>{busy ? 'Import already in progress' : 'Drop to explore locally'}</strong><span>Up to 5 files · 20 MiB each</span></div>}
    {exportOpen && trace && <ExportDialog trace={trace} onClose={() => setExportOpen(false)} />}
  </div>;
}
