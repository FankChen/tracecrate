import { useCallback, useEffect, useRef, useState } from 'react';
import type { Trace } from '../core/types';
import { runImportTask } from '../core/import-task';
import ImportWorker from './import.worker.ts?worker&inline';

const MAX_BYTES = 20 * 1024 * 1024;
export function useTraceImport(onImported: (traces: Trace[]) => void) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const locked = useRef(false);
  const generation = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const stop = useCallback(() => {
    generation.current++;
    pending.current?.abort();
    pending.current = null;
    locked.current = false;
  }, []);
  useEffect(() => stop, [stop]);

  const reset = () => { stop(); setBusy(false); setNotice('Sessions cleared. Nothing is retained.'); };
  const cancel = () => { stop(); setBusy(false); setNotice('Import cancelled. Pending batch discarded; previously loaded sessions kept.'); };
  const importFiles = async (files: File[], sessionCount: number) => {
    if (locked.current) return;
    if (!files.length) return;
    if (files.length > 5) { setNotice('Choose up to 5 files per selection. No files were read.'); return; }
    if (sessionCount + files.length > 10) { setNotice('The limit is 10 sessions in memory. Clear sessions before importing more. No files were read.'); return; }
    if (files.some((file) => file.size > MAX_BYTES)) { setNotice('Each file must be at most 20 MiB. No files were read.'); return; }
    if (typeof Worker === 'undefined') { setNotice('This browser does not support background imports. Use a browser with Web Worker support.'); return; }
    locked.current = true;
    setBusy(true);
    const controller = new AbortController();
    pending.current = controller;
    const token = generation.current;
    const traces: Trace[] = [];
    let failures = 0;
    let timeouts = 0;
    try {
      for (const [index, file] of files.entries()) {
        if (generation.current !== token) return;
        setNotice(`Importing file ${index + 1} of ${files.length} locally… 30-second limit per file.`);
        // Keep the worker inline: a cold first import after disconnecting
        // must not depend on an additional HTTP request.
        const outcome = await runImportTask(file, () => new ImportWorker(), controller.signal);
        if (generation.current !== token) return;
        if (outcome.status === 'cancelled') return;
        if (outcome.status === 'success') traces.push({ ...outcome.trace, id: `import-${crypto.randomUUID()}` });
        else { failures++; if (outcome.status === 'timeout') timeouts++; }
      }
      if (traces.length) onImported(traces);
      setNotice(`${traces.length} ${traces.length === 1 ? 'session' : 'sessions'} imported locally.${failures ? ` ${failures} could not be parsed.${timeouts ? ` ${timeouts} exceeded the 30-second import limit.` : ''} Use supported JSON/JSONL exports with at most 20,000 events; malformed, oversized, or unsupported content is rejected.` : ' Files never leave this browser.'}`);
    } catch {
      if (generation.current === token) setNotice('Import could not finish. No source content was logged. Try a supported JSON/JSONL trace.');
    } finally {
      if (generation.current === token) { pending.current = null; locked.current = false; setBusy(false); }
    }
  };
  return { busy, notice, importFiles, reset, cancel };
}