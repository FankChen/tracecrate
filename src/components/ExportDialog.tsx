import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Braces, Download, FileCode2, ShieldCheck, X } from 'lucide-react';
import { exportTraceHtml, exportTraceJson } from '../core/export';
import type { ExportOptions, RedactionMode } from '../core/export';
import type { Trace } from '../core/types';

export default function ExportDialog({ trace, onClose }: { trace: Trace; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<RedactionMode>('structure');
  const [omitTiming, setOmitTiming] = useState(false);
  const [omitUsage, setOmitUsage] = useState(false);
  const options = useMemo<ExportOptions>(() => ({ omitTiming, omitUsage }), [omitTiming, omitUsage]);
  const [showPreview, setShowPreview] = useState(false);
  const [status, setStatus] = useState('');
  const urls = useRef(new Set<string>());
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const el = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    const activeUrls = urls.current;
    const activeTimers = timers.current;
    el.showModal();
    return () => {
      el.close();
      previous?.focus();
      activeTimers.forEach(clearTimeout);
      activeUrls.forEach((url) => URL.revokeObjectURL(url));
      activeTimers.clear();
      activeUrls.clear();
    };
  }, []);
  const preview = useMemo(() => showPreview ? exportTraceJson(trace, mode, options) : '', [trace, mode, options, showPreview]);
  const download = (format: 'json' | 'html') => {
    try {
      const content = format === 'json' ? exportTraceJson(trace, mode, options) : exportTraceHtml(trace, mode, options);
      const url = URL.createObjectURL(new Blob([content], { type: format === 'json' ? 'application/json;charset=utf-8' : 'text/html;charset=utf-8' }));
      urls.current.add(url);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `tracecrate-report.${format}`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      const timer = setTimeout(() => { URL.revokeObjectURL(url); urls.current.delete(url); timers.current.delete(timer); }, 10000);
      timers.current.add(timer);
      setStatus(`${format.toUpperCase()} report prepared using ${mode === 'structure' ? 'structure-only' : 'pattern'} redaction. Review before sharing.`);
    } catch { setStatus('The report could not be prepared. No original trace was exported.'); }
  };
  return <dialog className="export-dialog" ref={dialog} aria-labelledby="export-title" aria-describedby="export-description" onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <header className="dialog-header"><span className="export-symbol"><ShieldCheck size={22} aria-hidden="true" /></span><button type="button" className="icon-button" aria-label="Close export report" onClick={onClose}><X size={20} /></button></header><h2 id="export-title">Export report</h2><p id="export-description" className="muted">Share the sequence. Be deliberate about the details.</p>
    <fieldset><legend>What should the report contain?</legend><label className={`export-option ${mode === 'structure' ? 'active' : ''}`}><input type="radio" name="redaction" value="structure" checked={mode === 'structure'} onChange={() => { setMode('structure'); setStatus(''); }} /><span><strong>Structure only <span className="recommended">Default</span></strong><span>Remove content, inputs, outputs, and identifying names. Keep event structure and recorded metrics unless omitted below.</span></span></label><label className={`export-option ${mode === 'patterns' ? 'active' : ''}`}><input type="radio" name="redaction" value="patterns" checked={mode === 'patterns'} onChange={() => { setMode('patterns'); setOmitTiming(false); setOmitUsage(false); setStatus(''); }} /><span><strong>Pattern redaction</strong><span>Preserve text with best-effort removal of recognized secrets and personal data.</span></span></label></fieldset>
    {mode === 'structure' ? <fieldset className="export-metadata" aria-describedby="export-metadata-description"><legend>Optional metadata minimization</legend>
      <label><input type="checkbox" checked={omitTiming} onChange={(event) => { setOmitTiming(event.target.checked); setStatus(''); }} />Omit timing metadata</label>
      <label><input type="checkbox" checked={omitUsage} onChange={(event) => { setOmitUsage(event.target.checked); setStatus(''); }} />Omit token usage</label>
      <p id="export-metadata-description" className="muted">Omitted values are absent, not zero. Counts, kinds, statuses, order, remapped relationships and the demo flag remain. Remaining metadata may still identify a run or be sensitive; this is not anonymization.</p>
    </fieldset> : <p className="muted">Metadata minimization requires structure-only mode: preserved free text may contain timing and token usage. Switching to pattern redaction clears these options.</p>}
    <div className="warning export-warning"><AlertTriangle size={20} aria-hidden="true" /><div><strong>Patterns may miss secrets. Review before sharing.</strong><p>Redaction is not a security guarantee. Inspect every field in the downloaded report, including when using structure-only mode.</p></div></div>
    <button type="button" className="preview-toggle" aria-expanded={showPreview} onClick={() => setShowPreview(!showPreview)}><Braces size={16} aria-hidden="true" />{showPreview ? 'Hide redacted preview' : 'Show redacted preview'}</button>
    {showPreview && <div className="export-preview"><pre tabIndex={0} aria-label="Redacted report preview">{preview.slice(0, 50000)}</pre>{preview.length > 50000 && <p className="warning">Preview truncated to 50,000 characters. The redacted download contains the full report.</p>}</div>}
    <div className="dialog-actions"><button type="button" onClick={() => download('json')}><Braces size={16} aria-hidden="true" />Download JSON</button><button type="button" className="primary" onClick={() => download('html')}><FileCode2 size={16} aria-hidden="true" />Download HTML<Download size={15} aria-hidden="true" /></button></div><p role="status" className="export-status">{status || 'Local generation only. Your raw original is never exported.'}</p>
  </dialog>;
}