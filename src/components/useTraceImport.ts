import { useCallback, useEffect, useRef, useState } from 'react';
import type { Trace } from '../core/types';
import ImportWorker from './import.worker.ts?worker&inline';

const MAX_BYTES = 20 * 1024 * 1024;
export function useTraceImport(onImported: (traces: Trace[]) => void) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const locked = useRef(false);
  const generation = useRef(0);
  const pending = useRef(new Map<Worker, () => void>());
  const stop = useCallback(() => {
    generation.current++;
    for (const [worker, cancel] of pending.current) {
      worker.terminate();
      cancel();
    }
    pending.current.clear();
    locked.current = false;
  }, []);
  useEffect(() => stop, [stop]);

  const reset = () => { stop(); setBusy(false); setNotice('Sessions cleared. Nothing is retained.'); };
  const importFiles = async (files: File[], sessionCount: number) => {
    if (locked.current) return;
    if (!files.length) return;
    if (files.length > 5) { setNotice('Choose up to 5 files per selection. No files were read.'); return; }
    if (sessionCount + files.length > 10) { setNotice('The limit is 10 sessions in memory. Clear sessions before importing more. No files were read.'); return; }
    if (files.some((file) => file.size > MAX_BYTES)) { setNotice('Each file must be at most 20 MiB. No files were read.'); return; }
    if (typeof Worker === 'undefined') { setNotice('This browser does not support background imports. Use a browser with Web Worker support.'); return; }
    locked.current = true;
    setBusy(true);
    setNotice(`Importing ${files.length} ${files.length === 1 ? 'file' : 'files'} locally…`);
    const token = generation.current;
    const traces: Trace[] = [];
    let failures = 0;
    try {
      for (const file of files) {
        if (generation.current !== token) return;
        const trace = await new Promise<Trace | undefined>((resolve) => {
          let worker: Worker;
          // Inline the worker into the initial bundle: even the first import
          // after disconnecting requires no additional HTTP request.
          try { worker = new ImportWorker(); }
          catch { resolve(undefined); return; }
          const done = (result?: Trace) => {
            worker.terminate();
            pending.current.delete(worker);
            resolve(result);
          };
          pending.current.set(worker, () => resolve(undefined));
          worker.onmessage = ({ data }: MessageEvent<{ trace?: Trace; error?: string }>) => done(data.trace);
          worker.onerror = (event) => { event.preventDefault(); done(); };
          worker.onmessageerror = () => done();
          try { worker.postMessage(file); } catch { done(); }
        });
        if (generation.current !== token) return;
        if (trace) traces.push({ ...trace, id: `import-${crypto.randomUUID()}` });
        else failures++;
      }
      if (traces.length) onImported(traces);
      setNotice(`${traces.length} ${traces.length === 1 ? 'session' : 'sessions'} imported locally.${failures ? ` ${failures} could not be parsed. Use supported JSON/JSONL exports with at most 20,000 events; malformed, oversized, or unsupported content is rejected.` : ' Files never leave this browser.'}`);
    } catch {
      if (generation.current === token) setNotice('Import could not finish. No source content was logged. Try a supported JSON/JSONL trace.');
    } finally {
      if (generation.current === token) { locked.current = false; setBusy(false); }
    }
  };
  return { busy, notice, importFiles, reset };
}